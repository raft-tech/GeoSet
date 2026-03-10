# Sync Documentation

Investigate all GeoSet-specific files changed on this branch and resolve documentation
drift, inconsistencies, and gaps. This includes wiki pages, README.md, comments, and
docstrings.

## Scope

Focus on files changed in the fork — exclude untouched upstream Superset files. Key areas:

- `wiki/` — all wiki pages
- `README.md`
- `superset/geoset_map/` — GeoSet backend (schemas, API)
- `superset-frontend/plugins/geoset-map-chart/` — GeoSet frontend plugin
- `superset/examples/geoset*` and `superset/cli/geoset.py` — example data
- `sample-data/` — data ingestion
- `docker-compose*.yml`, `docker/`, `Dockerfile*` — Docker configuration
- `VERSIONING.md`

## Cross-Reference Rules

These files must always stay in sync — if one changed, verify the other:

| Source of truth                        | Must match                                                            |
| -------------------------------------- | --------------------------------------------------------------------- |
| `VERSIONING.md` (version + changelog) | `wiki/Versioning-And-Changelog.md` (version + recent changelog rows) |

## How

1. Find changed files: union of `git diff --name-only`, `git diff --cached --name-only`,
   and `git diff main...HEAD --name-only`.
2. Check the cross-reference rules above — if any source-of-truth file changed, verify its
   counterpart is up to date.
3. For each changed file, determine what documentation it affects and verify accuracy.
4. Fix anything out of sync. Only fix clearly wrong docs — don't add new docstrings or
   comments where none existed.
5. Report what was checked, what was fixed, and anything needing manual attention.
