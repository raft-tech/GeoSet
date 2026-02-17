"""Load NIFC wildfire location data into PostGIS."""

import json
import os
import sys
import time
import urllib.request

import pandas as pd
from sqlalchemy import create_engine, text

FIRE_API_URL = (
    "https://services3.arcgis.com/T4QMspbfLg3qTGWY/arcgis/rest/services/"
    "WFIGS_Incident_Locations_Current/FeatureServer/0/query"
    "?outFields=*&where=1%3D1&f=geojson"
)

COLUMN_MAPPING = {
    "id": "fire_id",
    "IrwinID": "irwin_id",
    "IncidentSize": "incident_size",
    "ContainmentDateTime": "containment_time",
    "PercentContained": "percent_contained",
    "ControlDateTime": "control_time",
    "IncidentShortDescription": "incident_description",
    "DiscoveryAcres": "discovery_acres",
    "FinalAcres": "final_acres",
    "FireCause": "fire_cause",
    "DispatchCenterID": "dispatch_center_id",
    "FireDiscoveryDateTime": "fire_discovery_time",
    "CreatedOnDateTime_dt": "nifc_created_time",
    "ModifiedOnDateTime_dt": "nifc_modified_time",
    "EstimatedCostToDate": "estimated_cost_to_date",
    "IncidentName": "incident_name",
    "POOFips": "origin_fips_code",
    "POOCity": "origin_city_name",
    "POOState": "origin_state_code",
    "POOCounty": "origin_county_name",
    "POOLandownerKind": "landowner_type",
    "IsMultiJurisdictional": "is_multijurisdictional",
}

TIME_COLUMNS = [
    "containment_time",
    "control_time",
    "fire_discovery_time",
    "nifc_created_time",
    "nifc_modified_time",
]

DB_HOST = os.environ.get("DB_HOST", "postgis")
DB_PORT = os.environ.get("DB_PORT", "5432")
DB_NAME = os.environ.get("DB_NAME", "geoset")
DB_USER = os.environ.get("DB_USER", "geoset")
DB_PASSWORD = os.environ.get("DB_PASSWORD", "geoset")


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


def parse_feature(feature):
    """Flatten a GeoJSON feature into a dict with properties, id, and point geometry."""
    row = feature["properties"]
    row["id"] = feature["id"]

    if coords := feature.get("geometry", {}).get("coordinates"):
        lng, lat = coords
        row["origin_coordinate"] = json.dumps(
            {"type": "Point", "coordinates": [lng, lat]}
        )
    else:
        row["origin_coordinate"] = None

    return row


db_url = f"postgresql://{DB_USER}:{DB_PASSWORD}@{DB_HOST}:{DB_PORT}/{DB_NAME}"
engine = create_engine(db_url)

wait_for_db(engine)

print("Fetching wildfire data from NIFC API...")
with urllib.request.urlopen(FIRE_API_URL, timeout=120) as response:
    data = json.loads(response.read())
features = data["features"]

print(f"Parsing {len(features)} wildfire features...")
rows = [parse_feature(f) for f in features]
df = pd.DataFrame(rows)

df.rename(columns=COLUMN_MAPPING, inplace=True)

# Keep only columns we have in the mapping + origin_coordinate
keep_cols = list(COLUMN_MAPPING.values()) + ["origin_coordinate"]
df = df[[c for c in keep_cols if c in df.columns]]

# Convert epoch ms timestamps to UTC datetimes
for col in TIME_COLUMNS:
    if col in df.columns:
        df[col] = pd.to_datetime(df[col], unit="ms", utc=True, errors="coerce")

# Convert is_multijurisdictional to boolean
if "is_multijurisdictional" in df.columns:
    df["is_multijurisdictional"] = df["is_multijurisdictional"].fillna(0).astype(bool)

print(f"Writing {len(df)} wildfire locations to database...")

insert_sql = text("""
    INSERT INTO nifc_wildfire_locations
        (fire_id, irwin_id, incident_size, containment_time, percent_contained,
         control_time, incident_description, discovery_acres, final_acres,
         fire_cause, origin_coordinate, dispatch_center_id, fire_discovery_time,
         nifc_created_time, nifc_modified_time, estimated_cost_to_date,
         incident_name, origin_fips_code, origin_city_name, origin_state_code,
         origin_county_name, landowner_type, is_multijurisdictional)
    VALUES
        (:fire_id, :irwin_id, :incident_size, :containment_time, :percent_contained,
         :control_time, :incident_description, :discovery_acres, :final_acres,
         :fire_cause, :origin_coordinate, :dispatch_center_id, :fire_discovery_time,
         :nifc_created_time, :nifc_modified_time, :estimated_cost_to_date,
         :incident_name, :origin_fips_code, :origin_city_name, :origin_state_code,
         :origin_county_name, :landowner_type, :is_multijurisdictional)
""")

with engine.begin() as conn:
    for _, row in df.iterrows():
        row_dict = row.to_dict()
        # Replace pandas NaT/NaN with None for SQL
        row_dict = {k: (None if pd.isna(v) else v) for k, v in row_dict.items()}
        conn.execute(insert_sql, row_dict)

print("Done.")
