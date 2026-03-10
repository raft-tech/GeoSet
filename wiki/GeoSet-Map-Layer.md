# GeoSet Map Layer Chart

The **GeoSet Map Layer** (`deck_geoset_map_layer`) is the core chart type for rendering geospatial data. It renders a single layer of geographic features on an interactive map and is the building block for [[GeoSet Multi Map Chart|multi-layer maps]].

<img width="1615" height="450" alt="Screenshot 2026-02-23 at 4 07 24 PM" src="https://github.com/user-attachments/assets/f30a0684-cac2-4106-bd96-6bd614e1d24e" />

## Creating a Chart
1. In Superset, go to **Charts → + Chart**
2. Select your dataset and choose **GeoSet Map Layer** as the chart type
3. In the **Map Configuration** panel, configure your layer

<p>
  <img width="49%" height="400" alt="geoset-chart-selection" src="https://github.com/user-attachments/assets/7285be19-92e5-43ea-beec-4cd6e17b9243" />
  <img width="49%" height="400" alt="geojson-config-control-chart-builder" src="https://github.com/user-attachments/assets/6d4aceef-c572-4e87-8898-cec13b70bafc" />
</p>

## Map Configuration Controls

### GeoJSON Column

Select the column in your dataset that contains GeoJSON geometry. This can be a geometry column (PostGIS) or a text column containing GeoJSON strings.

### Layer Type

| Type        | Description                                                              |
| ----------- | ------------------------------------------------------------------------ |
| **Polygon** | Filled polygons with configurable stroke. Best for boundary/area data.   |
| **Point**   | Individual points or icons at coordinate locations. Supports clustering. |
| **Line**    | Polylines and paths. Supports dashed/dotted styles.                      |
| **GeoJSON** | Raw GeoJSON — auto-detects geometry type from the data.                  |

### Row Limit

Maximum number of features to load. For large datasets, increase this or use server-side filtering with **Filters**.

### Autozoom

When enabled, the map automatically fits its viewport to the extent of the loaded features on each query. When disabled, you control the viewport manually.

### Viewport

Sets the initial map center, zoom, pitch, and bearing. Only visible when Autozoom is off.

- **Capture Map Viewport** — click to snap the popover values to the current map position
- **Enable Static Viewport** — locks the map to the saved viewport; panning and zooming will not change the saved position
- **Save** — persists the viewport values
- **Close** — reverts to the last saved viewport

### Mapbox Style

Choose the base map style (streets, satellite, dark, light, etc.). Requires a valid Mapbox API key in your environment.

### Min/Max Zoom Slider

Sets the zoom range at which this layer is visible. Useful for multi-layer maps where you want different levels of detail at different zoom levels.

### Point Clustering

Only available for the **Point** layer type.

| Control           | Description                                                       |
| ----------------- | ----------------------------------------------------------------- |
| Enable Clustering | Groups nearby points into cluster circles                         |
| Cluster Radius    | Pixel radius for grouping points into a cluster                   |
| Min Zoom          | Zoom level at which clustering stops and individual points appear |
| Min Points        | Minimum number of points required to form a cluster               |

### Hover Data Columns

Columns to display in the tooltip when hovering over a feature.

### Feature Info Columns

Columns to display in the click popup when a feature is clicked.

## GeoJSON Config

The **GeoJSON Config** editor controls how features are styled and labeled. It accepts a JSON object with the following top-level keys.

### `globalColoring`

Applies a single style to all features. Used when you don't need per-category or per-value coloring.

```json
{
  "globalColoring": {
    "fillColor": [40, 147, 179, 255],
    "strokeColor": [0, 0, 0, 255],
    "strokeWidth": 2,
    "lineStyle": "solid",
    "fillPattern": "solid",
    "pointType": "circle",
    "pointSize": 10
  }
}
```

