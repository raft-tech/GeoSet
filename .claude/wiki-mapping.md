# Wiki Mapping Reference

Maps code areas to wiki pages that may need updating when those areas change.
Used by the documentation sync process (`.claude/sync-documentation.md`) to determine
which documentation to review.

**This mapping works in both directions:**

- **Forward (code → wiki):** When a code file changes, check the mapped wiki page(s).
- **Reverse (wiki → code):** When a wiki file changes, read the mapped source files
  to validate the wiki content is accurate.

## Code-to-Wiki Mappings

| Code Path Pattern | Wiki Page(s) | Section(s) to Check |
| --- | --- | --- |
| `VERSIONING.md` | wiki/Versioning-And-Changelog.md | Current Version, Changelog |
| `.github/workflows/version-bump.yml` | wiki/Versioning-And-Changelog.md | Automation |
| `superset/geoset_map/schemas/` | wiki/GeoSet-Map-Layer.md | GeoJSON Config, Schema Versioning |
| `superset-frontend/.../src/transformProps.ts` | wiki/GeoSet-Map-Layer.md | GeoJSON Config (all config sections) |
| `superset-frontend/.../src/layers/GeoSetLayer/` | wiki/GeoSet-Map-Layer.md, wiki/Development-Guide.md | Plugin Architecture |
| `superset-frontend/.../src/layers/GeoSetLayer/controlPanel.ts` | wiki/GeoSet-Map-Layer.md | Map Configuration Controls |
| `superset-frontend/.../src/GeoSetMultiMap/` | wiki/GeoSet-Multi-Map.md, wiki/Development-Guide.md | Plugin Architecture |
| `superset-frontend/.../src/GeoSetMultiMap/controlPanel.ts` | wiki/GeoSet-Multi-Map.md | Map Controls |
| `superset-frontend/.../src/components/` | wiki/GeoSet-Map-Layer.md, wiki/GeoSet-Multi-Map.md, wiki/Development-Guide.md | Key Utilities |
| `superset-frontend/.../src/utils/` | wiki/Development-Guide.md | Key Utilities |
| `superset-frontend/.../src/utils/svgIcons/` | wiki/GeoSet-Map-Layer.md | globalColoring.pointType |
| `docker-compose*.yml`, `Dockerfile*` | wiki/Getting-Started.md, wiki/Sample-Dashboards.md | Common Commands, Running the Demo Stack |
| `docker/` | wiki/Getting-Started.md | Installation, Services |
| `sample-data/` | wiki/Sample-Dashboards.md | All sections |
| `superset/examples/geoset*` | wiki/Sample-Dashboards.md | Adding a New Example |
| `superset/cli/geoset.py` | wiki/Sample-Dashboards.md | Demo Stack Architecture |
| `README.md` | wiki/Home.md, wiki/Getting-Started.md | Feature list, Quick Start instructions |
| `.github/workflows/sync-wiki.yml` | (meta — no wiki update needed) | — |

Note: `...` in frontend paths is shorthand for `plugins/geoset-map-chart`.

## README.md Overlap

README.md at root and wiki/Home.md both describe GeoSet. Key areas of overlap:

- Feature list (README "What is GeoSet?" ↔ wiki/Home.md "What GeoSet Adds")
- Quick Start instructions (README ↔ wiki/Getting-Started.md)
- Contributing / Development Guide links

When README.md changes, check wiki/Home.md and wiki/Getting-Started.md for consistency.
When wiki/Home.md changes, check README.md for consistency.
