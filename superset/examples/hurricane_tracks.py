# Licensed to the Apache Software Foundation (ASF) under one
# or more contributor license agreements.  See the NOTICE file
# distributed with this work for additional information
# regarding copyright ownership.  The ASF licenses this file
# to you under the Apache License, Version 2.0 (the
# "License"); you may not use this file except in compliance
# with the License.  You may obtain a copy of the License at
#
#   http://www.apache.org/licenses/LICENSE-2.0
#
# Unless required by applicable law or agreed to in writing,
# software distributed under the License is distributed on an
# "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
# KIND, either express or implied.  See the License for the
# specific language governing permissions and limitations
# under the License.
import logging

import pandas as pd
from sqlalchemy import Date, inspect, Integer, String, Text

import superset.utils.database as database_utils
from superset import db
from superset.sql.parse import Table

from .geoset_helpers import (
    create_postgis_geometry_column,
    geojson_features_to_dataframe,
    load_geojson_file,
)
from .helpers import get_table_connector_registry

logger = logging.getLogger(__name__)


def load_hurricane_tracks(only_metadata: bool = False, force: bool = False) -> None:
    tbl_name = "hurricane_tracks"
    database = database_utils.get_example_database()
    with database.get_sqla_engine() as engine:
        schema = inspect(engine).default_schema_name
        table_exists = database.has_table(Table(tbl_name, schema))

        if not only_metadata and (not table_exists or force):
            geojson = load_geojson_file("hurricane_tracks.geojson")
            df = geojson_features_to_dataframe(geojson)

            df["start_date"] = pd.to_datetime(df["start_date"]).dt.date
            df["end_date"] = pd.to_datetime(df["end_date"]).dt.date

            df.to_sql(
                tbl_name,
                engine,
                schema=schema,
                if_exists="replace",
                chunksize=500,
                dtype={
                    "name": String(50),
                    "year": Integer,
                    "basin": String(20),
                    "category": Integer,
                    "max_wind_knots": Integer,
                    "min_pressure_mb": Integer,
                    "start_date": Date,
                    "end_date": Date,
                    "_geojson_text": Text,
                },
                index=False,
            )

            create_postgis_geometry_column(engine, tbl_name, schema)

    logger.debug(f"Creating table {tbl_name} reference")
    table = get_table_connector_registry()
    tbl = db.session.query(table).filter_by(table_name=tbl_name).first()
    if not tbl:
        tbl = table(table_name=tbl_name, schema=schema)
        db.session.add(tbl)
    tbl.description = "Atlantic hurricane tracks (lines)"
    tbl.database = database
    tbl.filter_select_enabled = True
    tbl.fetch_metadata()
