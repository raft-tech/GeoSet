# Docker PostGIS Setup Steps (Issue #40)

## What We Did

1. **Backed up the database** — `pg_dumpall` saved to `backups/pg_backup.sql`

2. **Switched Postgres image to PostGIS** — changed `postgres:16` to `imresamu/postgis:16-3.5` in all 4 docker-compose files (`docker-compose.yml`, `docker-compose-non-dev.yml`, `docker-compose-image-tag.yml`, `docker-compose-light.yml`)

3. **Added PostGIS extension creation** — added `CREATE EXTENSION IF NOT EXISTS postgis;` in `docker/docker-entrypoint-initdb.d/examples-init.sh`

4. **Created GeoJSON data files** — 3 files in `superset/examples/data/geoset/` (us_state_boundaries, wildfire_incidents, hurricane_tracks)

5. **Created Python loaders + helpers** — `geoset_helpers.py`, `census_state_boundaries.py`, `wildfire_incidents.py`, `hurricane_tracks.py`

6. **Wired into loading pipeline** — updated `data_loading.py` and `cli/examples.py`

7. **Rebuilt without losing data** — `docker compose up --build -d` (no `-v` flag, so volumes were preserved)

8. **Started superset manually** — `docker compose up superset -d --no-deps` (init failed due to stale dataset record from previous run)

9. **Cleaned up stale record** — deleted old `census_state_boundaries` dataset that was linked to wrong database:
   ```
   docker compose exec db psql -U superset -d superset -c "DELETE FROM tables WHERE id = 29;"
   ```

10. **Ran load-examples** — `docker compose exec superset superset load-examples --force`

## Important Notes

- Never ran `docker compose down -v` — existing data (charts, dashboards, dart connection) was preserved
- `imresamu/postgis:16-3.5` is used instead of `postgis/postgis:16-3.5` because the latter doesn't support Apple Silicon (ARM64)
- The PostGIS init script only runs on first-time database creation (fresh volumes). For existing databases, run manually:
  ```
  docker compose exec db psql -U superset -d examples -c "CREATE EXTENSION IF NOT EXISTS postgis;"
  docker compose exec db psql -U superset -d superset -c "CREATE EXTENSION IF NOT EXISTS postgis;"
  ```
