"""Load NHC advisory forecast track data into PostGIS.

Scrapes the NHC GIS archive for the current hurricane season, downloads the latest
TRACK.kmz file for each storm, parses forecast points from the KML, and inserts them
into the database.

Data source: https://www.nhc.noaa.gov/gis/archive_forecast.php
"""

import json
import os
import re
import sys
import time
import zipfile
from datetime import datetime
from io import BytesIO, StringIO

import geopandas as gpd
import pandas as pd
import requests
import shapely
from fiona.drvsupport import supported_drivers
from sqlalchemy import create_engine, text

# Enable KML support in Fiona/GDAL
supported_drivers["KML"] = "rw"

BASE_URL = "https://www.nhc.noaa.gov/gis/archive_forecast.php"
YEAR = int(os.environ.get("YEAR", 2024))

DB_HOST = os.environ.get("DB_HOST", "postgis")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "geoset")
DB_USER = os.environ.get("DB_USER", "geoset")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "geoset")

# Timezone abbreviation to UTC offset mapping for NHC timestamps
TZ_TO_UTC_OFFSET = {
    "AST": "-0400",
    "ADT": "-0300",
    "EST": "-0500",
    "EDT": "-0400",
    "CST": "-0600",
    "CDT": "-0500",
    "MST": "-0700",
    "MDT": "-0600",
    "PST": "-0800",
    "PDT": "-0700",
    "HST": "-1000",
    "HDT": "-0900",
    "GMT": "+0000",
}


def wait_for_db(engine, retries=10, delay=3):
    for attempt in range(retries):
        try:
            with engine.connect() as conn:
                conn.execute(text("SELECT 1"))
            return
        except Exception:
            print(f"Waiting for database (attempt {attempt + 1}/{retries})...")
            time.sleep(delay)
    print("Could not connect to database.")
    sys.exit(1)


def fetch_url(url, timeout=60):
    """Fetch URL content with retry logic."""
    for attempt in range(3):
        try:
            response = requests.get(url, timeout=timeout)
            response.raise_for_status()
            return response
        except Exception as e:
            if attempt < 2:
                print(f"  Retry {attempt + 1} for {url}: {e}")
                time.sleep(2)
            else:
                raise


def get_all_storm_urls(year):
    """Scrape the NHC archive page to get all storms and their KMZ URLs for a year."""
    full_url = f"{BASE_URL}?year={year}"
    print(f"Scraping storm list from {full_url}...")

    html_text = fetch_url(full_url).text
    archive_df = pd.read_html(StringIO(html_text), extract_links="body")[0]
    archive_df.columns = ["identifier", "storm"]

    archive_df["identifier"] = archive_df["identifier"].str[0]
    archive_df["storm_name"] = archive_df["storm"].str[0]
    archive_df["url"] = archive_df["storm"].str[1]
    archive_df["url"] = archive_df["url"].apply(
        lambda u: "https://www.nhc.noaa.gov" + u if isinstance(u, str) else u
    )

    # Drop header row and duplicates
    archive_df = archive_df.iloc[1:].reset_index(drop=True)
    archive_df = archive_df.drop(columns=["storm"]).drop_duplicates()

    print(f"Found {len(archive_df)} storms for {year} season.")

    # Get KMZ URLs for each storm
    archive_df["kmz_urls"] = archive_df["url"].apply(_get_kmz_urls_for_storm)
    return archive_df


def _get_kmz_urls_for_storm(storm_url):
    """Get all KMZ file URLs for a specific storm page."""
    time.sleep(0.5)  # Rate limiting
    html_text = fetch_url(storm_url).text

    # Wrap line-break-separated links in table structure for pandas parsing
    table_html = (
        "<table><tbody><tr><td>"
        + html_text.replace("<br>", "</td></tr><tr><td>")
        + "</td></tr></tbody></table>"
    )

    raw_df = pd.read_html(StringIO(table_html), extract_links="all")
    urls = []
    for cell in raw_df[0].stack().dropna():
        if isinstance(cell, tuple):
            _, href = cell
            if isinstance(href, str) and href.lower().endswith(".kmz"):
                urls.append(f"https://www.nhc.noaa.gov/gis/{href}")
    return urls


def read_kmz(kmz_url):
    """Download a KMZ file and return a GeoDataFrame."""
    time.sleep(0.5)  # Rate limiting
    content = fetch_url(kmz_url).content

    with zipfile.ZipFile(BytesIO(content), "r") as kmz:
        kml_filename = kmz.namelist()[0]
        kml_data = kmz.read(kml_filename)
        return gpd.read_file(BytesIO(kml_data))


