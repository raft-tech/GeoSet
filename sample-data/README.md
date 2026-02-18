# GeoSet Sample Data

## Overview

This directory contains the data ingest pipeline for GeoSet sample data. It fetches geospatial data from external APIs, transforms it, and stores it in a PostGIS database for use by Superset.

## Docker

- Two new containers are defined in `docker-compose-geoset.yml`
- The main `docker-compose.yml` triggers `docker-compose-geoset.yml` through the use of `include`, so `docker compose up` is all you need

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

- The PostGIS database connection is registered in Superset via `docker/docker-init.sh`
- YAML config files under `superset/examples/configs/` define the database, datasets, and charts (including db connection, dataset columns, and chart features like map styling and GeoJSON config)
- In `superset/cli/examples.py` line 88, `load_examples_from_configs()` is called which triggers `superset/examples/utils.py` to run the importer (`superset/commands/importers/v1/examples.py`), importing the GeoSet charts into the Superset metadata database
- A post-import step in `superset/examples/geoset.py` resolves chart UUIDs to runtime chart IDs so the multi-layer map knows which layers to load

## Adding a New Example

1. **Add the table** — Add a `CREATE TABLE` statement to `init.sql`
2. **Write an ingest script** — Create a new Python script in `sample-data/` that fetches data from an API, transforms it, and inserts it into the table. Use `db.py` for the connection and call `skip_if_populated()` to keep it idempotent
3. **Register the script** — Add a line to `entrypoint.sh` to run your new script
4. **Add a dataset YAML** — Create a file in `superset/examples/configs/datasets/geoset/` that defines the table columns and references the database UUID from `databases/geoset.yaml`
5. **Add a chart YAML** — Create a file in `superset/examples/configs/charts/GeoSet/` that defines the viz type, params, and references the dataset UUID from your dataset YAML
6. **Run it** — `docker compose up` will pick up everything automatically. The importer traverses the `configs/` directory and loads any new YAML files it finds

## Upstream Files Touched

- `superset/examples/utils.py` — 3 lines added to call the GeoSet multi-map resolution after import
- `docker-compose.yml` — 2 lines added to include `docker-compose-geoset.yml`
