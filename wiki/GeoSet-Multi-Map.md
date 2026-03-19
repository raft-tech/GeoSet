# GeoSet Multi Map

The **GeoSet Multi Map** (`deck_geoset_multi_map`) chart type composes multiple [[GeoSet Map Layer|GeoSet Map Layer]] charts into a single interactive map. Each sub-layer retains its own styling, data source, and legend configuration.

<img width="1617" height="525" alt="Screenshot 2026-02-23 at 4 08 10 PM" src="https://github.com/user-attachments/assets/1004e75e-5050-4455-8c72-66d5d5ca3e50" />

## Creating a Multi Map Chart

1. First create each individual layer as a **GeoSet Map Layer** chart
2. In Superset, go to **Charts → + Chart**
3. Select your dataset (used only for dashboard filters) and choose **GeoSet Multi Map** as the chart type
4. In the **Map** panel, add your layer charts via **GeoSet Layer Charts**

<img width="1912" height="500" alt="geoset-chart-selection" src="https://github.com/user-attachments/assets/25878fcd-a972-47e0-9ae6-da94f7fa1c8d" />
<img width="1912" height="530" alt="geoset-mult-chart-builder" src="https://github.com/user-attachments/assets/b681929a-5bed-4942-94e6-e7ea88d27b6d" />

## Map Controls

### Mapbox Style

Choose the base map style. All layers share the same base map.

### Enable Static Viewport

When checked, shows the **Viewport** control for setting a fixed map position. The map will not move when panning or zooming unless you explicitly save a new viewport.

### Viewport

Sets the map center, zoom, pitch, and bearing for the static viewport. See [[GeoSet Map Layer#Viewport|Viewport]] for details on how the controls work.

### GeoSet Layer Charts

Select the [[GeoSet Map Layer|GeoSet Map Layer]] charts to include. Only charts of type `deck_geoset_map_layer` appear in the list.

Each layer has a **settings popover** (gear icon) with per-layer options:

| Setting | Description |
|---|---|
| **Auto Zoom** | Automatically zoom the map to fit this layer's features on load. Disabled when Lazy Loading is on or Static Viewport is enabled. |
| **Collapse Legend** | Start with the legend entry collapsed in the map legend. |
| **Hidden by Default** | Hide this layer when the map first loads. Toggle it on from the legend. |
| **Lazy Loading** | Load this layer in the background after other layers have loaded. Lazy layers are fetched in small batches so they don't compete with the initial render. Auto Zoom is automatically disabled for lazy-loaded layers. |

> **Note:** If Enable Static Viewport is off, the viewport selection control is hidden — the map will use the default viewport.

### Layer Loading Order

Layers load in three phases to balance fast rendering with a smooth viewport experience:

1. **Autozoom layers** — Layers with Auto Zoom enabled load first, in parallel. The map canvas waits for these to finish so it can calculate the correct viewport before rendering. This prevents a visible "jump" where the map snaps to a new position.
2. **Eager layers** — Remaining non-lazy layers (with Auto Zoom off) load in parallel after the map canvas appears. Each layer is added to the map as it finishes.
3. **Lazy layers** — Layers with Lazy Loading enabled load last, in small batches of 2. Each batch waits for the previous one to finish before starting, which avoids overwhelming the server with many simultaneous requests.

If no layers have Auto Zoom enabled, the map canvas renders immediately after fetching layer metadata, and all non-lazy layers begin loading right away.

## Multi-Layer Legend

When a Multi Map chart is rendered on a dashboard, a unified legend is shown covering all active layers. Each layer's legend entries come from the `legend` field in its [[GeoSet Map Layer#legend|GeoJSON Config]].

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
