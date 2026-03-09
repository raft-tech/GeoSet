# GeoSet Wiki

GeoSet is a geospatial data monitoring and visualization platform built on [Apache Superset](https://github.com/apache/superset). It extends Superset with custom deck.gl-based map visualization plugins purpose-built for exploring geographic data at scale.

<img width="1912" height="450" alt="Screenshot 2026-02-23 at 4 46 31 PM" src="https://github.com/user-attachments/assets/17b9b7a2-4507-40a8-94c2-ba142bcd2c60" />

## What GeoSet Adds

| Feature | Superset | GeoSet |
|---|---|---|
| Map visualization | Basic deck.gl GeoJSON layer | Full-featured map charts with points, lines, polygons, icons, and clustering |
| Geometry rendering | Limited styling | Configurable fill/stroke, category coloring, metric gradient coloring, dashed lines |
| Interactivity | Basic tooltips | Hover tooltips, click popups, measurement/ruler tool, zoom-based layer visibility |
| Legends | Standard chart legends | Categorical legends with toggle/isolate, metric gradient legends, multi-layer legends |
| Performance | Default deck.gl settings | Server-side geometry simplification (PostGIS), polygon caching, GPU picking optimizations, hover throttling |
| Point clustering | Not available | Supercluster-based clustering with configurable radius, zoom, and min-points |
| GeoJSON configuration | Manual setup | JSON-based config with schema validation and versioned migrations |

## Pages

- [[Getting Started]] — Install and run GeoSet with Docker
- [[GeoSet Map Layer Chart]] — Creating and configuring individual map layer charts
- [[GeoSet Multi Map Chart]] — Composing multiple layers into a single map
- [[Sample Data and Demo Dashboards]] — Loading the example Hurricane and Wildfire dashboards
- [[Development Guide]] — Local dev setup, plugin architecture, contributing
- [[Versioning and Changelog]] — Version policy and release history

## Repository

[raft-tech/GeoSet](https://github.com/raft-tech/GeoSet)

