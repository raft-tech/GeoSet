# GeoSet Sample Data

## Overview

This directory contains the data ingest pipeline for GeoSet sample data. It fetches geospatial data from external APIs, transforms it, and stores it in a PostGIS database for use by Superset.

## How to Use

```bash
# Start the stack
docker compose -f docker-compose-geoset.yml up

# Start with a full rebuild
docker compose -f docker-compose-geoset.yml up --build

# Stop
docker compose -f docker-compose-geoset.yml down

# Stop and wipe all data (full reset)
docker compose -f docker-compose-geoset.yml down -v
```

**Frontend:** http://localhost:9001

## Architecture

`docker-compose-geoset.yml` is a self-contained stack based on `docker-compose-light.yml` (no Redis, no Celery workers, no nginx). It is **completely independent** from the main `docker-compose.yml` — separate metadata databases, separate volumes, different ports (9001 vs 9000). The `name: geoset` project name keeps the two stacks from interfering.

```
Browser (:9001)
    │
    ▼
superset-node-geoset          ← Webpack dev server (hot reload)
    │
    ▼ API calls
superset-geoset (:8088)       ← Flask backend (REST API, charts)
    │
    ├──▶ db-geoset             ← PostgreSQL 16 (Superset metadata)
    └──▶ postgis (:5433)       ← PostGIS 16-3.4 (geospatial data)
              │
              ▼
         geoset-sample-data-ingest  ← One-shot: loads sample geodata
```

## Data Ingest

A run-once container that calls three external data sources, transforms the data, and stores it in PostGIS:

| Script | Source | Table |
|--------|--------|-------|
| `census_state_boundaries.py` | Census Bureau API | `census_state_boundaries` |
| `nifc_wildfire_locations.py` | NIFC ArcGIS API | `nifc_wildfire_locations` |
| `nhc_best_track.py` | NHC/NOAA API | `nhc_best_track` |

The ingest is **idempotent** — if a table already has data, the script skips it. Shared database utilities (connection, retry, skip-if-populated) live in `db.py`.

## Superset Integration

- `docker/docker-init-geoset.sh` runs the standard Superset init, registers the PostGIS database connection, and calls `superset load-geoset-examples`
- `superset/cli/geoset.py` defines the `load-geoset-examples` CLI command
- YAML config files under `superset/examples/geoset_configs/` define the database, datasets, charts, and dashboards
- `superset/examples/geoset.py` contains a post-import hook that resolves UUID references to runtime IDs

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

The exported YAMLs will have an instance-specific `datasource` value in params (e.g. `28__table`). This is fine — the post-import hook in `superset/examples/geoset.py` rewrites these to the correct runtime IDs.

### Multi-layer maps

Multi-layer map charts (`deck_geoset_map`) reference sub-layer charts by integer ID in `deck_slices`. Since IDs vary per instance, the YAML should use `deck_slice_uuids` with stable UUIDs instead. The post-import hook resolves these to runtime IDs automatically.

### Dashboard config

Dashboards can also be exported and added the same way:

1. **Create the dashboard in the Superset UI** — add charts, filters, and layout
2. **Export it** — go to the Dashboards list, select your dashboard, click Actions > Export
3. **Unzip and copy** the dashboard YAML into `superset/examples/geoset_configs/dashboards/`
4. **Strip the `query_context` field** from any chart YAMLs included in the export (if they aren't already in geoset_configs)
5. The dashboard YAML references charts by UUID in the `position` metadata, and native filters reference datasets by `datasetUuid` — these are resolved automatically during import

The importer walks the entire `geoset_configs/` directory, so dashboards, charts, and datasets are all picked up in one pass.

## Current Example

The GeoSet example dashboard (`Geoset_example_dashboard`) ships with two multi-layer maps side by side:

- **Hurricane Tracker** — a multi-layer map combining:
  - **Storm Track Points** — NHC best track observation points colored by max wind speed (yellow to red)
  - **Storm Track Lines** — aggregated best track lines per storm per year
  - **Census State Boundaries** — US state boundary polygons
- **Wildfire Tracker** — a multi-layer map combining:
  - **NIFC Wildfire Locations** — active wildfire points colored by fire cause (Human, Natural, Undetermined)
  - **Census State Boundaries** — US state boundary polygons
- **Fire Cause filter** — a native filter scoped to the Wildfire Tracker chart
- **Hurricane Season filter** — a native filter on year, scoped to the Hurricane Tracker chart
- **Hurricane Name filter** — a native filter on storm name, cascades from Hurricane Season
