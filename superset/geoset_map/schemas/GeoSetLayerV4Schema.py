"""Marshmallow schemas for GeoSet map layer configuration validation (V4).

V4 promotes ``pointSize`` to a top-level key and makes it polymorphic: either a
plain positive number (static size, same as before) or a configuration object
that maps a data column to a size range (dynamic, data-driven size).

Changes from V3:
- ``pointSize`` is removed from ``globalColoring`` and added as a top-level key.
- ``pointSize`` now accepts either a number or a ``PointSizeDynamicSchema`` object.
"""

import re
from typing import Any

from marshmallow import fields, Schema, validate, validates_schema, ValidationError

from superset.geoset_map.schemas.GeoSetLayerV1Schema import GlobalColoringSchema
from superset.geoset_map.schemas.GeoSetLayerV3Schema import GeoSetLayerV3Schema

_PERCENT_RE = re.compile(r"^(\d+(?:\.\d+)?)%$")


class NumberOrPercent(fields.Field):
    """Accepts a number or a percentage string like ``"25%"``.

    Numbers are returned as-is. Percentage strings are validated (0-100 range)
    and returned as-is for frontend resolution against the actual data.
    """

    def _deserialize(self, value, attr, data, **kwargs):
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return value
        if isinstance(value, str):
            match = _PERCENT_RE.match(value.strip())
            if match:
                pct = float(match.group(1))
                if not (0 <= pct <= 100):
                    raise ValidationError(
                        f"Percentage must be between 0% and 100%, got '{value}'."
                    )
                return value.strip()
            raise ValidationError(
                f"Invalid value '{value}'. Expected a number or a string like '25%'."
            )
        raise ValidationError(
            f"Invalid type for {attr}. Expected number or percentage string."
        )

    def _serialize(self, value, attr, obj, **kwargs):
        return value


class GlobalColoringSchemaV4(GlobalColoringSchema):
    """Schema for global/default layer styling (V4).

    Inherits from ``GlobalColoringSchema`` but excludes ``pointSize``, which has
    been promoted to a top-level field on the layer config in V4.

    Example::

        {
            "fillColor": [40, 147, 179, 255],
            "strokeColor": [0, 0, 0, 255],
            "strokeWidth": 2,
            "lineStyle": "solid",
            "fillPattern": "solid",
            "pointType": "circle"
        }
    """

    class Meta:
        exclude = ("point_size",)


class PointSizeDynamicSchema(Schema):
    """Schema for data-driven point size configuration.

    Maps a numeric data column to a point size range. Points are scaled
    linearly: the minimum observed value (or ``lowerBound``) maps to
    ``startSize`` pixels, the maximum (or ``upperBound``) maps to ``endSize``.

    Example::

        {
            "valueColumn": "fire_intensity",
            "startSize": 4,
            "endSize": 30,
            "lowerBound": null,
            "upperBound": null
        }
    """

    value_column = fields.String(required=True, data_key="valueColumn")
    start_size = fields.Number(
        required=True,
        data_key="startSize",
        validate=validate.Range(min=1, max=200),
    )
    end_size = fields.Number(
        required=True,
        data_key="endSize",
        validate=validate.Range(min=1, max=200),
    )
    lower_bound = NumberOrPercent(
        allow_none=True, load_default=None, data_key="lowerBound"
    )
    upper_bound = NumberOrPercent(
        allow_none=True, load_default=None, data_key="upperBound"
    )

    @validates_schema
    def validate_bounds(self, data, **kwargs):
        """Validate that upperBound > lowerBound when both are provided.

        When both bounds are the same type (both numeric or both percentage),
        validates ordering. Mixed types are skipped since percentages are
        resolved on the frontend against actual data.
        """
        lower = data.get("lower_bound")
        upper = data.get("upper_bound")
        if lower is None or upper is None:
            return

        lower_is_pct = isinstance(lower, str) and lower.endswith("%")
        upper_is_pct = isinstance(upper, str) and upper.endswith("%")

        # Only compare when both are the same type
        if lower_is_pct == upper_is_pct:
            lower_val = float(lower.rstrip("%")) if lower_is_pct else float(lower)
            upper_val = float(upper.rstrip("%")) if upper_is_pct else float(upper)
            if lower_val >= upper_val:
                raise ValidationError("upperBound must be greater than lowerBound.")


