"""Load NIFC wildfire location data into PostGIS."""

import json
import time

import pandas as pd
import requests
from db import get_engine, skip_if_populated, wait_for_db

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


engine = get_engine()
wait_for_db(engine)
skip_if_populated(engine, "nifc_wildfire_locations")

print("Fetching wildfire data from NIFC API...")
for attempt in range(3):
    try:
        response = requests.get(FIRE_API_URL, timeout=120)
        response.raise_for_status()
        data = response.json()
        break
    except Exception as e:
        if attempt < 2:
            print(f"  Retry {attempt + 1} for NIFC API: {e}")
            time.sleep(2)
        else:
            raise
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

# Default missing fire_cause to 'Undetermined'
if "fire_cause" in df.columns:
    df["fire_cause"] = df["fire_cause"].fillna("Undetermined")

# Convert is_multijurisdictional to boolean
if "is_multijurisdictional" in df.columns:
    df["is_multijurisdictional"] = df["is_multijurisdictional"].fillna(0).astype(bool)

print(f"Writing {len(df)} wildfire locations to database...")
df.to_sql("nifc_wildfire_locations", con=engine, if_exists="append", index=False)
print("Done.")
