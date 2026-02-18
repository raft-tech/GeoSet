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

1. **Add the table** — Add a `CREATE TABLE` statement to `init.sql`
2. **Write an ingest script** — Create a new Python script in `sample-data/` that fetches data from an API, transforms it, and inserts it into the table. Use `db.py` for the connection and call `skip_if_populated()` to keep it idempotent
3. **Register the script** — Add a line to `entrypoint.sh` to run your new script
4. **Add a dataset YAML** — Create a file in `superset/examples/geoset_configs/datasets/geoset/` that defines the table columns and references the database UUID from `databases/geoset.yaml`
5. **Add a chart YAML** — Create a file in `superset/examples/geoset_configs/charts/GeoSet/` that defines the viz type, params, and references the dataset UUID from your dataset YAML
6. **Run it** — `docker compose -f docker-compose-geoset.yml up --build` will pick up everything automatically. The importer traverses the `geoset_configs/` directory and loads any new YAML files it finds

## Upstream Files Touched

None — all GeoSet logic lives in new files (`docker/docker-init-geoset.sh`, `superset/cli/geoset.py`, `superset/examples/geoset_configs/`).