def parse_valid_at_datetime(valid_at_str):
    """Parse NHC 'Valid at: 11:00 AM EDT July 06, 2025' to a timezone-aware datetime."""
    valid_at_str = valid_at_str[len("Valid at: ") :]

    for tz, offset in TZ_TO_UTC_OFFSET.items():
        if tz in valid_at_str:
            datetime_str = valid_at_str.replace(tz, offset)
            return datetime.strptime(datetime_str, "%I:%M %p %z %B %d, %Y")

    raise RuntimeError(f"Unknown timezone in '{valid_at_str}'")


def parse_description_html(description):
    """Parse the HTML description block from KMZ to extract metadata."""
    data = pd.read_html(StringIO(description))[0][0].loc[[3, 5, 6]]
    valid_at, wind_raw, gust_raw = data

    effective_timestamp = parse_valid_at_datetime(valid_at)

    wind_match = re.search(
        r"Maximum Wind: \d{2,3} knots \((?P<mph>\d{2,3}) mph\)", wind_raw
    )
    wind_speed_mph = int(wind_match.group("mph")) if wind_match else None

    gust_match = re.search(
        r"Wind Gusts: \d{2,3} knots \((?P<mph>\d{2,3}) mph\)", gust_raw
    )
    max_gust_mph = int(gust_match.group("mph")) if gust_match else None

    return {
        "effective_timestamp": effective_timestamp,
        "wind_speed_mph": wind_speed_mph,
        "max_gust_mph": max_gust_mph,
        "year": YEAR,
    }


# --- Main ---

db_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(db_url)

wait_for_db(engine)

storms_df = get_all_storm_urls(YEAR)

# Filter to only TRACK KMZ URLs and take the latest advisory for each storm
storms_df["latest_track_url"] = storms_df.kmz_urls.apply(
    lambda urls: max([u for u in urls if "TRACK" in u], default=None)
)
storms_df = storms_df[storms_df.latest_track_url.notna()]
storms_df = storms_df[["storm_name", "identifier", "latest_track_url"]]

holder = []

for _, (storm_name, identifier, track_url) in storms_df.iterrows():
    print(f"Processing {storm_name} ({identifier})...")

    try:
        kmz_df = read_kmz(track_url)
    except (shapely.errors.GEOSException, Exception) as e:
        print(f"  Skipping {storm_name}: {e}")
        continue

    # Extract point geometries (exclude linestrings)
    kmz_df["forecast_point"] = kmz_df.geometry.astype(str).apply(
        lambda s: shapely.wkt.loads(s)
    )
    kmz_df = kmz_df[
        kmz_df.forecast_point.apply(lambda x: isinstance(x, shapely.Point))
    ].copy()

    if kmz_df.empty:
        print(f"  No forecast points found for {storm_name}, skipping.")
        continue

    # Remove Z coordinate (3D -> 2D)
    kmz_df["forecast_point"] = kmz_df.forecast_point.apply(shapely.force_2d)
    kmz_df.reset_index(inplace=True, drop=True)

    # Parse description HTML for each point
    # Column name casing varies by geopandas/fiona version
    desc_col = "Description" if "Description" in kmz_df.columns else "description"
    parsed_df = pd.json_normalize(kmz_df[desc_col].apply(parse_description_html))
    parsed_df["forecast_point"] = kmz_df.forecast_point
    parsed_df["storm_name"] = storm_name
    parsed_df["nhc_identifier"] = identifier
    # Extract increment from URL (e.g., "013" or "033A")
    parsed_df["increment"] = track_url.split("_")[-2][:-3]

    holder.append(parsed_df)

if not holder:
    print("No storm data found. Done.")
    sys.exit(0)

agg_df = pd.concat(holder, ignore_index=True)

# Convert forecast_point geometry to GeoJSON string for ST_GeomFromGeoJSON
agg_df["forecast_point"] = agg_df["forecast_point"].apply(
    lambda p: json.dumps({"type": "Point", "coordinates": [p.x, p.y]})
)

print(f"Writing {len(agg_df)} forecast track points to database...")

insert_sql = text("""
    INSERT INTO nhc_advisory_forecast_track
        (effective_timestamp, wind_speed_mph, max_gust_mph, storm_name,
         nhc_identifier, increment, year, forecast_point)
    VALUES
        (:effective_timestamp, :wind_speed_mph, :max_gust_mph, :storm_name,
         :nhc_identifier, :increment, :year, ST_GeomFromGeoJSON(:forecast_point))
""")

with engine.begin() as conn:
    for _, row in agg_df.iterrows():
        row_dict = row.to_dict()
        row_dict = {k: (None if pd.isna(v) else v) for k, v in row_dict.items()}
        conn.execute(insert_sql, row_dict)

print("Done.")
