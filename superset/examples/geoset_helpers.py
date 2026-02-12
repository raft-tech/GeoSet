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
"""Shared helpers for loading GeoSet spatial example datasets."""

from __future__ import annotations

import logging
import os
from typing import Any

import pandas as pd
from sqlalchemy import text
from sqlalchemy.engine import Engine

from superset.utils import json

logger = logging.getLogger(__name__)

GEOSET_DATA_DIR = os.path.join(os.path.dirname(__file__), "data", "geoset")


def load_geojson_file(filename: str) -> dict[str, Any]:
    """Read a GeoJSON file from the geoset data directory."""
    filepath = os.path.join(GEOSET_DATA_DIR, filename)
    with open(filepath, encoding="utf-8") as f:
        return json.loads(f.read())


def geojson_features_to_dataframe(geojson: dict[str, Any]) -> pd.DataFrame:
    """Extract properties into a DataFrame with a ``_geojson_text`` geometry column.

    Each feature's geometry is serialized to a JSON string in ``_geojson_text``
    so it can be loaded into a text column first, then converted to a PostGIS
    geometry column via :func:`create_postgis_geometry_column`.
    """
    rows: list[dict[str, Any]] = []
    for feature in geojson["features"]:
        row = dict(feature.get("properties", {}))
        row["_geojson_text"] = json.dumps(feature["geometry"])
        rows.append(row)
    return pd.DataFrame(rows)


def create_postgis_geometry_column(
    engine: Engine,
    tbl_name: str,
    schema: str | None,
) -> None:
    """Convert the temporary ``_geojson_text`` text column to a PostGIS geometry.

    Steps:
    1. Add a ``geom`` geometry column (SRID 4326).
    2. Populate it from the GeoJSON text using ``ST_GeomFromGeoJSON``.
    3. Create a GIST spatial index.
    4. Drop the temporary ``_geojson_text`` column.

    If PostGIS is not available the function logs a warning and skips
    gracefully — the table will still be usable, just without a native
    geometry column.
    """
    qualified = f'"{schema}"."{tbl_name}"' if schema else f'"{tbl_name}"'

    # Check if PostGIS is available (use connect so a failed query doesn't
    # leave an aborted transaction).
    with engine.connect() as conn:
        try:
            result = conn.execute(text("SELECT PostGIS_Version()"))
            result.fetchone()
        except Exception:
            logger.warning(
                "PostGIS is not available — skipping geometry column for %s. "
                "The _geojson_text column will remain as-is.",
                tbl_name,
            )
            return

    # Use engine.begin() which auto-commits on success and auto-rolls-back
    # on exception — avoids the need for explicit commit()/rollback().
    try:
        with engine.begin() as conn:
            conn.execute(
                text(
                    f"ALTER TABLE {qualified} "
                    f"ADD COLUMN geom geometry(Geometry, 4326)"
                )
            )
            conn.execute(
                text(
                    f"UPDATE {qualified} "
                    f"SET geom = ST_SetSRID(ST_GeomFromGeoJSON(_geojson_text), 4326)"
                )
            )
            conn.execute(
                text(
                    f"CREATE INDEX idx_{tbl_name}_geom "
                    f"ON {qualified} USING GIST (geom)"
                )
            )
            conn.execute(
                text(
                    f"ALTER TABLE {qualified} DROP COLUMN _geojson_text"
                )
            )
        logger.info("Created PostGIS geometry column for %s", tbl_name)
    except Exception:
        logger.exception(
            "Failed to create PostGIS geometry column for %s", tbl_name
        )
