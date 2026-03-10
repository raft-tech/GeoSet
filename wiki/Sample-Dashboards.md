# Sample Data and Demo Dashboards

GeoSet ships with a self-contained demo stack that loads real geospatial data and pre-built dashboards so you can explore the platform without setting up your own data sources.

<img width="1909" height="500" alt="Screenshot 2026-02-23 at 3 40 56 PM" src="https://github.com/user-attachments/assets/801bd439-a865-45ba-b5d8-a5353c7b11dd" />

<img width="1020" height="500" alt="helene-storm-data" src="https://github.com/user-attachments/assets/b1848a34-e12d-4829-97f7-b6ba6d0c3eb4" />


## What's Included

The demo stack loads three datasets from public APIs:

| Dataset | Source | Table |
|---|---|---|
| US State Boundaries | Census Bureau API | `census_state_boundaries` |
| Active Wildfire Locations | NIFC ArcGIS API | `nifc_wildfire_locations` |
| Hurricane Best Track | NHC/NOAA API | `nhc_best_track` |

These datasets power two pre-built dashboards:

### Hurricane Tracker

A multi-layer map combining:
- **Storm Track Points** — NHC best track observation points colored by max wind speed (yellow → red gradient)
- **Storm Track Lines** — aggregated best track lines per storm per year
- **Census State Boundaries** — US state boundary polygons

Includes native dashboard filters for **Hurricane Season** (year) and **Hurricane Name** (cascades from Season).

### Wildfire Tracker

A multi-layer map combining:
- **NIFC Wildfire Locations** — active wildfire points colored by fire cause (Human, Natural, Undetermined)
- **Census State Boundaries** — US state boundary polygons

Includes a native dashboard filter for **Fire Cause**.

## Running the Demo Stack

The demo stack uses the `docker-compose.yml` at the project root. It includes PostGIS and a one-shot data ingest container that loads the sample datasets automatically.

```bash
# Start the demo stack
docker compose up

# Start with a full rebuild
docker compose up --build

# Stop
docker compose down

# Stop and wipe all data (full reset)
docker compose down -v
```

Access the demo at **http://localhost:9001** with credentials `admin` / `admin`.

> The data ingest container runs once and is idempotent — if the tables already have data, the scripts skip them.

## Demo Stack Architecture

```
Browser (:9001)
    │
    ▼
superset-node-geoset       ← Webpack dev server (hot reload)
    │
    ▼ API calls
superset-geoset (:8088)    ← Flask backend
    │
    ├──▶ db-geoset          ← PostgreSQL (Superset metadata)
    └──▶ postgis (:5433)    ← PostGIS (geospatial data)
              │
              ▼
    geoset-sample-data-ingest  ← One-shot data loader
```

## Adding a New Example Dataset or Dashboard

### 1. Add the Data

1. Add a `CREATE TABLE` statement to `sample-data/init.sql`
2. Write an ingest script in `sample-data/` that fetches and inserts the data. Use `utils.py` for the DB connection and call `skip_if_populated()` to keep it idempotent
3. Register the script in `sample-data/entrypoint.sh`

### 2. Create and Export the Chart

1. Build the chart in the Superset UI using your new dataset
2. Export it from **Charts → Actions → Export** (downloads a ZIP with YAMLs)
3. Copy the YAMLs into:
   - `superset/examples/geoset_configs/charts/GeoSet/`
   - `superset/examples/geoset_configs/datasets/geoset/`
4. Strip the `query_context` field from the chart YAML (it contains instance-specific IDs)

### 3. Export and Add the Dashboard

1. Build the dashboard in the Superset UI
2. Export it from **Dashboards → Actions → Export**
3. Copy the dashboard YAML into `superset/examples/geoset_configs/dashboards/`

### Multi-Layer Map Charts

Multi Map charts reference sub-layer charts by integer ID in `deck_slices`. Since IDs vary per instance, use `deck_slice_uuids` with stable UUIDs in the YAML instead. The post-import hook resolves these to runtime IDs automatically.

### 4. Rebuild

```bash
docker compose up --build
```

The importer walks the entire `geoset_configs/` directory — all dashboards, charts, and datasets are picked up automatically.
