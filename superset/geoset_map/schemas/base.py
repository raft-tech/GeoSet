"""Base schema and shared fields for GeoSet map layer configuration validation."""

import re

from marshmallow import fields, post_dump, Schema, ValidationError

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


class BaseGeoSetLayerSchema(Schema):
    """Base schema for GeoSet map layers with common serialization behavior.

    All GeoSetLayer schema versions should inherit from this class to ensure
    consistent serialization behavior, including automatic removal of null
    values from the output.
    """

    @post_dump
    def remove_none_values(self, data, **kwargs):
        """Recursively remove keys with None values from serialized output."""

        def remove_nulls(obj):
            if isinstance(obj, dict):
                return {k: remove_nulls(v) for k, v in obj.items() if v is not None}
            if isinstance(obj, list):
                return [remove_nulls(item) for item in obj]
            return obj

        return remove_nulls(data)
