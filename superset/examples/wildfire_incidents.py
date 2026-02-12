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
from sqlalchemy import Date, Float, inspect, String, Text

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


def load_wildfire_incidents(
    only_metadata: bool = False, force: bool = False
) -> None:
    tbl_name = "wildfire_incidents"
    database = database_utils.get_example_database()
    with database.get_sqla_engine() as engine:
        schema = inspect(engine).default_schema_name
        table_exists = database.has_table(Table(tbl_name, schema))

        if not only_metadata and (not table_exists or force):
            geojson = load_geojson_file("wildfire_incidents.geojson")
            df = geojson_features_to_dataframe(geojson)

            df["discovery_date"] = pd.to_datetime(df["discovery_date"]).dt.date
            df["containment_date"] = pd.to_datetime(
                df["containment_date"]
            ).dt.date

            df.to_sql(
                tbl_name,
                engine,
                schema=schema,
                if_exists="replace",
                chunksize=500,
                dtype={
                    "incident_name": String(200),
                    "state": String(2),
                    "discovery_date": Date,
                    "containment_date": Date,
                    "acres_burned": Float,
                    "cause": String(50),
                    "status": String(20),
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
    tbl.description = "Wildfire incidents in the western US (points)"
    tbl.database = database
    tbl.filter_select_enabled = True
    tbl.fetch_metadata()
