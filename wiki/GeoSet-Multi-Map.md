# GeoSet Multi Map Chart

The **GeoSet Multi Map** (`deck_geoset_multi_map`) chart type composes multiple [[GeoSet Map Layer Chart|GeoSet Map Layer]] charts into a single interactive map. Each sub-layer retains its own styling, data source, and legend configuration.

<img width="1617" height="450" alt="Screenshot 2026-02-23 at 4 08 10 PM" src="https://github.com/user-attachments/assets/1004e75e-5050-4455-8c72-66d5d5ca3e50" />

## Creating a Multi Map Chart

1. First create each individual layer as a **GeoSet Map Layer** chart
2. In Superset, go to **Charts → + Chart**
3. Select your dataset (used only for dashboard filters) and choose **GeoSet Multi Map** as the chart type
4. In the **Map** panel, add your layer charts via **GeoSet Layer Charts**

<p>
  <img width="49%" height="350" alt="geoset-chart-selection" src="https://github.com/user-attachments/assets/7285be19-92e5-43ea-beec-4cd6e17b9243" />
  <img width="49%" height="350" alt="geoset-multi-chart-builder" src="https://github.com/user-attachments/assets/add345f5-fc9a-456f-95cd-fae80c29cdcf" />
</p>

## Map Controls

### Mapbox Style

Choose the base map style. All layers share the same base map.

### Enable Static Viewport

When checked, shows the **Viewport** control for setting a fixed map position. The map will not move when panning or zooming unless you explicitly save a new viewport.

### Viewport

Sets the map center, zoom, pitch, and bearing for the static viewport. See [[GeoSet Map Layer Chart#Viewport|Viewport]] for details on how the controls work.

### GeoSet Layer Charts

Select the [[GeoSet Map Layer Chart|GeoSet Map Layer]] charts to include. Only charts of type `deck_geoset_map_layer` appear in the list.

> **Note:** If Enable Static Viewport is off, the viewport selection control is hidden — the map will use the default viewport.

## Multi-Layer Legend

When a Multi Map chart is rendered on a dashboard, a unified legend is shown covering all active layers. Each layer's legend entries come from the `legend` field in its [[GeoSet Map Layer Chart#legend|GeoJSON Config]].

### Legend Features

- **Toggle visibility** — click a legend entry to show/hide that category on the map
- **Isolate** — double-click a legend entry to hide all other categories
- **Layer ordering** — drag layer groups in the legend to change their z-order (front to back)
- **Collapse/expand** — click a group title to collapse its entries

## Filters

The **Filters** section (Query panel) applies SQL filters scoped to the Multi Map chart's own dataset. To filter data within individual layer charts, configure filters on those charts directly or use Superset native dashboard filters scoped to the appropriate datasets.

## Tips

- Layer charts are rendered in the order they appear in the **GeoSet Layer Charts** list — bottom of the list renders on top
- Each layer chart can have its own zoom visibility range (Min/Max Zoom Slider), useful for showing different levels of detail at different zoom levels
- The Multi Map chart's own dataset only needs to exist for native dashboard filter compatibility — it doesn't need to contain geospatial data itself
