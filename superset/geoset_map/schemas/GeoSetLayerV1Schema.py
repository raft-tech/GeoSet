"""Marshmallow schemas for GeoSet map layer configuration validation."""

import re

from marshmallow import fields, Schema, validate, validates_schema, ValidationError

from superset.geoset_map.schemas.base import BaseGeoSetLayerSchema


class ColorField(fields.List):
    """RGBA color array with 4 integers between 0 and 255."""

    def __init__(self, **kwargs):
        super().__init__(
            fields.Integer(strict=True, validate=validate.Range(min=0, max=255)),
            validate=validate.Length(equal=4),
            **kwargs,
        )


class CategoryColorSchema(Schema):
    """Schema for individual category color configuration.

    Defines the fill color and legend entry name for a single category
    in categorical coloring mode.

    Example::

        "some_category": {
            "fillColor": [0, 0, 255, 255],
            "legend_entry_name": "category_1_legend_name"
        }
    """

    fill_color = ColorField(required=True, data_key="fillColor")
    legend_entry_name = fields.String(required=True)


class GlobalColoringSchema(Schema):
    """Schema for global/default layer styling.

    Defines the default appearance for all features in a layer,
    including fill color, stroke color, stroke width, line style, fill pattern,
    point type, and point size.

    Example::

        {
            "fillColor": [40, 147, 179, 255],
            "strokeColor": [0, 0, 0, 255],
            "strokeWidth": 2,
            "lineStyle": "solid",
            "fillPattern": "solid",
            "pointType": "circle",
            "pointSize": 10
        }
    """

    fill_color = ColorField(required=True, data_key="fillColor")
    stroke_color = ColorField(required=True, data_key="strokeColor")
    stroke_width = fields.Number(
        required=True, data_key="strokeWidth", validate=validate.Range(min=0)
    )
    line_style = fields.String(
        load_default=None,
        data_key="lineStyle",
        validate=validate.OneOf(["solid", "dashed", "dotted"]),
    )
    fill_pattern = fields.String(
        required=True, data_key="fillPattern", validate=validate.Equal("solid")
    )
    point_type = fields.String(
        load_default=None,
        data_key="pointType",
        # Accept any icon name - frontend handles invalid values
        # by falling back to default (circle)
    )
    point_size = fields.Integer(
        load_default=None,
        data_key="pointSize",
        validate=validate.Range(min=1, max=50),
    )


class ColorByCategorySchema(Schema):
    """Schema for categorical coloring configuration.

    Colors features based on discrete category values in a specified dimension column.
    Each category can have its own fill color and legend entry name.

    Example::

        {
            "dimension": "category_column",
            "categoricalColors": [
                {
                    "category_1_name": {
                        "fillColor": [0, 0, 255, 255],
                        "legend_entry_name": "category_1_legend_name"
                    }
                }
            ],
            "defaultLegendName": ["Other"]
        }
    """

    dimension = fields.String(required=True)
    categorical_colors = fields.List(
        fields.Dict(
            keys=fields.String(),
            values=fields.Nested(CategoryColorSchema),
        ),
        required=True,
        data_key="categoricalColors",
    )
    default_legend_name = fields.List(
        fields.String(), required=False, data_key="defaultLegendName"
    )


class ColorByValueSchema(Schema):
    """Schema for value-based coloring configuration.

    Colors features along a gradient based on numeric values in a specified column.
    Supports optional bounds and breakpoints for custom color scaling.

    Example::

        {
            "valueColumn": "population",
            "upperBound": 100,
            "lowerBound": 0,
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [25, 50, 75]
        }
    """

    value_column = fields.String(required=True, data_key="valueColumn")
    upper_bound = fields.Number(allow_none=True, data_key="upperBound")
    lower_bound = fields.Number(allow_none=True, data_key="lowerBound")
    # validate: start and end color should not be the same
    start_color = ColorField(required=True, data_key="startColor")
    end_color = ColorField(required=True, data_key="endColor")
    breakpoints = fields.List(fields.Number(), required=True)

    @validates_schema
    def validate_bounds_and_breakpoints(self, data, **kwargs):
        """Validate bounds and breakpoints relationships.

        Ensures:
        - upper_bound > lower_bound (when both provided)
        - breakpoints are in ascending order
        - all breakpoints fall within bounds (when both bounds provided)
        """
        upper = data.get("upper_bound")
        lower = data.get("lower_bound")
        breakpoints = data.get("breakpoints", [])

        if upper is not None and lower is not None and upper <= lower:
            raise ValidationError("upperBound must be greater than lowerBound.")

        if breakpoints != sorted(breakpoints):
            raise ValidationError("breakpoints must be listed lowest to highest.")

        if upper is not None and lower is not None and breakpoints:
            for bp in breakpoints:
                if bp < lower or bp > upper:
                    raise ValidationError(
                        "All breakpoints must be between lowerBound and upperBound."
                    )


class LegendSchema(Schema):
    """Schema for legend configuration.

    Defines the name for the layer's legend entry.

    Example::

        {
            "name": "legend_name"
        }
    """

    name = fields.String(required=True)


class GeoSetLayerV1Schema(BaseGeoSetLayerSchema):
    """Schema for GeoSet map layer configuration (version 1).

    Validates the complete configuration for a GeoSet map layer, including
    global coloring, optional categorical or value-based coloring, and legend settings.

    Note: Only one of color_by_category or color_by_value can be provided, not both.

    Example with colorByCategory::

        {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
                "pointType": "circle",
                "pointSize": 10
            },
            "colorByCategory": {
                "dimension": "category_column",
                "categoricalColors": [
                    {
                        "category_1_name": {
                            "fillColor": [0, 0, 255, 255],
                            "legend_entry_name": "category_1_legend_name"
                        }
                    }
                ],
                "defaultLegendName": ["Other"]
            },
            "legend": {
                "name": "legend_name"
            }
        }

    Example with colorByValue::

        {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
                "pointType": "fema",
                "pointSize": 15
            },
            "colorByValue": {
                "valueColumn": "population",
                "upperBound": 100,
                "lowerBound": 0,
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": [25, 50, 75]
            },
            "legend": {
                "name": "legend_name"
            }
        }
    """

    global_coloring = fields.Nested(
        GlobalColoringSchema, required=True, data_key="globalColoring"
    )
    color_by_category = fields.Nested(
        ColorByCategorySchema, load_default=None, data_key="colorByCategory"
    )
    color_by_value = fields.Nested(
        ColorByValueSchema, load_default=None, data_key="colorByValue"
    )
    legend = fields.Nested(LegendSchema, required=True)

    @validates_schema
    def validate_coloring_options(self, data, **kwargs):
        """Validate coloring options.

        Ensures that only one of color_by_category or color_by_value is provided,
        not both.
        """
        has_category = data.get("color_by_category") is not None
        has_value = data.get("color_by_value") is not None

        if has_category and has_value:
            raise ValidationError(
                "Only one of colorByCategory or colorByValue can be provided, not both."
            )