| Field         | Type           | Description                                                                                                                  |
| ------------- | -------------- | ---------------------------------------------------------------------------------------------------------------------------- |
| `fillColor`   | `[R, G, B, A]` | Fill color as RGBA (0–255)                                                                                                   |
| `strokeColor` | `[R, G, B, A]` | Stroke/outline color as RGBA                                                                                                 |
| `strokeWidth` | number         | Stroke width in pixels                                                                                                       |
| `lineStyle`   | string         | Line rendering style: `"solid"`, `"dashed"`, or `"dotted"`. Optional, defaults to `null`.                                    |
| `fillPattern` | string         | `"solid"` (required)                                                                                                         |
| `pointType`   | string         | Icon name for point layers (e.g., `"circle"`, `"point"`, or any registered SVG icon). Optional, defaults to `null` (circle). |
| `pointSize`   | integer        | Static size of point icons in pixels (1–50). Optional, defaults to `null`.                                                   |

### `colorByCategory`

Colors features by a categorical column. Each category maps to a color and an optional legend label.

```json
{
  "colorByCategory": {
    "dimension": "fire_cause",
    "categoricalColors": [
      {
        "Human": {
          "fillColor": [255, 100, 0, 255],
          "legend_entry_name": "Human Caused"
        }
      },
      {
        "Natural": {
          "fillColor": [0, 180, 80, 255],
          "legend_entry_name": "Natural"
        }
      }
    ],
    "defaultLegendName": ["Other"]
  }
}
```

| Field               | Description                                                             |
| ------------------- | ----------------------------------------------------------------------- |
| `dimension`         | The dataset column name to color by                                     |
| `categoricalColors` | Array of `{ category_value: { fillColor, legend_entry_name } }` objects |
| `defaultLegendName` | Label shown in the legend for values not in `categoricalColors`         |

### `colorByValue`

Colors features using a gradient based on a numeric column value.

```json
{
  "colorByValue": {
    "valueColumn": "max_wind_speed",
    "upperBound": 150,
    "lowerBound": 0,
    "startColor": [255, 255, 0, 255],
    "endColor": [255, 0, 0, 255],
    "breakpoints": []
  }
}
```

| Field         | Description                                                             |
| ------------- | ----------------------------------------------------------------------- |
| `valueColumn` | The numeric column to map to color                                      |
| `upperBound`  | Value that maps to `endColor`. Set to `null` to use the data maximum.   |
| `lowerBound`  | Value that maps to `startColor`. Set to `null` to use the data minimum. |
| `startColor`  | RGBA color for the lowest value                                         |
| `endColor`    | RGBA color for the highest value                                        |
| `breakpoints` | Optional array of intermediate `{ value, color }` stops                 |

### `legend`

Controls how this chart's layer appears in a multi-layer legend.

```json
{
  "legend": {
    "title": "Storm Data",
    "name": "Storm Track Points"
  }
}
```

| Field   | Description                                    |
| ------- | ---------------------------------------------- |
| `title` | Group heading in the multi-layer legend        |
| `name`  | Label for this specific layer within the group |

### `textOverlayStyle`

Controls the appearance of text annotations rendered on the map. Only applies when a Text Label Column is selected in the chart controls. Color is inherited from `globalColoring.fillColor`.

```json
{
  "textOverlayStyle": {
    "fontFamily": "Arial, sans-serif",
    "fontSize": 14,
    "bold": false,
    "offset": [0, 0]
  }
}
```

| Field        | Type     | Default               | Description                                  |
| ------------ | -------- | --------------------- | -------------------------------------------- |
| `fontFamily` | string   | `"Arial, sans-serif"` | CSS font family for text labels              |
| `fontSize`   | integer  | `14`                  | Font size in pixels (1–128)                  |
| `bold`       | boolean  | `false`               | Whether to render text in bold               |
| `offset`     | `[x, y]` | `[0, 0]`              | Pixel offset from the feature's anchor point |

## Schema Versioning

The GeoJSON Config is validated on the backend through versioned Marshmallow schemas (V1, V2, V3, etc.). When you save a chart, the frontend includes a `schema_version` number. If a chart was saved with an older schema version, the backend can automatically upgrade it to the latest version via the `/geoset_map/schema/<from>/<to>` conversion endpoint. This means older chart configurations continue to work as new fields are added in later schema versions.
