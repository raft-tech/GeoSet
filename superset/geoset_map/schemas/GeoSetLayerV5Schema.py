"""Marshmallow schemas for GeoSet map layer configuration validation (V5).

V5 extends ``colorByValue`` bounds and breakpoints to accept percentile strings
(e.g. ``"25%"``) in addition to plain numbers.  This uses the same
``NumberOrPercent`` field introduced in V4 for ``pointSize`` bounds.

Changes from V4:
- ``colorByValue.lowerBound``, ``colorByValue.upperBound``, and
  ``colorByValue.breakpoints`` now accept numbers **or** percentage strings.
"""

from typing import Any

from marshmallow import fields, Schema, validates_schema, ValidationError

from superset.geoset_map.schemas.GeoSetLayerV1Schema import ColorField
from superset.geoset_map.schemas.GeoSetLayerV4Schema import (
    GeoSetLayerV4Schema,
    NumberOrPercent,
)


class ColorByValueSchemaV5(Schema):
    """Schema for value-based coloring configuration (V5).

    Identical to the V1 ``ColorByValueSchema`` except that ``lowerBound``,
    ``upperBound``, and ``breakpoints`` now accept percentile strings
    (e.g. ``"10%"``, ``"90%"``) in addition to plain numbers.

    Example::

        {
            "valueColumn": "population",
            "upperBound": "90%",
            "lowerBound": "10%",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": ["25%", "50%", "75%"]
        }
    """

    value_column = fields.String(required=True, data_key="valueColumn")
    upper_bound = NumberOrPercent(
        allow_none=True, load_default=None, data_key="upperBound"
    )
    lower_bound = NumberOrPercent(
        allow_none=True, load_default=None, data_key="lowerBound"
    )
    start_color = ColorField(required=True, data_key="startColor")
    end_color = ColorField(required=True, data_key="endColor")
    breakpoints = fields.List(NumberOrPercent(), required=True)

    @validates_schema
    def validate_bounds_and_breakpoints(self, data, **kwargs):
        """Validate bounds and breakpoints relationships.

        Ensures:
        - upper_bound > lower_bound (when both provided and comparable)
        - breakpoints are in ascending order (when all same type)
        - all breakpoints fall within bounds (when all numeric)
        """
        upper = data.get("upper_bound")
        lower = data.get("lower_bound")
        breakpoints = data.get("breakpoints", [])

        def is_pct(val):
            return isinstance(val, str) and val.endswith("%")

        def pct_val(val):
            return float(val.rstrip("%"))

        any_pct = (
            is_pct(upper) or is_pct(lower) or any(is_pct(bp) for bp in breakpoints)
        )

        if not any_pct:
            # All numeric — full validation (backward compatible)
            if upper is not None and lower is not None and upper <= lower:
                raise ValidationError("upperBound must be greater than lowerBound.")

            if breakpoints != sorted(breakpoints):
                raise ValidationError("breakpoints must be listed lowest to highest.")

            if upper is not None and lower is not None and breakpoints:
                for bp in breakpoints:
                    if bp < lower or bp > upper:
                        raise ValidationError(
                            "All breakpoints must be between lowerBound "
                            "and upperBound."
                        )
        else:
            # Some values are percentages — validate what we can
            if (
                upper is not None
                and lower is not None
                and is_pct(upper) == is_pct(lower)
            ):
                u = pct_val(upper) if is_pct(upper) else upper
                l = pct_val(lower) if is_pct(lower) else lower
                if u <= l:
                    raise ValidationError(
                        "upperBound must be greater than lowerBound."
                    )

            # Validate breakpoint ordering when all are the same type
            if breakpoints:
                if all(is_pct(bp) for bp in breakpoints):
                    pcts = [pct_val(bp) for bp in breakpoints]
                    if pcts != sorted(pcts):
                        raise ValidationError(
                            "breakpoints must be listed lowest to highest."
                        )
                elif all(isinstance(bp, (int, float)) for bp in breakpoints):
                    if breakpoints != sorted(breakpoints):
                        raise ValidationError(
                            "breakpoints must be listed lowest to highest."
                        )


class GeoSetLayerV5Schema(GeoSetLayerV4Schema):
    """Schema for GeoSet map layer configuration (version 5).

    Extends V4 by upgrading ``colorByValue`` bounds and breakpoints to accept
    percentile strings (e.g. ``"10%"``, ``"90%"``) via ``NumberOrPercent``.

    Example with percentage colorByValue bounds::

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
                "lowerBound": "10%",
                "upperBound": "90%",
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": ["25%", "50%", "75%"]
            },
            "legend": {
                "title": "Population",
                "name": null
            }
        }
    """

    color_by_value = fields.Nested(
        ColorByValueSchemaV5, load_default=None, data_key="colorByValue"
    )

    @staticmethod
    def upgrade_from_previous_version(data: dict[str, Any]) -> dict[str, Any]:
        """Upgrade a V4 schema to V5 format.

        V5 only widens the accepted types for ``colorByValue`` bounds and
        breakpoints (numbers → numbers or percentages).  Existing V4 data
        with numeric-only values is already valid V5, so this is a simple
        passthrough.

        Args:
            data: A valid V4 schema dictionary.

        Returns:
            The schema in V5 format (unchanged).
        """
        return data.copy()
