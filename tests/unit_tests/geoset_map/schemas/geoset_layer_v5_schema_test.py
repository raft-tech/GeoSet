"""Tests for GeoSetLayerV5Schema validation logic."""

import copy
import json
from pathlib import Path

import pytest
from marshmallow import ValidationError

from superset.geoset_map.schemas.GeoSetLayerV5Schema import (
    ColorByValueSchemaV5,
    GeoSetLayerV5Schema,
)


@pytest.fixture
def base_schema_data():
    """Load base schema data from schemaExampleV5.json."""
    schema_path = Path(__file__).parent / "schemaExampleV5.json"
    with open(schema_path) as f:
        return json.load(f)


@pytest.fixture
def valid_global_coloring():
    """Valid V5 globalColoring (same as V4)."""
    return {
        "fillColor": [40, 147, 179, 255],
        "strokeColor": [0, 0, 0, 255],
        "strokeWidth": 2,
        "lineStyle": "solid",
        "fillPattern": "solid",
    }


@pytest.fixture
def minimal_valid_schema(valid_global_coloring):
    """Minimal valid V5 schema without coloring options."""
    return {
        "globalColoring": valid_global_coloring,
        "legend": {"title": "test_title", "name": "test_name"},
    }


# =============================================================================
# ColorByValueSchemaV5 Tests
# =============================================================================


class TestColorByValueSchemaV5:
    """Tests for the V5 color-by-value schema with percentage support."""

    def test_valid_numeric_bounds(self):
        """Numeric bounds should still work (backward compatible)."""
        schema = ColorByValueSchemaV5()
        data = {
            "valueColumn": "population",
            "lowerBound": 0,
            "upperBound": 100,
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [25, 50, 75],
        }
        result = schema.load(data)
        assert result["lower_bound"] == 0
        assert result["upper_bound"] == 100
        assert result["breakpoints"] == [25, 50, 75]

    def test_valid_percentage_bounds(self):
        """Percentage string bounds should be accepted."""
        schema = ColorByValueSchemaV5()
        data = {
            "valueColumn": "population",
            "lowerBound": "10%",
            "upperBound": "90%",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [],
        }
        result = schema.load(data)
        assert result["lower_bound"] == "10%"
        assert result["upper_bound"] == "90%"

    def test_valid_percentage_breakpoints(self):
        """Percentage breakpoints should be accepted."""
        schema = ColorByValueSchemaV5()
        data = {
            "valueColumn": "population",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": ["25%", "50%", "75%"],
        }
        result = schema.load(data)
        assert result["breakpoints"] == ["25%", "50%", "75%"]

    def test_valid_mixed_bounds(self):
        """Mixed types (number + percentage) should be allowed."""
        schema = ColorByValueSchemaV5()
        data = {
            "valueColumn": "population",
            "lowerBound": 100,
            "upperBound": "90%",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [],
        }
        result = schema.load(data)
        assert result["lower_bound"] == 100
        assert result["upper_bound"] == "90%"

    def test_null_bounds_default(self):
        """Bounds should default to None when omitted."""
        schema = ColorByValueSchemaV5()
        data = {
            "valueColumn": "population",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [],
        }
        result = schema.load(data)
        assert result["lower_bound"] is None
        assert result["upper_bound"] is None

    def test_rejects_numeric_lower_gte_upper(self):
        """Numeric lower >= upper should fail."""
        schema = ColorByValueSchemaV5()
        with pytest.raises(ValidationError, match="upperBound must be greater"):
            schema.load({
                "valueColumn": "x",
                "lowerBound": 100,
                "upperBound": 50,
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": [],
            })

    def test_rejects_percentage_lower_gte_upper(self):
        """Percentage lower >= upper should fail."""
        schema = ColorByValueSchemaV5()
        with pytest.raises(ValidationError, match="upperBound must be greater"):
            schema.load({
                "valueColumn": "x",
                "lowerBound": "80%",
                "upperBound": "20%",
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": [],
            })

    def test_skips_bound_validation_for_mixed_types(self):
        """Mixed bound types skip ordering check."""
        schema = ColorByValueSchemaV5()
        result = schema.load({
            "valueColumn": "x",
            "lowerBound": 9999,
            "upperBound": "1%",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [],
        })
        assert result["lower_bound"] == 9999
        assert result["upper_bound"] == "1%"

    def test_rejects_unordered_numeric_breakpoints(self):
        """Numeric breakpoints out of order should fail."""
        schema = ColorByValueSchemaV5()
        with pytest.raises(ValidationError, match="lowest to highest"):
            schema.load({
                "valueColumn": "x",
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": [75, 25, 50],
            })

    def test_rejects_unordered_percentage_breakpoints(self):
        """Percentage breakpoints out of order should fail."""
        schema = ColorByValueSchemaV5()
        with pytest.raises(ValidationError, match="lowest to highest"):
            schema.load({
                "valueColumn": "x",
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": ["75%", "25%", "50%"],
            })

    def test_valid_all_percentage_bounds_and_breakpoints(self):
        """All-percentage config (bounds + breakpoints) should be accepted."""
        schema = ColorByValueSchemaV5()
        data = {
            "valueColumn": "population",
            "lowerBound": "10%",
            "upperBound": "90%",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": ["25%", "50%", "75%"],
        }
        result = schema.load(data)
        assert result["lower_bound"] == "10%"
        assert result["upper_bound"] == "90%"
        assert result["breakpoints"] == ["25%", "50%", "75%"]

    def test_mixed_type_breakpoints_skip_ordering_validation(self):
        """Mixed-type breakpoints (numbers and percentages) should skip ordering check."""
        schema = ColorByValueSchemaV5()
        result = schema.load({
            "valueColumn": "x",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": ["25%", 50, "75%"],
        })
        assert result["breakpoints"] == ["25%", 50, "75%"]

    def test_rejects_numeric_breakpoint_outside_bounds(self):
        """Numeric breakpoints outside bounds should fail."""
        schema = ColorByValueSchemaV5()
        with pytest.raises(ValidationError, match="between lowerBound and upperBound"):
            schema.load({
                "valueColumn": "x",
                "lowerBound": 10,
                "upperBound": 100,
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": [5, 50],
            })


