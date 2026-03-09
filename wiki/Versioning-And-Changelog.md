# Versioning and Changelog

## Current Version

GeoSet is currently at version **1.0.0**, based on Apache Superset 6.0.0.

## Versioning Policy

GeoSet follows [Semantic Versioning](https://semver.org/):

| Increment | When |
|---|---|
| **MAJOR** (X.0.0) | Breaking changes to GeoSet-specific features, APIs, or chart configuration schema |
| **MINOR** (0.X.0) | New GeoSet features, enhancements, or non-breaking upstream Superset rebases |
| **PATCH** (0.0.X) | Bug fixes and minor improvements |

GeoSet versioning is independent of the upstream Apache Superset version. The upstream base version is tracked in `GEOSET/VERSION.md` for reference.

## Files

- [`GEOSET/VERSION.md`](../blob/main/GEOSET/VERSION.md) — current version and full versioning policy
- [`GEOSET/CHANGELOG.md`](../blob/main/GEOSET/CHANGELOG.md) — full release history

## Release History

### 1.0.0 — Initial Release

Initial release of GeoSet with:

- GeoSet Map Layer chart type with Polygon, Point, Line, and GeoJSON support
- GeoSet Multi Map chart type for composing multiple layers
- Category-based and metric-gradient coloring
- Point clustering, measurement tool, feature info popups
- Multi-layer legend with drag-and-drop ordering and visibility toggles
- Static viewport control with Save/Close and Capture Map Viewport
- Sample data ingestion pipeline and example Hurricane/Wildfire dashboards
- Docker Compose deployment configuration
