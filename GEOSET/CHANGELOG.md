# GeoSet Changelog

All notable changes to the GeoSet fork of Apache Superset will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.1.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [Unreleased]

## [1.0.0] - 2026-02-20

Initial release of GeoSet, a geospatial data monitoring platform built on Apache Superset.

### Added

- GeoSet Map Layer plugin (`deck_geoset_map_layer`) with support for Polygon, Point, Line, and GeoJSON layer types
- GeoSet Multi Map plugin (`deck_geoset_multi_map`) for composing multiple map layers into a single view
- Category-based coloring with interactive legend toggling
- Metric-based gradient coloring (colorByValue)
- Point clustering with configurable zoom, radius, and min-points
- Static viewport control with Save/Close and Capture Map Viewport
- Feature info click popups with configurable columns
- Hover data tooltips with configurable columns
- Map measurement tool (distance and area)
- Multi-layer legend with drag-and-drop z-order sorting and per-layer visibility toggles
- Custom Mapbox style support
- Min/max zoom slider control
- JSON-based GeoJSON Config editor for advanced styling (fill, stroke, patterns, icons)
- Icon support for point layers with category-based icon/color mapping
- Dashed/dotted line style support via PathStyleExtension
- Sample data ingestion scripts for demo dashboards

### Performance

- SolidPolygonLayer + binary LineLayer for polygon rendering (~33% fewer GPU vertices)
- Module-level polygon data caching to avoid re-tessellation on category toggles
- Point cluster layer with Supercluster for large point datasets
- Debounced viewport syncing to module-level store (outside Redux)

### Infrastructure

- Docker Compose configuration for GeoSet deployment
- Custom README and documentation
- Schema versioning and migration system for chart configurations