# =============================================================================
# GeoSetLayerV5Schema Full Schema Tests
# =============================================================================


class TestGeoSetLayerV5Schema:
    """Tests for the full V5 schema validation."""

    def test_minimal_valid_schema(self, minimal_valid_schema):
        schema = GeoSetLayerV5Schema()
        result = schema.load(minimal_valid_schema)
        assert isinstance(result, dict)

    def test_valid_with_percentage_color_by_value(self, minimal_valid_schema):
        """V5 should accept percentage bounds in colorByValue."""
        schema = GeoSetLayerV5Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["legend"]["name"] = None
        data["colorByValue"] = {
            "valueColumn": "population",
            "lowerBound": "10%",
            "upperBound": "90%",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": ["25%", "50%", "75%"],
        }
        result = schema.load(data)
        assert result["color_by_value"]["lower_bound"] == "10%"
        assert result["color_by_value"]["upper_bound"] == "90%"

    def test_valid_with_numeric_color_by_value(self, minimal_valid_schema):
        """V5 should still accept numeric bounds (backward compatible)."""
        schema = GeoSetLayerV5Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["legend"]["name"] = None
        data["colorByValue"] = {
            "valueColumn": "population",
            "lowerBound": 0,
            "upperBound": 100,
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [25, 50, 75],
        }
        result = schema.load(data)
        assert result["color_by_value"]["lower_bound"] == 0
        assert result["color_by_value"]["upper_bound"] == 100

    def test_pointsize_still_works(self, minimal_valid_schema):
        """V4 pointSize features should still work in V5."""
        schema = GeoSetLayerV5Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["pointSize"] = {
            "valueColumn": "magnitude",
            "startSize": 4,
            "endSize": 30,
        }
        result = schema.load(data)
        assert isinstance(result["point_size"], dict)
        assert result["point_size"]["value_column"] == "magnitude"

    def test_dump_includes_percentage_bounds(self, minimal_valid_schema):
        """Dumped schema should preserve percentage strings."""
        schema = GeoSetLayerV5Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["legend"]["name"] = None
        data["colorByValue"] = {
            "valueColumn": "population",
            "lowerBound": "10%",
            "upperBound": "90%",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": ["25%"],
        }
        result = schema.load(data)
        dumped = schema.dump(result)
        assert dumped["colorByValue"]["lowerBound"] == "10%"
        assert dumped["colorByValue"]["upperBound"] == "90%"
        assert dumped["colorByValue"]["breakpoints"] == ["25%"]


