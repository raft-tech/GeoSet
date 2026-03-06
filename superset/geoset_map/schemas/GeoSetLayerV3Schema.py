"""Marshmallow schemas for GeoSet map layer configuration validation (V3).

V3 adds optional text overlay styling configuration for text annotations
rendered on the map.
"""

import copy
from typing import Any

from marshmallow import fields, Schema, validate

from superset.geoset_map.schemas.GeoSetLayerV2Schema import GeoSetLayerV2Schema


class TextOverlayStyleSchema(Schema):
    """Schema for text overlay styling configuration.

    Controls the appearance of text annotations rendered on the map.
    Color is inherited from globalColoring.fillColor and is not duplicated here.

    Example::

        {
            "fontFamily": "Arial, sans-serif",
            "fontSize": 14,
            "bold": false,
            "offset": [0, 0]
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
    offset = fields.List(
        fields.Integer(validate=validate.Range(min=-500, max=500)),
        load_default=[0, 0],
        validate=validate.Length(equal=2),
    )


class GeoSetLayerV3Schema(GeoSetLayerV2Schema):
    """Schema for GeoSet map layer configuration (version 3).

    Extends V2 with optional text overlay styling.

    Changes from V2:
    - Added optional textOverlayStyle for text annotation appearance
    """

    text_overlay_style = fields.Nested(
        TextOverlayStyleSchema, load_default=None, data_key="textOverlayStyle"
    )

    @staticmethod
    def upgrade_from_previous_version(data: dict[str, Any]) -> dict[str, Any]:
        """Upgrade a V2 schema to V3 format.

        Simple passthrough — V2 data is valid V3 as-is since textOverlayStyle
        is optional with load_default=None.

        Args:
            data: A valid V2 schema dictionary

        Returns:
            The schema in V3 format (unchanged copy)
        """
        # deepcopy so nested dicts aren't shared with the caller
        return copy.deepcopy(data)
