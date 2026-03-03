import logging
import os
import re

from flask import request, Response
from flask_appbuilder.api import expose, protect, safe
from marshmallow import ValidationError

from superset.constants import MODEL_API_RW_METHOD_PERMISSION_MAP
from superset.geoset_map.schemas import (
    GeoSetLayerV1Schema,
    GeoSetLayerV2Schema,
    GeoSetLayerV3Schema,
    MapboxApiKeySchema,
)
from superset.extensions import event_logger
from superset.views.base_api import BaseSupersetApi, requires_json, statsd_metrics

logger = logging.getLogger(__name__)

VERSION_PATTERN = re.compile(r"^v(\d+)$")


def parse_version_number(version: str) -> int | None:
    """Extract the numeric version from a version string like 'v1', 'v2', etc.

    Returns None if the version string doesn't match the expected format.
    """
    match = VERSION_PATTERN.match(version)
    return int(match.group(1)) if match else None


class GeoSetMapRestApi(BaseSupersetApi):
    mapbox_api_key_schema = MapboxApiKeySchema()
    # when new GeoSetLayer schemas are created they need to be added to this mapping
    geoset_layer_schemas = {
        "v1": GeoSetLayerV1Schema(),
        "v2": GeoSetLayerV2Schema(),
        "v3": GeoSetLayerV3Schema(),
    }
    # mapping of (from_version, to_version) to upgrade function
    # when new upgrade paths are added, add them here
    schema_upgrade_paths = {
        ("v1", "v2"): GeoSetLayerV2Schema.upgrade_from_previous_version,
        ("v1", "v3"): GeoSetLayerV2Schema.upgrade_from_previous_version,
        ("v2", "v3"): GeoSetLayerV3Schema.upgrade_from_previous_version,
    }

    method_permission_name = MODEL_API_RW_METHOD_PERMISSION_MAP
    allow_browser_login = True
    class_permission_name = "GeoSetMap"
    resource_name = "geoset_map"
    openapi_spec_tag = "GeoSet Map"
    openapi_spec_component_schemas = (
        GeoSetLayerV1Schema,
        GeoSetLayerV2Schema,
        GeoSetLayerV3Schema,
        MapboxApiKeySchema,
    )

    @expose("/mapbox_api_key/", methods=("GET",))
    @protect()
    @safe
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".mapbox_api_key",
        log_to_statsd=True,
    )
    def mapbox_api_key(self) -> Response:
        """
        Get the Mapbox API key from environment variables.
        ---
        get:
          summary: Get Mapbox API key
          responses:
            200:
              description: The Mapbox API key
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/MapboxApiKeySchema'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
        """
        result = self.mapbox_api_key_schema.dump(
            {"MAPBOX_API_KEY": os.environ.get("MAPBOX_API_KEY", "")}
        )
        return self.response(200, result=result)

    @expose("/schema/<version>", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".validate_schema",
        log_to_statsd=True,
    )
    @requires_json
    def validate_schema(self, version: str) -> Response:
        """
        Validate a GeoSetLayer JSON payload against a specific GeoSet layer schema.
        ---
        post:
          summary: Validate JSON against a GeoSet layer schema
          parameters:
            - in: path
              name: version
              schema:
                type: string
              required: true
              description: Schema version (e.g., "v1")
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            200:
              description: Schema validation successful
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        $ref: '#/components/schemas/GeoSetLayerV1Schema'
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              description: Validation errors
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: object
                        description: Validation error details
        """
        schema = self.geoset_layer_schemas.get(version)
        if schema is None:
            return self.response_404()

        if request.json is None:
            return self.response_400(message="Request body is required")

        try:
            result = schema.load(request.json)
        except ValidationError as error:
            return self.response_422(message=error.messages)  # type: ignore[arg-type]

        return self.response(200, result=schema.dump(result))

    @expose("/schema/<from_version>/<to_version>", methods=("POST",))
    @protect()
    @statsd_metrics
    @event_logger.log_this_with_context(
        action=lambda self, *args, **kwargs: f"{self.__class__.__name__}"
        ".convert_schema",
        log_to_statsd=True,
    )
    @requires_json
    def convert_schema(self, from_version: str, to_version: str) -> Response:
        """
        Convert a GeoSetLayer JSON payload from one schema version to another.
        ---
        post:
          summary: Convert JSON from one GeoSet layer schema version to another
          parameters:
            - in: path
              name: from_version
              schema:
                type: string
              required: true
              description: Source schema version (e.g., "v1")
            - in: path
              name: to_version
              schema:
                type: string
              required: true
              description: Target schema version (e.g., "v2")
          requestBody:
            required: true
            content:
              application/json:
                schema:
                  type: object
          responses:
            200:
              description: Schema conversion successful
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      result:
                        type: object
                        description: Converted schema in target version format
            400:
              $ref: '#/components/responses/400'
            401:
              $ref: '#/components/responses/401'
            403:
              $ref: '#/components/responses/403'
            404:
              $ref: '#/components/responses/404'
            422:
              description: Validation errors in source schema
              content:
                application/json:
                  schema:
                    type: object
                    properties:
                      message:
                        type: object
                        description: Validation error details
        """
        logger.info(
            "[Migration] convert_schema called: %s -> %s", from_version, to_version
        )
        logger.info("[Migration] Request payload: %s", request.json)

        # Validate versions are different
        if from_version == to_version:
            logger.error("[Migration] Error: versions are the same")
            return self.response_400(
                message="from_version and to_version must be different"
            )

        # Validate version format and ordering
        from_num = parse_version_number(from_version)
        to_num = parse_version_number(to_version)

        if from_num is None or to_num is None:
            logger.error("[Migration] Error: invalid version format")
            return self.response_400(
                message="Invalid version format. Expected 'v1', 'v2', etc."
            )

        if from_num >= to_num:
            logger.error("[Migration] Error: from_version >= to_version")
            return self.response_400(
                message="from_version must be earlier than to_version"
            )

        # Validate versions exist
        from_schema = self.geoset_layer_schemas.get(from_version)
        to_schema = self.geoset_layer_schemas.get(to_version)

        if from_schema is None or to_schema is None:
            logger.error("[Migration] Error: schema not found")
            return self.response_404()

        # Validate upgrade path exists
        upgrade_func = self.schema_upgrade_paths.get((from_version, to_version))
        if upgrade_func is None:
            logger.error("[Migration] Error: upgrade path not found")
            return self.response_404()

        if request.json is None:
            logger.error("[Migration] Error: request body is None")
            return self.response_400(message="Request body is required")

        # Validate input against source schema
        try:
            logger.info("[Migration] Validating against source schema (%s)", from_version)
            from_schema.load(request.json)
            logger.info("[Migration] Source schema validation passed")
        except ValidationError as error:
            logger.error("[Migration] Source schema validation failed: %s", error.messages)
            return self.response_422(message=error.messages)  # type: ignore[arg-type]

        # Perform conversion
        logger.info("[Migration] Performing conversion")
        converted = upgrade_func(request.json)
        logger.info("[Migration] Converted payload: %s", converted)

        # Validate and return converted data
        try:
            logger.info("[Migration] Validating against target schema (%s)", to_version)
            result = to_schema.load(converted)
            logger.info("[Migration] Target schema validation passed")
        except ValidationError as error:
            logger.error("[Migration] Target schema validation failed: %s", error.messages)
            return self.response_422(message=error.messages)  # type: ignore[arg-type]

        logger.info("[Migration] Success! Returning result")
        return self.response(200, result=to_schema.dump(result))
