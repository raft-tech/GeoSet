# JSON Config Spec

Reference for the GeoSet Map Layer JSON configuration object. This is the schema that controls how geographic features are styled, colored, and labeled.

- [Overview of Schema Fields](#overview-of-schema-fields)
  - [Constraints](#constraints)
- [Field Specifications](#field-specifications)
  - [globalColoring](#globalcoloring)
  - [colorByCategory](#colorbycategory)
  - [colorByValue](#colorbyvalue)
  - [pointSize](#pointsize)
  - [textOverlayStyle](#textoverlaystyle)
  - [legend](#legend)

## Overview of Schema Fields

| Field              | Type             | Required | Description                                 |
| ------------------ | ---------------- | -------- | ------------------------------------------- |
| `globalColoring`   | object           | **yes**  | Default styling for all features            |
| `colorByCategory`  | object           | no       | Color features by a categorical column      |
| `colorByValue`     | object           | no       | Color features by a numeric column gradient |
| `pointSize`        | number or object | no       | Static or data-driven point sizing          |
| `textOverlayStyle` | object           | no       | Text annotation appearance                  |
| `legend`           | object           | **yes**  | Legend entry configuration                  |

### Constraints

- `colorByCategory` and `colorByValue` are **mutually exclusive** — you cannot specify both.
- `legend.name` must be `null` when `colorByCategory` or `colorByValue` is present.
- When both `pointSize` (dynamic) and `colorByValue` are present, they must reference the same `valueColumn`.

## Field Specifications

The following sections provide an overview of each field with details pertaining to its usage.

### globalColoring

This section controls the defaults applied to all features before any category or value coloring.

Here, all features are rendered as teal circles with a black outline, 2px stroke, and solid fill:

```json
{
  "globalColoring": {
    "fillColor": [40, 147, 179, 255],
    "strokeColor": [0, 0, 0, 255],
    "strokeWidth": 2,
    "lineStyle": "solid",
    "fillPattern": "solid",
    "pointType": "circle"
  }
}
```

| Field         | Type           | Required | Default | Description                                                                                                                                                                                          |
| ------------- | -------------- | -------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `fillColor`   | `[R, G, B, A]` | **yes**  | —       | Fill color. Each value 0–255.                                                                                                                                                                        |
| `strokeColor` | `[R, G, B, A]` | **yes**  | —       | Stroke/outline color. Each value 0–255.                                                                                                                                                              |
| `strokeWidth` | number         | **yes**  | —       | Stroke width in pixels. Must be ≥ 0.                                                                                                                                                                 |
| `lineStyle`   | string         | no       | `null`  | `"solid"`, `"dashed"`, or `"dotted"`.                                                                                                                                                                |
| `fillPattern` | string         | **yes**  | —       | Must be `"solid"`.                                                                                                                                                                                   |
| `pointType`   | string         | no       | `null`  | Point/MultiPoint layers only. Icon name: `"circle"`, `"point"`, `"marker"`, `"square"`, or `"triangle"`. Invalid values fall back to `"circle"`. Ignored for Polygon, Line, and GeoJSON layer types. |

### colorByCategory

Colors features based on a column's discrete values. Each category gets its own fill color and legend label.

For example, given a wildfire locations dataset with a `fire_cause` column, this config colors each fire by its cause. The keys in `categoricalColors` (`"Human"`, `"Natural"`) must match the actual values in the `fire_cause` column. Human-caused fires are rendered in orange, natural fires in green, and any other `fire_cause` values fall under the "Other" legend entry using the `fillColor` from `globalColoring`:

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

| Field               | Type             | Required | Description                                                            |
| ------------------- | ---------------- | -------- | ---------------------------------------------------------------------- |
| `dimension`         | string           | **yes**  | Column name to group by.                                               |
| `categoricalColors` | array            | **yes**  | List of `{ categoryValue: { fillColor, legend_entry_name } }` objects. |
| `defaultLegendName` | array of strings | no       | Legend label(s) for values not listed in `categoricalColors`.          |

Each entry in `categoricalColors` is an object with a single key (the category value) mapping to:

| Field               | Type           | Required | Description                   |
| ------------------- | -------------- | -------- | ----------------------------- |
| `fillColor`         | `[R, G, B, A]` | **yes**  | Fill color for this category. |
| `legend_entry_name` | string         | **yes**  | Display name in the legend.   |

### colorByValue

> **Note:** PR [#319](https://github.com/raft-tech/GeoSet/pull/319) adds percentile-based bounds (e.g. `"25%"`) to `colorByValue`, matching the existing support in dynamic `pointSize`. Update this section once that PR is merged.

Colors features using a gradient with values corresponding to a numerical column.

Given a hurricane dataset with a `max_wind_speed` column (in mph), this config colors storms on a yellow-to-red gradient. Storms with 0 mph wind are yellow, 150 mph storms are red, and values in between are interpolated with breakpoints at 50 and 100 mph:

```json
{
  "colorByValue": {
    "valueColumn": "max_wind_speed",
    "startColor": [255, 255, 0, 255],
    "endColor": [255, 0, 0, 255],
    "lowerBound": 0,
    "upperBound": 150,
    "breakpoints": [50, 100]
  }
}
```

| Field         | Type             | Required | Description                                                 |
| ------------- | ---------------- | -------- | ----------------------------------------------------------- |
| `valueColumn` | string           | **yes**  | Numeric column to map to color.                             |
| `startColor`  | `[R, G, B, A]`   | **yes**  | Color at the low end of the gradient.                       |
| `endColor`    | `[R, G, B, A]`   | **yes**  | Color at the high end of the gradient.                      |
| `lowerBound`  | number or `null` | no       | Value mapped to `startColor`. `null` uses the data minimum. |
| `upperBound`  | number or `null` | no       | Value mapped to `endColor`. `null` uses the data maximum.   |
| `breakpoints` | array of numbers | **yes**  | Intermediate stops for the gradient. Can be empty (`[]`).   |

#### Constraints

- `upperBound` must be greater than `lowerBound` (when both are provided).
- `breakpoints` must be in ascending order.
- All breakpoints must fall between `lowerBound` and `upperBound` (when both bounds are provided).

### pointSize

Controls the size of point features. Accepts either a static number or a dynamic configuration object.

#### Static

With static sizing, the same point size is applied to all points. 

```json
{
  "pointSize": 10
}
```

#### Dynamic (data-driven)

In dynamic sizing, point size varies based on a numeric column. Dynamic sizing accepts both `lowerBound` and `upperBound` properties that can be set to either numeric values or as string literals representing percentiles (e.g. `"30%"`).

For example, given a wildfire dataset with a `fire_intensity` column, this config scales points from 4px (lowest intensity in the data) to 30px (highest). With bounds set to `null`, the size range is mapped to the actual min/max values in the data.

```json
{
  "pointSize": {
    "valueColumn": "fire_intensity",
    "startSize": 4,
    "endSize": 30,
    "lowerBound": null,
    "upperBound": null
  }
}
```

| Field         | Type                                 | Required | Default | Description                                            |
| ------------- | ------------------------------------ | -------- | ------- | ------------------------------------------------------ |
| `valueColumn` | string                               | **yes**  | —       | Numeric column to drive sizing.                        |
| `startSize`   | number                               | **yes**  | —       | Pixel size at the low end. 1–200.                      |
| `endSize`     | number                               | **yes**  | —       | Pixel size at the high end. 1–200.                     |
| `lowerBound`  | number, percentage string, or `null` | no       | `null`  | Value mapped to `startSize`. `null` uses data minimum. |
| `upperBound`  | number, percentage string, or `null` | no       | `null`  | Value mapped to `endSize`. `null` uses data maximum.   |

**Percentage bounds:** You can use strings like `"10%"` or `"90%"` for bounds. These are resolved against the actual data range on the frontend (e.g. `"10%"` means the 10th percentile of the data). This is useful when the data is either skewed or contains outliers.

#### Constraints

- `endSize` must be greater than `startSize`.
- `upperBound` must be greater than `lowerBound` (when both are the same type — both numbers or both percentages).
- Mixed types (one number, one percentage) skip bound comparison since percentages are resolved at render time.

### textOverlayStyle

Controls the appearance of text annotations on the map. Text color is configured via `globalColoring.fillColor`.

The following snippet illustrates the specification for text labels in 14px Arial, shifted 20 pixels above each feature's anchor point:

```json
{
  "textOverlayStyle": {
    "fontFamily": "Arial, sans-serif",
    "fontSize": 14,
    "bold": false,
    "offset": [0, -20]
  }
}
```

| Field        | Type     | Required | Default               | Description                                                   |
| ------------ | -------- | -------- | --------------------- | ------------------------------------------------------------- |
| `fontFamily` | string   | no       | `"Arial, sans-serif"` | CSS font family.                                              |
| `fontSize`   | integer  | no       | `14`                  | Font size in pixels. 1–128.                                   |
| `bold`       | boolean  | no       | `false`               | Whether to bold the text.                                     |
| `offset`     | `[x, y]` | no       | `[0, 0]`              | Pixel offset from the feature anchor. Each value -500 to 500. |

### legend

This section controls the name of the legend entry.

The following creates a legend group titled "Storm Tracks" with a single entry labeled "Category 3+". When using `colorByCategory` or `colorByValue`, exclude `name` since those modes generate their own legend sub entries.

```json
{
  "legend": {
    "title": "Storm Tracks",
    "name": "Category 3+"
  }
}
```

| Field   | Type             | Required | Default | Description                                                                                                                                                 |
| ------- | ---------------- | -------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `title` | string           | **yes**  | —       | Group heading in the legend.                                                                                                                                |
| `name`  | string or `null` | no       | `null`  | Label for this layer within the group. **Must be `null`** when `colorByCategory` or `colorByValue` is used (those modes generate their own legend entries). |
