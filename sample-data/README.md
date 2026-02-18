# GeoSet Sample Data

## Overview

This directory contains the data ingest pipeline for GeoSet sample data. It fetches geospatial data from external APIs, transforms it, and stores it in a PostGIS database for use by Superset.

## Docker

`docker-compose-geoset.yml` is a self-contained environment that includes PostGIS, the sample data ingest, and all Superset services. Run it with:

```
docker compose -f docker-compose-geoset.yml up
```

Access at: http://localhost:9001

## Containers

### PostGIS Database

A PostGIS-enabled PostgreSQL database (`postgis/postgis:16-3.4`). On first startup, `init.sql` creates the schema and tables.

### Sample Data Ingest

A run-once container that calls three external data sources, transforms the data, and stores it in PostGIS:

| Script | Source | Table |
|--------|--------|-------|
| `census_state_boundaries.py` | Census Bureau API | `census_state_boundaries` |
| `nifc_wildfire_locations.py` | NIFC ArcGIS API | `nifc_wildfire_locations` |
| `nhc_advisory_forecast_track.py` | NHC/NOAA API | `nhc_advisory_forecast_track` |

The ingest is **idempotent** — if a table already has data, the script skips it. This means `docker compose up` can be run repeatedly without duplicating data.

Shared database utilities (connection, retry, skip-if-populated) live in `db.py`.

## Superset Integration

- `docker/docker-init-geoset.sh` runs the standard Superset init, registers the PostGIS database connection, and calls `superset load-geoset-examples`
- `superset/cli/geoset.py` defines the `load-geoset-examples` CLI command
- YAML config files under `superset/examples/geoset_configs/` define the database, datasets, and charts (including db connection, dataset columns, and chart features like map styling and GeoJSON config)
- `superset/examples/utils.py:load_configs_from_directory()` runs the importer (`superset/commands/importers/v1/examples.py`), importing the GeoSet configs into the Superset metadata database

## Adding a New Example

### Data pipeline

1. **Add the table** — Add a `CREATE TABLE` statement to `init.sql`
2. **Write an ingest script** — Create a new Python script in `sample-data/` that fetches data from an API, transforms it, and inserts it into the table. Use `db.py` for the connection and call `skip_if_populated()` to keep it idempotent
3. **Register the script** — Add a line to `entrypoint.sh` to run your new script

### Chart config

The easiest way to add chart/dataset YAMLs is to export them from a running Superset instance:

1. **Create the chart in the Superset UI** — configure it in the explore view with your dataset and desired viz settings
2. **Export it** — go to the Charts list, select your chart, click Actions > Export. This downloads a ZIP containing YAMLs for the chart, dataset, and database
3. **Unzip and copy the files** into the correct directories:
   - `charts/*.yaml` → `superset/examples/geoset_configs/charts/GeoSet/`
   - `datasets/geoset/*.yaml` → `superset/examples/geoset_configs/datasets/geoset/`
   - `databases/geoset.yaml` — already exists, no need to copy
4. **Strip the `query_context` field** from the chart YAML (it contains instance-specific IDs that will be regenerated automatically)
5. **Run it** — `docker compose -f docker-compose-geoset.yml up --build` will pick up everything automatically

The exported YAMLs will have an instance-specific `datasource` value in params (e.g. `28__table`). This is fine — when Superset serves a chart, it overwrites `params.datasource` with the correct value from the model-level `datasource_id` field, which the importer sets correctly via UUID.

### Multi-layer maps

Multi-layer map charts (`deck_geoset_map`) reference sub-layer charts by integer ID in `deck_slices`. Since IDs vary per instance, the YAML should use `deck_slice_uuids` with stable UUIDs instead. The post-import hook in `superset/examples/geoset.py` resolves these to runtime IDs automatically. This is the only chart type that requires the post-import hook.

