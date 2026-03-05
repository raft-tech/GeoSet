# LLM Context Guide for GeoSet

GeoSet is a geospatial data monitoring platform — a customized fork of Apache Superset with a purpose-built deck.gl map visualization plugin.

## Repository Overview

```
GeoSet/
├── superset/                        # Python backend (Flask, SQLAlchemy)
│   ├── geoset_map/                  # GeoSet REST API + Marshmallow schemas
│   │   ├── api.py                   # /api/v1/geoset_map/ endpoints
│   │   └── schemas/                 # GeoSetLayerV1–V3 validation schemas
│   ├── views/api/                   # Superset REST API endpoints
│   └── models/                      # SQLAlchemy database models
├── superset-frontend/
│   ├── plugins/geoset-map-chart/    # Custom deck.gl map plugin (primary custom code)
│   │   └── src/
│   │       ├── layers/GeoSetLayer/  # Main layer: control panel, rendering, transform
│   │       ├── layers/PointClusterLayer/
│   │       ├── components/          # Legend, JsonEditorControl, etc.
│   │       ├── utils/               # colors.ts, migrationApi.ts, etc.
│   │       ├── buildQuery.ts        # SQL query builder
│   │       ├── transformProps.ts    # Data → deck.gl props pipeline
│   │       └── types.ts             # Shared TypeScript types
│   └── src/                         # Upstream Superset frontend
├── CHANGELOG/
│   └── 6.032.md                     # GeoSet release notes
├── docker/                          # Docker configuration
├── CLAUDE.md                        # Claude-specific instructions
└── LLMS.md                          # This file (all LLM tools)
└── VERSIONING.md                    # GeoSet version tracking
```

## GeoSet-Specific Architecture

### Layer Config Schema (`geojsonConfig`)
Layer styling is controlled by a JSON config validated against versioned Marshmallow schemas. The current version is tracked in `src/layers/common.tsx` (`CURRENT_VERSION`). Old configs auto-migrate to the current version on load via the `/api/v1/geoset_map/schema/<from>/<to>` endpoint.

```json
{
  "globalColoring": {
    "fillColor": [40, 147, 179, 255],
    "strokeColor": [0, 0, 0, 255],
    "strokeWidth": 2,
    "fillPattern": "solid"
  },
  "pointSize": 6,
  "legend": { "title": "My Layer", "name": null }
}
```

### Data Pipeline
`buildQuery.ts` → SQL → `transformProps.ts` → deck.gl layer props → `GeoSetLayer.tsx` renders via deck.gl/ScatterplotLayer, IconLayer, LineLayer, SolidPolygonLayer.

### Schema Versioning
When adding new `geojsonConfig` fields:
1. Create `schemas/GeoSetLayerVNSchema.py` with `upgrade_from_previous_version()` static method
2. Register in `schemas/__init__.py` and `api.py`
3. Bump `CURRENT_VERSION` in `src/layers/common.tsx`

## Code Standards

### TypeScript Frontend
- **Avoid `any` types** — use proper TypeScript, reuse types from `types.ts`
- **Functional components** with hooks
- **`@superset-ui/core`** for UI components (not direct antd)
- **Jest + React Testing Library** for tests (no Enzyme)

### Python Backend
- **Type hints required** for all new code
- **MyPy compliant** — run `pre-commit run mypy`
- **Marshmallow schemas** for all API request/response validation
- **pytest** for testing

## Documentation Requirements

- **CHANELOG/**: Add updates to a new 6.0.X for any user-facing changes
- **Docstrings**: Required for new functions/classes

## Running Tests

```bash
# Frontend (from superset-frontend/)
npm run test                           # All tests
npm run test -- filename.test.tsx      # Single file

# Backend
pytest tests/unit_tests/              # Unit tests
pytest tests/unit_tests/specific.py   # Single file
```

## Pre-commit Validation

```bash
pre-commit install
git add .                   # Stage changes first
pre-commit run              # Staged files only
pre-commit run mypy         # Python type checking
pre-commit run prettier     # Code formatting
pre-commit run eslint       # Frontend linting
```

Activate your Python virtual environment before running pre-commit.

## Common Patterns

### Adding a GeoSet API Endpoint
- **`superset/geoset_map/api.py`** — add `@expose()` method with OpenAPI docstring
- **`superset/geoset_map/schemas/`** — add Marshmallow schema for request/response

### Migration Files (upstream Superset DB)
- **Location**: `superset/migrations/versions/`
- **Naming**: `YYYY-MM-DD_HH-MM_hash_description.py`

## Git / GitHub

This is a fork of Apache Superset. Always target the fork explicitly:
```bash
gh pr create --repo raft-tech/GeoSet ...
gh issue list --repo raft-tech/GeoSet
```

## Platform-Specific Instructions

- **[CLAUDE.md](CLAUDE.md)** — For Claude (Anthropic)
- **[LLMS.md](LLMS.md)** — This file (Cursor, Copilot, Gemini, etc.)
