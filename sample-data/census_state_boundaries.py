"""Load US Census state boundary shapefile data into PostGIS."""

import json

import geopandas as gpd
import pandas as pd
from shapely.geometry import mapping
from sqlalchemy import text

from db import get_engine, skip_if_populated, wait_for_db

CENSUS_STATE_SHAPEFILE_URL = (
    "https://www2.census.gov/geo/tiger/GENZ2024/shp/cb_2024_us_state_500k.zip"
)

COLUMN_MAPPING = {
    "STATEFP": "state_code",
    "STATENS": "state_gnis_code",
    "STUSPS": "state_abbrev",
    "GEOIDFQ": "full_geoid",
    "GEOID": "geoid",
    "LSAD": "legal_statistical_code",
    "ALAND": "land_area",
    "AWATER": "water_area",
    "NAME": "state_name",
    "geometry": "state_boundary",
}

engine = get_engine()
wait_for_db(engine)
skip_if_populated(engine, "census_state_boundaries")

print(f"Reading shapefile from {CENSUS_STATE_SHAPEFILE_URL}...")
gdf = gpd.read_file(CENSUS_STATE_SHAPEFILE_URL)

gdf = gdf.rename(columns=COLUMN_MAPPING)
gdf = gdf[list(COLUMN_MAPPING.values())]

gdf["state_boundary"] = gdf["state_boundary"].apply(
    lambda geom: json.dumps(mapping(geom))
)
df = pd.DataFrame(gdf)

print(f"Writing {len(df)} state boundaries to database...")

insert_sql = text("""
    INSERT INTO census_state_boundaries
        (state_code, state_gnis_code, state_abbrev, full_geoid,
         geoid, legal_statistical_code, land_area, water_area,
         state_name, state_boundary)
    VALUES
        (:state_code, :state_gnis_code, :state_abbrev, :full_geoid,
         :geoid, :legal_statistical_code, :land_area, :water_area,
         :state_name, :state_boundary)
""")

with engine.begin() as conn:
    for _, row in df.iterrows():
        conn.execute(insert_sql, row.to_dict())

print("Done.")