# =============================================================================
# V4 to V5 Upgrade Tests
# =============================================================================


class TestV4ToV5Upgrade:
    """Tests for V4 to V5 schema upgrade function."""

    def test_upgrade_is_passthrough(self):
        """V4 data should pass through unchanged."""
        v4_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "colorByValue": {
                "valueColumn": "population",
                "lowerBound": 0,
                "upperBound": 100,
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": [50],
            },
            "legend": {"title": "test_title", "name": None},
        }
        v5_data = GeoSetLayerV5Schema.upgrade_from_previous_version(v4_data)

        assert v5_data["colorByValue"] == v4_data["colorByValue"]
        assert v5_data["legend"] == v4_data["legend"]

    def test_upgrade_preserves_point_size(self):
        """Upgrade should preserve top-level pointSize from V4."""
        v4_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "pointSize": 10,
            "legend": {"title": "test_title", "name": "test_name"},
        }
        v5_data = GeoSetLayerV5Schema.upgrade_from_previous_version(v4_data)

        assert v5_data["pointSize"] == 10

    def test_upgrade_does_not_mutate_original(self):
        """Upgrade should not modify the original V4 data."""
        v4_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "legend": {"title": "test_title", "name": "test_name"},
        }
        original = copy.deepcopy(v4_data)
        v5_data = GeoSetLayerV5Schema.upgrade_from_previous_version(v4_data)

        assert v4_data == original
        # Ensure deep copy: nested objects should not be shared
        assert v4_data["globalColoring"] is not v5_data["globalColoring"]
        assert v4_data["legend"] is not v5_data["legend"]

    def test_upgraded_schema_validates(self):
        """Upgraded V4 schema should pass V5 validation."""
        v4_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "colorByValue": {
                "valueColumn": "population",
                "lowerBound": 0,
                "upperBound": 100,
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": [],
            },
            "legend": {"title": "test_title", "name": None},
        }
        v5_data = GeoSetLayerV5Schema.upgrade_from_previous_version(v4_data)
        schema = GeoSetLayerV5Schema()
        result = schema.load(v5_data)

        assert result["color_by_value"]["lower_bound"] == 0
        assert result["color_by_value"]["upper_bound"] == 100


# =============================================================================
# V4 Validations Still Hold in V5 Tests
# =============================================================================


class TestV4ValidationsInV5:
    """Tests that V4 validation rules still apply in V5."""

    def test_invalid_with_both_coloring_options(self, base_schema_data):
        """Schema with both colorByCategory and colorByValue should fail."""
        schema = GeoSetLayerV5Schema()
        data = copy.deepcopy(base_schema_data)
        data["legend"]["name"] = None
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "Only one of colorByCategory or colorByValue" in str(exc_info.value)

    def test_invalid_legend_name_set_with_color_by_value(self, base_schema_data):
        """legend.name set with colorByValue should fail validation."""
        schema = GeoSetLayerV5Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByCategory"]
        data["legend"]["name"] = "should_be_null"
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "legend.name must be null" in str(exc_info.value)

    def test_valid_legend_name_null_with_color_by_value(self, base_schema_data):
        """legend.name null with colorByValue should pass validation."""
        schema = GeoSetLayerV5Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByCategory"]
        data["legend"]["name"] = None
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["legend"]["name"] is None

    def test_text_overlay_style_inherited(self, minimal_valid_schema):
        """V5 should still support textOverlayStyle from V3."""
        schema = GeoSetLayerV5Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["textOverlayStyle"] = {
            "fontFamily": "Courier New, monospace",
            "fontSize": 18,
            "bold": True,
            "offset": [5, -10],
        }
        result = schema.load(data)
        assert result["text_overlay_style"]["font_family"] == "Courier New, monospace"

    def test_mismatched_value_columns_still_rejected(self, minimal_valid_schema):
        """Dynamic pointSize and colorByValue with different valueColumns should fail."""
        schema = GeoSetLayerV5Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["legend"]["name"] = None
        data["pointSize"] = {
            "valueColumn": "population",
            "startSize": 4,
            "endSize": 30,
        }
        data["colorByValue"] = {
            "valueColumn": "temperature",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [],
        }
        with pytest.raises(ValidationError, match="same valueColumn"):
            schema.load(data)
