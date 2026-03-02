"""Marshmallow schemas for GeoSet map layer configuration validation (V2).

V2 adds a title field to the legend schema and requires legend.name to be null
when colorByCategory or colorByValue is used.
"""

from typing import Any

from marshmallow import fields, Schema, validate, validates_schema, ValidationError

from superset.geoset_map.schemas.base import BaseGeoSetLayerSchema
from superset.geoset_map.schemas.GeoSetLayerV1Schema import (
    ColorByCategorySchema,
    ColorByValueSchema,
    GlobalColoringSchema,
)


class TextOverlayStyleSchema(Schema):
    """Schema for text overlay styling configuration.

    Controls the appearance of text annotations rendered on the map.
    Color is inherited from globalColoring.fillColor and is not duplicated here.

    Example::

        {
            "fontFamily": "Arial, sans-serif",
            "fontSize": 14,
            "bold": false
        }
    """

    font_family = fields.String(
        load_default="Arial, sans-serif",
        data_key="fontFamily",
    )
    font_size = fields.Integer(
        load_default=14,
        data_key="fontSize",
        validate=validate.Range(min=1, max=128),
    )
    bold = fields.Boolean(load_default=False)


class LegendSchemaV2(Schema):
    """Schema for legend configuration (V2).

    Defines the title and human-readable name for the layer's legend entry.
    When colorByCategory or colorByValue is used, name must be null.

    Example::

        {
            "title": "legend_title",
            "name": "human_readable_legend_name"
        }
    """

    title = fields.String(required=True)
    name = fields.String(load_default=None, allow_none=True)


class GeoSetLayerV2Schema(BaseGeoSetLayerSchema):
    """Schema for GeoSet map layer configuration (version 2).

    Validates the complete configuration for a GeoSet map layer, including
    global coloring, optional categorical or value-based coloring, and legend settings.

    Changes from V1:
    - Legend now has a required 'title' field
    - Legend 'name' is optional and must be null when colorByCategory or
      colorByValue is provided

    Note: Only one of color_by_category or color_by_value can be provided, not both.

    Example with colorByCategory::

        {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid"
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
                "title": "legend_title",
                "name": null
            }
        }

    Example with colorByValue::

        {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid"
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
                "title": "legend_title",
                "name": null
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
    legend = fields.Nested(LegendSchemaV2, required=True)
    text_overlay_style = fields.Nested(
        TextOverlayStyleSchema, load_default=None, data_key="textOverlayStyle"
    )

    @validates_schema
    def validate_coloring_options(self, data, **kwargs):
        """Validate coloring options and legend configuration.

        Ensures that:
        - Only one of color_by_category or color_by_value is provided, not both
        - When color_by_category or color_by_value is provided, legend.name must be null
        """
        has_category = data.get("color_by_category") is not None
        has_value = data.get("color_by_value") is not None

        if has_category and has_value:
            raise ValidationError(
                "Only one of colorByCategory or colorByValue can be provided, not both."
            )

        if has_category or has_value:
            legend = data.get("legend", {})
            if legend.get("name") is not None:
                raise ValidationError(
                    "legend.name must be null when colorByCategory or colorByValue "
                    "is provided."
                )

    @staticmethod
    def upgrade_from_previous_version(data: dict[str, Any]) -> dict[str, Any]:
        """Upgrade a V1 schema to V2 format.

        Converts V1 legend format (name only) to V2 format (title + name).
        The V1 name becomes the V2 title. If colorByCategory or colorByValue
        is present, V2 name is set to null; otherwise V2 name is set to the
        same value as title.

        Args:
            data: A valid V1 schema dictionary

        Returns:
            The schema converted to V2 format
        """
        upgraded = data.copy()

        if "legend" in upgraded:
            v1_name = upgraded["legend"].get("name", "")
            has_coloring = (
                data.get("colorByCategory") is not None
                or data.get("colorByValue") is not None
            )
            upgraded["legend"] = {
                "title": v1_name,
                "name": None if has_coloring else v1_name,
            }

        return upgraded