class PointSizeField(fields.Field):
    """Polymorphic field accepting a static number or a dynamic size config object.

    - Number (int or float): static pixel size applied to all points (e.g. ``6``).
    - Dict: dynamic size config matching ``PointSizeDynamicSchema``.
    """

    def _deserialize(self, value, attr, data, **kwargs):
        if isinstance(value, (int, float)):
            if value < 1:
                raise ValidationError("pointSize must be at least 1.")
            if value > 200:
                raise ValidationError("pointSize must be at most 200.")
            return value
        if isinstance(value, dict):
            schema = PointSizeDynamicSchema()
            try:
                return schema.load(value)
            except ValidationError as err:
                raise ValidationError(err.messages) from err
        raise ValidationError(
            "pointSize must be a positive number or a configuration object "
            "with valueColumn, startSize, and endSize."
        )

    def _serialize(self, value, attr, obj, **kwargs):
        if value is None:
            return None
        if isinstance(value, (int, float)):
            return value
        if isinstance(value, dict):
            return PointSizeDynamicSchema().dump(value)
        return value


class GeoSetLayerV4Schema(GeoSetLayerV3Schema):
    """Schema for GeoSet map layer configuration (version 4).

    Extends V3 by promoting ``pointSize`` from ``globalColoring`` to a top-level
    polymorphic field. Accepts either a plain positive number (static) or a
    ``PointSizeDynamicSchema`` object that scales point size by a data column.

    Example with static pointSize::

        {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid"
            },
            "pointSize": 6,
            "legend": {
                "title": "My Layer",
                "name": null
            }
        }

    Example with dynamic (data-driven) pointSize::

        {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid"
            },
            "pointSize": {
                "valueColumn": "fire_intensity",
                "startSize": 4,
                "endSize": 30,
                "lowerBound": null,
                "upperBound": null
            },
            "colorByValue": {
                "valueColumn": "fire_intensity",
                "startColor": [255, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": []
            },
            "legend": {
                "title": "Fire Intensity",
                "name": null
            }
        }
    """

    global_coloring = fields.Nested(
        GlobalColoringSchemaV4, required=True, data_key="globalColoring"
    )
    point_size = PointSizeField(load_default=None, data_key="pointSize")

    @validates_schema
    def validate_coloring_options(self, data, **kwargs):
        """Validate coloring options, legend configuration, and pointSize consistency.

        Ensures that:
        - Only one of color_by_category or color_by_value is provided, not both.
        - When color_by_category or color_by_value is provided, legend.name must be null.
        - When both dynamic pointSize and colorByValue are used, their valueColumn must match.
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

        # When both dynamic pointSize and colorByValue are used, their
        # valueColumn must be the same column.
        point_size = data.get("point_size")
        if has_value and isinstance(point_size, dict):
            size_col = point_size.get("value_column")
            value_col = data["color_by_value"].get("value_column")
            if size_col and value_col and size_col != value_col:
                raise ValidationError(
                    "When using both pointSize scaling and colorByValue, "
                    "they must reference the same valueColumn. "
                    f'Got pointSize.valueColumn="{size_col}" and '
                    f'colorByValue.valueColumn="{value_col}".'
                )

    @staticmethod
    def upgrade_from_previous_version(data: dict[str, Any]) -> dict[str, Any]:
        """Upgrade a V3 schema to V4 format.

        Moves ``pointSize`` from inside ``globalColoring`` to the top level.
        If ``pointSize`` was absent from ``globalColoring``, no top-level
        ``pointSize`` key is added (the field is optional).

        Args:
            data: A valid V3 schema dictionary.

        Returns:
            The schema converted to V4 format.
        """
        upgraded = data.copy()

        global_coloring = upgraded.get("globalColoring", {})
        if "pointSize" in global_coloring:
            upgraded["pointSize"] = global_coloring["pointSize"]
            upgraded["globalColoring"] = {
                k: v for k, v in global_coloring.items() if k != "pointSize"
            }

        return upgraded
