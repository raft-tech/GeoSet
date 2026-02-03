"""Marshmallow schema for Mapbox API key configuration."""

from marshmallow import fields, Schema


class MapboxApiKeySchema(Schema):
    """Schema for Mapbox API key response."""

    MAPBOX_API_KEY = fields.String()
