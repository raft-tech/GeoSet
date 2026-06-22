# GeoSet Wiki

GeoSet is a geospatial data monitoring and visualization platform built on [Apache Superset](https://github.com/apache/superset). It extends Superset with custom deck.gl-based map visualization plugins purpose-built for exploring geographic data at scale.

<img width="1912" height="525" alt="geoset-example-dashboard" src="https://github.com/user-attachments/assets/7dc2e194-f4e7-495c-b4b5-33828752063f" />

## What GeoSet Adds

| Feature | Superset | GeoSet |
|---|---|---|
| Map visualization | Basic deck.gl GeoJSON layer | Full-featured map charts with points, lines, polygons, icons, and clustering |
| Geometry rendering | Limited styling | Configurable fill/stroke, category coloring, metric gradient coloring, dashed lines, dynamic point sizing |
| Interactivity | Basic tooltips | Hover tooltips, click popups, measurement/ruler tool, lasso select, zoom-based layer visibility |
| Legends | Standard chart legends | Categorical legends with toggle/isolate, metric gradient legends, multi-layer legends |
| Performance | Default deck.gl settings | Server-side geometry simplification (PostGIS), polygon caching, GPU picking optimizations, hover throttling |
| Point clustering | Not available | Supercluster-based clustering with configurable radius, zoom, and min-points |
| GeoJSON configuration | Manual setup | JSON-based config with schema validation and versioned migrations |

## Pages

- [[Getting Started]] — Install and run GeoSet with Docker
- [[GeoSet Map Layer]] — Creating and configuring individual map layer charts
- [[GeoSet Multi Map]] — Composing multiple layers into a single map
- [[Sample Dashboards]] — Loading the example Hurricane and Wildfire dashboards
- [[Development Guide]] — Local dev setup, plugin architecture, contributing
- [[JSON Config Spec]] — Reference for the GeoSet Map Layer JSON configuration schema

## Repository

[raft-tech/GeoSet](https://github.com/raft-tech/GeoSet)

