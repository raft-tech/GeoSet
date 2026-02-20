"""Load NHC best track data into PostGIS.

Scrapes the NHC GIS best track archive for the specified hurricane seasons, downloads
the best_track.kmz file for each storm, parses track points from the KML, and inserts
them into the database.

Data source: https://www.nhc.noaa.gov/gis/archive_besttrack.php
"""

import os
import re
import sys
import time
import zipfile
from datetime import datetime, timezone
from io import BytesIO, StringIO

import geopandas as gpd
import pandas as pd
import requests
import shapely
from fiona.drvsupport import supported_drivers
from sqlalchemy import text
from utils import fetch_with_retry, get_engine, skip_if_populated, wait_for_db

# Enable KML support in Fiona/GDAL
supported_drivers["KML"] = "rw"

BASE_URL = "https://www.nhc.noaa.gov/gis/archive_besttrack.php"
YEARS = [int(y) for y in os.environ.get("YEARS", "2024,2025").split(",")]


def fetch_url(url, timeout=60):
    """Fetch URL content with retry logic."""

    def _do():
        response = requests.get(url, timeout=timeout)
        response.raise_for_status()
        return response

    return fetch_with_retry(_do, description=url)


def get_all_storm_urls(year):
    """Scrape the NHC best track archive page to get all storms and KMZ URLs for a year."""
    full_url = f"{BASE_URL}?year={year}"
    print(f"Scraping storm list from {full_url}...")

    html_text = fetch_url(full_url).text

    storms = []
    for match in re.finditer(
        r'archive_besttrack_results\.php\?id=(\w+)&(?:amp;)?year=\d+&(?:amp;)?name=([^"<]+)',
        html_text,
    ):
        storm_id = match.group(1)
        storm_name = match.group(2).strip()
        storms.append({"identifier": storm_id, "storm_name": storm_name})

    archive_df = pd.DataFrame(storms).drop_duplicates(subset=["identifier"])
    archive_df["kmz_url"] = archive_df["identifier"].apply(
        lambda sid: f"https://www.nhc.noaa.gov/gis/best_track/{sid}{year}_best_track.kmz"
    )

    print(f"Found {len(archive_df)} storms for {year} season.")
    return archive_df


def read_kmz(kmz_url):
    """Download a KMZ file and return a GeoDataFrame."""
    time.sleep(0.5)  # Rate limiting
    content = fetch_url(kmz_url).content

    with zipfile.ZipFile(BytesIO(content), "r") as kmz:
        kml_filename = next(f for f in kmz.namelist() if f.endswith(".kml"))
        kml_data = kmz.read(kml_filename)
        return gpd.read_file(BytesIO(kml_data), layer="Data")


def html_table_to_dict(html_table, year):
    """Parse HTML table to extract hurricane metadata.

    The HTML description table has this row layout (by index):
        [0] DB NINE (AL092024)       -> storm identifier
        [1] 1200 UTC SEP 23          -> timestamp (no year)
        [2] Storm Location:
        [3] 17.2 N, -81.7 W
        [4] Min Sea Level Pressure:
        [5] 1004 mb; 29.64 in Hg     -> pressure
        [6] Maxium Intensity:
        [7] 30 knots;  35 mph;  56 kph -> wind speed
    """
    html_series = html_table.iloc[:, 0]

    # e.g. "TS HELENE (AL092024)" -> "al09"
    storm_name_match = re.match(r"(.*) \((\w+)\)", html_series[0])
    nhc_identifier = storm_name_match.group(2)[:4].lower()

    # e.g. "1200 UTC SEP 23" -> datetime (year not included in source)
    effective_timestamp = datetime.strptime(
        f"{year} {html_series[1]}",
        "%Y %H%M UTC %b %d",
    ).replace(tzinfo=timezone.utc)

    # e.g. "1004 mb; 29.64 in Hg" -> 1004
    pressure_match = re.match(r"(\d+) mb;", html_series[5])
    min_sea_level_pressure_mb = int(pressure_match.group(1)) if pressure_match else None

    # e.g. "30 knots;  35 mph;  56 kph" -> 35
    intensity_match = re.search(r"(\d+) mph", html_series[7])
    max_gust_mph = int(intensity_match.group(1)) if intensity_match else None

    return {
        "effective_timestamp": effective_timestamp,
        "nhc_identifier": nhc_identifier,
        "min_sea_level_pressure_mb": min_sea_level_pressure_mb,
        "max_gust_mph": max_gust_mph,
        "year": year,
    }


# --- Main ---

engine = get_engine()
wait_for_db(engine)
skip_if_populated(engine, "nhc_best_track")

holder = []

for year in YEARS:
    print(f"\n=== Processing {year} season ===")
    storms_df = get_all_storm_urls(year)

    for _, row in storms_df.iterrows():
        storm_name = row["storm_name"]
        kmz_url = row["kmz_url"]

        print(f"Processing {storm_name}...")

        try:
            kmz_df = read_kmz(kmz_url)
        except Exception as e:
            print(f"  Skipping {storm_name}: {e}")
            continue

        # Parse HTML descriptions into structured metadata
        # Column name casing varies by geopandas/fiona version
        desc_col = "Description" if "Description" in kmz_df.columns else "description"
        html_tables = kmz_df[desc_col].apply(lambda html: pd.read_html(StringIO(html)))

        extracted = []
        for tables in html_tables:
            if tables and len(tables[0].columns) == 1:
                extracted.append(html_table_to_dict(tables[0], year))

        if not extracted:
            print(f"  No metadata parsed for {storm_name}, skipping.")
            continue

        metadata_df = pd.DataFrame(extracted)

        # Remove Z coordinate (3D -> 2D)
        kmz_df["observation_point"] = kmz_df.geometry.apply(shapely.force_2d)

        kmz_df = pd.concat([kmz_df.reset_index(drop=True), metadata_df], axis=1).drop(
            columns=[
                desc_col,
                "Name" if "Name" in kmz_df.columns else "name",
                "geometry",
            ]
        )

        kmz_df["storm_name"] = storm_name

        holder.append(kmz_df)

if not holder:
    print("No storm data found. Done.")
    sys.exit(0)

agg_df = pd.concat(holder, ignore_index=True)

# Convert observation_point geometry to WKT for ST_GeogFromText
agg_df["observation_point"] = agg_df["observation_point"].apply(
    lambda p: f"POINT({p.x} {p.y})"
)

# Drop extra columns from KML that aren't in our table
keep_cols = [
    "effective_timestamp",
    "min_sea_level_pressure_mb",
    "max_gust_mph",
    "storm_name",
    "nhc_identifier",
    "year",
    "observation_point",
]
agg_df = agg_df[keep_cols]

print(f"Writing {len(agg_df)} best track points to database...")

# Use raw SQL to insert with ST_GeogFromText for the Geography column
insert_sql = text("""
    INSERT INTO nhc_best_track
        (effective_timestamp, min_sea_level_pressure_mb, max_gust_mph,
         storm_name, nhc_identifier, year, observation_point)
    VALUES
        (:effective_timestamp, :min_sea_level_pressure_mb, :max_gust_mph,
         :storm_name, :nhc_identifier, :year, ST_GeogFromText(:observation_point))
""")

with engine.begin() as conn:
    conn.execute(insert_sql, agg_df.to_dict("records"))

print("Done.")
