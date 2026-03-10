# GeoSet Development Guide

## Local Setup

### Prerequisites

- Docker and Docker Compose
- Node.js (for frontend development)
- Python 3.9+ (for backend development)

### Start the Full Stack

```bash
docker compose up
```

### Frontend with Hot Reload

For plugin development without rebuilding the container on every change:

```bash
cd superset-frontend

# Install dependencies (first time only)
npm install

# Build the plugins
npm run plugins:build

# Start the dev server with hot reload
npm run dev-server
```

The dev server runs at **http://localhost:9001** (**localhost:9000** for standard Superset) and proxies API requests to the Flask backend.

To build only the GeoSet plugin:

```bash
cd superset-frontend
npm run plugins:build
```

### Backend Development

The Flask backend runs inside Docker. To run backend commands:

```bash
# Open a shell in the superset container
docker compose exec superset bash

# Run database migrations
superset db upgrade

# Create an admin user
superset fab create-admin
```

## Project Structure

```
GeoSet/
├── superset/                          # Python backend (Flask/FAB)
│   ├── cli/geoset.py                  # CLI command for loading example data
│   └── examples/
│       ├── geoset.py                  # Example data importer + post-import hook
│       └── geoset_configs/            # YAML exports (charts, datasets, dashboards)
├── superset-frontend/
│   └── plugins/
│       └── geoset-map-chart/          # GeoSet map visualization plugin
│           └── src/
│               ├── layers/
│               │   └── GeoSetLayer/   # Single-layer chart (deck_geoset_map_layer)
│               ├── GeoSetMultiMap/    # Multi-layer chart (deck_geoset_multi_map)
│               ├── components/        # Legend, Tooltip, MapControls, etc.
│               ├── utils/             # Color utilities, geometry helpers, viewport
│               ├── buildQuery.ts      # PostGIS query builder
│               └── transformProps.ts  # Data transformation pipeline
├── sample-data/                       # Demo data ingestion pipeline
├── docker/                            # Docker configuration and init scripts
├── docker-compose.yml                 # Main stack (includes GeoSet demo data)
└── VERSIONING.md                      # GeoSet version policy and changelog
```

## Plugin Architecture

The GeoSet map plugin is a Superset chart plugin built on [deck.gl](https://deck.gl/). It follows the standard Superset plugin interface:

| File | Purpose |
|---|---|
| `buildQuery.ts` | Builds the SQL query sent to the backend. Selects the GeoJSON column and any metric/category columns. |
| `transformProps.ts` | Transforms the query response into props consumed by the React component. Parses GeoJSON config, resolves colors. |
| `GeoSetLayer/GeoSetLayer.tsx` | Main React component for the single-layer chart. Manages deck.gl layers, viewport, clustering, tooltips, and popups. |
| `GeoSetLayer/controlPanel.ts` | Defines all chart controls visible in the explore panel. |
| `GeoSetMultiMap/Multi.tsx` | React component for the multi-layer chart. Fetches and renders each sub-layer chart's data. |
| `GeoSetMultiMap/controlPanel.ts` | Control panel for the multi-layer chart. |

### Key Utilities

| File | Purpose |
|---|---|
| `utils/colors.ts` | Color scale computation, category color mapping, metric gradient logic |
| `utils/buildPolygonLayers.ts` | Constructs SolidPolygonLayer + LineLayer pairs for polygon rendering |
| `utils/fitViewport.ts` | Autozoom calculation to fit features in the viewport |
| `utils/liveViewportStore.ts` | Module-level store for live viewport state (bypasses Redux to avoid "Altered" chart state) |
| `components/MultiLegend.tsx` | Drag-and-drop multi-layer legend with toggle/isolate |
| `components/MapControls.tsx` | Measurement tool and zoom controls |

## Branch Strategy

- `main` — stable, target for all PRs
- Feature branches — named `<issue-number>-short-description` (e.g., `45-polygon-performance`)

## Contributing

1. Create a feature branch from `main`:

   ```bash
   git checkout -b your-feature-name main
   ```

2. Make your changes and test locally
3. Submit a PR against `main` on [raft-tech/GeoSet](https://github.com/raft-tech/GeoSet)

### PR Guidelines

- Keep PRs focused on a single concern
- Include a clear description of what changed and why
- Add screenshots for any UI changes
- Ensure the frontend builds without errors (`npm run plugins:build`)

### Useful Resources

- [Apache Superset Contributing Guide](https://superset.apache.org/docs/contributing/)
- [Creating Viz Plugins](https://superset.apache.org/docs/contributing/creating-viz-plugins/)
- [deck.gl Documentation](https://deck.gl/docs)
- [Superset API Reference](https://superset.apache.org/docs/rest-api)
