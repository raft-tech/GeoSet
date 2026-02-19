# docker-compose-geoset.yml

## What It Is

A self-contained Docker Compose stack that runs a **separate Superset instance** purpose-built for GeoSet. Based on `docker-compose-light.yml` (lightweight, no Redis, no workers), with PostGIS and sample data ingest added on top.

## How to Use

```bash
# Start the stack
docker compose -f docker-compose-geoset.yml up

# Start with a full rebuild
docker compose -f docker-compose-geoset.yml up --build

# Stop
docker compose -f docker-compose-geoset.yml down
```

**Frontend:** http://localhost:9001

## Architecture

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

Caching uses `SimpleCache` (in-memory) via `superset_config_docker_light.py` — no Redis needed.

## Services

| Service | Image / Build | Purpose | Port |
|---|---|---|---|
| **postgis** | `postgis/postgis:16-3.4` | Geospatial database with GeoSet data | 5433 |
| **geoset-sample-data-ingest** | Built from `./sample-data` | One-shot container that loads sample geospatial data into PostGIS | — |
| **db-geoset** | `postgres:16` | Superset metadata store (dashboards, charts, users) | — |
| **superset-init-geoset** | Built from project root | One-shot init: runs DB migrations, creates admin user, sets up GeoSet datasource | — |
| **superset-geoset** | Built from project root | Flask backend — REST API and chart rendering | 8088 (internal) |
| **superset-node-geoset** | Built from project root | Webpack dev server with hot reload for frontend development | 9001 |

## Startup Order

1. **postgis** and **db-geoset** start in parallel
2. **geoset-sample-data-ingest** waits for PostGIS healthcheck, then loads sample data and exits
3. **superset-init-geoset** waits for db-geoset and PostGIS to be ready, then runs migrations and exits
4. **superset-geoset** starts after init completes successfully
5. **superset-node-geoset** starts independently (proxies API calls to superset-geoset)

## Volumes

| Volume | Used By | Stores |
|---|---|---|
| `geoset_data` | postgis | Geospatial data (PostGIS) |
| `db_home_geoset` | db-geoset | Superset metadata |
| `superset_home_geoset` | superset services | Superset home directory |

## Based on docker-compose-light.yml

This stack follows the same lightweight pattern as `docker-compose-light.yml`:

- **No Redis** — uses `SimpleCache` instead (via `superset_config_docker_light.py`)
- **No Celery workers** — no async task processing
- **No nginx** — access the dev server directly
- **No websocket service** — no real-time push events

The only additions over the light compose are **PostGIS**, **sample data ingest**, and a **custom init script** (`docker-init-geoset.sh`) that sets up the PostGIS datasource connection in Superset.

## Relationship to docker-compose.yml

This is a **completely independent stack** from the main `docker-compose.yml`. They share nothing:

- Separate metadata databases (different dashboards, users, charts)
- Separate volumes
- Different ports (9001 vs 9000 for frontend, 5433 vs 5432 for Postgres)

The `name: geoset` at the top of the file gives this stack its own Docker Compose project name, so `docker compose down` correctly tracks and removes only its own containers without affecting the main stack.
