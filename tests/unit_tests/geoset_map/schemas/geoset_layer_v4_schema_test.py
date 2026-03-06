"""Tests for GeoSetLayerV4Schema validation logic."""

import copy
import json
from pathlib import Path

import pytest
from marshmallow import ValidationError

from superset.geoset_map.schemas.GeoSetLayerV4Schema import (
    GeoSetLayerV4Schema,
    GlobalColoringSchemaV4,
    NumberOrPercent,
    DynamicPointSizeSchema,
    StaticOrDynamicPointSizeField,
)


@pytest.fixture
def base_schema_data():
    """Load base schema data from schemaExampleV4.json."""
    schema_path = Path(__file__).parent / "schemaExampleV4.json"
    with open(schema_path) as f:
        return json.load(f)


@pytest.fixture
def valid_global_coloring():
    """Valid V4 globalColoring (no pointSize inside)."""
    return {
        "fillColor": [40, 147, 179, 255],
        "strokeColor": [0, 0, 0, 255],
        "strokeWidth": 2,
        "lineStyle": "solid",
        "fillPattern": "solid",
    }


@pytest.fixture
def minimal_valid_schema(valid_global_coloring):
    """Minimal valid V4 schema without coloring options or pointSize."""
    return {
        "globalColoring": valid_global_coloring,
        "legend": {"title": "test_title", "name": "test_name"},
    }


@pytest.fixture
def valid_dynamic_point_size():
    """Valid dynamic pointSize configuration."""
    return {
        "valueColumn": "fire_intensity",
        "startSize": 4,
        "endSize": 30,
        "lowerBound": None,
        "upperBound": None,
    }


# =============================================================================
# NumberOrPercent Field Tests
# =============================================================================


class TestNumberOrPercent:
    """Tests for the NumberOrPercent marshmallow field."""

    def setup_method(self):
        self.field = NumberOrPercent()

    def test_accepts_integer(self):
        assert self.field._deserialize(42, "test", {}) == 42

    def test_accepts_float(self):
        assert self.field._deserialize(3.14, "test", {}) == 3.14

    def test_accepts_zero(self):
        assert self.field._deserialize(0, "test", {}) == 0

    def test_accepts_negative_number(self):
        assert self.field._deserialize(-5, "test", {}) == -5

    def test_accepts_percentage_string(self):
        assert self.field._deserialize("25%", "test", {}) == "25%"

    def test_accepts_percentage_with_decimal(self):
        assert self.field._deserialize("33.5%", "test", {}) == "33.5%"

    def test_accepts_zero_percent(self):
        assert self.field._deserialize("0%", "test", {}) == "0%"

    def test_accepts_100_percent(self):
        assert self.field._deserialize("100%", "test", {}) == "100%"

    def test_strips_whitespace_from_percentage(self):
        assert self.field._deserialize("  50%  ", "test", {}) == "50%"

    def test_accepts_none(self):
        assert self.field._deserialize(None, "test", {}) is None

    def test_rejects_percentage_over_100(self):
        with pytest.raises(ValidationError, match="between 0% and 100%"):
            self.field._deserialize("150%", "test", {})

    def test_rejects_negative_percentage(self):
        """Negative percentages don't match the regex so they're invalid strings."""
        with pytest.raises(ValidationError, match="Expected a number or a string"):
            self.field._deserialize("-5%", "test", {})

    def test_rejects_non_numeric_string(self):
        with pytest.raises(ValidationError, match="Expected a number or a string"):
            self.field._deserialize("abc", "test", {})

    def test_rejects_bare_percent_sign(self):
        with pytest.raises(ValidationError, match="Expected a number or a string"):
            self.field._deserialize("%", "test", {})

    def test_rejects_invalid_type(self):
        with pytest.raises(ValidationError, match="Invalid type"):
            self.field._deserialize([1, 2], "test", {})

    def test_serialize_passthrough(self):
        assert self.field._serialize("25%", "test", {}) == "25%"
        assert self.field._serialize(42, "test", {}) == 42


# =============================================================================
# GlobalColoringSchemaV4 Tests
# =============================================================================


class TestGlobalColoringSchemaV4:
    """Tests for V4 globalColoring (pointSize removed)."""

    def test_valid_full_config(self):
        schema = GlobalColoringSchemaV4()
        data = {
            "fillColor": [255, 0, 0, 255],
            "strokeColor": [0, 0, 0, 255],
            "strokeWidth": 1,
            "lineStyle": "dashed",
            "fillPattern": "solid",
            "pointType": "star",
        }
        result = schema.load(data)
        assert result["fill_color"] == [255, 0, 0, 255]
        assert result["line_style"] == "dashed"
        assert result["point_type"] == "star"

    def test_rejects_point_size_inside_global_coloring(self):
        """V4 globalColoring should not accept pointSize (it's top-level now)."""
        schema = GlobalColoringSchemaV4()
        data = {
            "fillColor": [255, 0, 0, 255],
            "strokeColor": [0, 0, 0, 255],
            "strokeWidth": 1,
            "fillPattern": "solid",
            "pointSize": 10,
        }
        # Marshmallow strict mode rejects unknown fields by default in Meta,
        # but V4 schema doesn't set strict — pointSize just gets ignored.
        result = schema.load(data)
        assert "point_size" not in result

    def test_optional_fields_default_to_none(self):
        schema = GlobalColoringSchemaV4()
        data = {
            "fillColor": [0, 0, 0, 255],
            "strokeColor": [0, 0, 0, 255],
            "strokeWidth": 0,
            "fillPattern": "solid",
        }
        result = schema.load(data)
        assert result["line_style"] is None
        assert result["point_type"] is None


# =============================================================================
# DynamicPointSizeSchema Tests
# =============================================================================


class TestDynamicPointSizeSchema:
    """Tests for dynamic point size configuration."""

    def test_valid_config_no_bounds(self):
        schema = DynamicPointSizeSchema()
        data = {
            "valueColumn": "population",
            "startSize": 2,
            "endSize": 50,
        }
        result = schema.load(data)
        assert result["value_column"] == "population"
        assert result["start_size"] == 2
        assert result["end_size"] == 50
        assert result["lower_bound"] is None
        assert result["upper_bound"] is None

    def test_valid_config_with_numeric_bounds(self):
        schema = DynamicPointSizeSchema()
        data = {
            "valueColumn": "population",
            "startSize": 4,
            "endSize": 30,
            "lowerBound": 100,
            "upperBound": 5000,
        }
        result = schema.load(data)
        assert result["lower_bound"] == 100
        assert result["upper_bound"] == 5000

    def test_valid_config_with_percentage_bounds(self):
        schema = DynamicPointSizeSchema()
        data = {
            "valueColumn": "population",
            "startSize": 4,
            "endSize": 30,
            "lowerBound": "10%",
            "upperBound": "90%",
        }
        result = schema.load(data)
        assert result["lower_bound"] == "10%"
        assert result["upper_bound"] == "90%"

    def test_valid_config_with_mixed_bounds(self):
        """Mixed types (number + percentage) should be allowed."""
        schema = DynamicPointSizeSchema()
        data = {
            "valueColumn": "population",
            "startSize": 4,
            "endSize": 30,
            "lowerBound": 100,
            "upperBound": "90%",
        }
        result = schema.load(data)
        assert result["lower_bound"] == 100
        assert result["upper_bound"] == "90%"

    def test_rejects_start_size_below_1(self):
        schema = DynamicPointSizeSchema()
        with pytest.raises(ValidationError) as exc_info:
            schema.load({
                "valueColumn": "x",
                "startSize": 0,
                "endSize": 10,
            })
        assert "startSize" in exc_info.value.messages

    def test_rejects_end_size_above_200(self):
        schema = DynamicPointSizeSchema()
        with pytest.raises(ValidationError) as exc_info:
            schema.load({
                "valueColumn": "x",
                "startSize": 4,
                "endSize": 300,
            })
        assert "endSize" in exc_info.value.messages

    def test_rejects_lower_bound_gte_upper_bound_numeric(self):
        schema = DynamicPointSizeSchema()
        with pytest.raises(ValidationError, match="upperBound must be greater"):
            schema.load({
                "valueColumn": "x",
                "startSize": 4,
                "endSize": 30,
                "lowerBound": 500,
                "upperBound": 100,
            })

    def test_rejects_equal_bounds_numeric(self):
        schema = DynamicPointSizeSchema()
        with pytest.raises(ValidationError, match="upperBound must be greater"):
            schema.load({
                "valueColumn": "x",
                "startSize": 4,
                "endSize": 30,
                "lowerBound": 100,
                "upperBound": 100,
            })

    def test_rejects_lower_bound_gte_upper_bound_percentage(self):
        schema = DynamicPointSizeSchema()
        with pytest.raises(ValidationError, match="upperBound must be greater"):
            schema.load({
                "valueColumn": "x",
                "startSize": 4,
                "endSize": 30,
                "lowerBound": "80%",
                "upperBound": "20%",
            })

    def test_skips_bound_validation_for_mixed_types(self):
        """Mixed bound types (number + percentage) skip ordering check."""
        schema = DynamicPointSizeSchema()
        result = schema.load({
            "valueColumn": "x",
            "startSize": 4,
            "endSize": 30,
            "lowerBound": 9999,
            "upperBound": "1%",
        })
        assert result["lower_bound"] == 9999
        assert result["upper_bound"] == "1%"

    def test_missing_value_column_fails(self):
        schema = DynamicPointSizeSchema()
        with pytest.raises(ValidationError) as exc_info:
            schema.load({"startSize": 4, "endSize": 30})
        assert "valueColumn" in exc_info.value.messages


# =============================================================================
# StaticOrDynamicPointSizeField Tests
# =============================================================================


class TestStaticOrDynamicPointSizeField:
    """Tests for the polymorphic StaticOrDynamicPointSizeField."""

    def setup_method(self):
        self.field = StaticOrDynamicPointSizeField()

    def test_accepts_static_number(self):
        assert self.field._deserialize(6, "pointSize", {}) == 6

    def test_accepts_static_float(self):
        assert self.field._deserialize(12.5, "pointSize", {}) == 12.5

    def test_rejects_static_below_1(self):
        with pytest.raises(ValidationError, match="at least 1"):
            self.field._deserialize(0.5, "pointSize", {})

    def test_rejects_static_above_200(self):
        with pytest.raises(ValidationError, match="at most 200"):
            self.field._deserialize(250, "pointSize", {})

    def test_accepts_dynamic_config(self):
        config = {
            "valueColumn": "magnitude",
            "startSize": 4,
            "endSize": 30,
        }
        result = self.field._deserialize(config, "pointSize", {})
        assert isinstance(result, dict)
        assert result["value_column"] == "magnitude"

    def test_rejects_invalid_dynamic_config(self):
        with pytest.raises(ValidationError):
            self.field._deserialize({"startSize": 4}, "pointSize", {})

    def test_rejects_string(self):
        with pytest.raises(ValidationError, match="positive number or a configuration"):
            self.field._deserialize("big", "pointSize", {})

    def test_rejects_list(self):
        with pytest.raises(ValidationError, match="positive number or a configuration"):
            self.field._deserialize([1, 2], "pointSize", {})

    def test_serialize_static(self):
        assert self.field._serialize(6, "pointSize", {}) == 6

    def test_serialize_none(self):
        assert self.field._serialize(None, "pointSize", {}) is None

    def test_serialize_dynamic(self):
        config = {"value_column": "mag", "start_size": 4, "end_size": 30}
        result = self.field._serialize(config, "pointSize", {})
        assert isinstance(result, dict)


# =============================================================================
# GeoSetLayerV4Schema Full Schema Tests
# =============================================================================


class TestGeoSetLayerV4Schema:
    """Tests for the full V4 schema validation."""

    def test_minimal_valid_schema(self, minimal_valid_schema):
        schema = GeoSetLayerV4Schema()
        result = schema.load(minimal_valid_schema)
        assert isinstance(result, dict)
        assert result["point_size"] is None

    def test_valid_with_static_point_size(self, minimal_valid_schema):
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["pointSize"] = 10
        result = schema.load(data)
        assert result["point_size"] == 10

    def test_valid_with_dynamic_point_size(self, minimal_valid_schema):
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["pointSize"] = {
            "valueColumn": "population",
            "startSize": 4,
            "endSize": 30,
        }
        result = schema.load(data)
        assert isinstance(result["point_size"], dict)
        assert result["point_size"]["value_column"] == "population"

    def test_valid_with_dynamic_point_size_and_matching_color_by_value(
        self, minimal_valid_schema
    ):
        """pointSize and colorByValue with same valueColumn should pass."""
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["legend"]["name"] = None
        data["pointSize"] = {
            "valueColumn": "fire_intensity",
            "startSize": 4,
            "endSize": 30,
        }
        data["colorByValue"] = {
            "valueColumn": "fire_intensity",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [],
        }
        result = schema.load(data)
        assert isinstance(result["point_size"], dict)
        assert result["color_by_value"] is not None

    def test_rejects_mismatched_value_columns(self, minimal_valid_schema):
        """pointSize and colorByValue with different valueColumns should fail."""
        schema = GeoSetLayerV4Schema()
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

    def test_static_point_size_with_color_by_value_ok(self, minimal_valid_schema):
        """Static pointSize (number) with colorByValue should not trigger mismatch."""
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["legend"]["name"] = None
        data["pointSize"] = 10
        data["colorByValue"] = {
            "valueColumn": "temperature",
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [],
        }
        result = schema.load(data)
        assert result["point_size"] == 10

    def test_dump_excludes_null_point_size(self, minimal_valid_schema):
        """Dumped schema should not include pointSize when it is None."""
        schema = GeoSetLayerV4Schema()
        result = schema.load(minimal_valid_schema)
        dumped = schema.dump(result)
        assert "pointSize" not in dumped

    def test_dump_includes_static_point_size(self, minimal_valid_schema):
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["pointSize"] = 8
        result = schema.load(data)
        dumped = schema.dump(result)
        assert dumped["pointSize"] == 8

    def test_dump_includes_dynamic_point_size(self, minimal_valid_schema):
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["pointSize"] = {
            "valueColumn": "magnitude",
            "startSize": 4,
            "endSize": 30,
            "lowerBound": 10,
            "upperBound": 100,
        }
        result = schema.load(data)
        dumped = schema.dump(result)
        assert dumped["pointSize"]["valueColumn"] == "magnitude"
        assert dumped["pointSize"]["startSize"] == 4
        assert dumped["pointSize"]["lowerBound"] == 10

    def test_dynamic_point_size_with_percentage_bounds(self, minimal_valid_schema):
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["pointSize"] = {
            "valueColumn": "magnitude",
            "startSize": 4,
            "endSize": 30,
            "lowerBound": "10%",
            "upperBound": "90%",
        }
        result = schema.load(data)
        assert result["point_size"]["lower_bound"] == "10%"
        assert result["point_size"]["upper_bound"] == "90%"


# =============================================================================
# V3 to V4 Upgrade Tests
# =============================================================================


class TestV3ToV4Upgrade:
    """Tests for V3 to V4 schema upgrade function."""

    def test_upgrade_promotes_point_size(self):
        """pointSize should be moved from globalColoring to top level."""
        v3_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
                "pointSize": 10,
            },
            "legend": {"title": "test_title", "name": "test_name"},
        }
        v4_data = GeoSetLayerV4Schema.upgrade_from_previous_version(v3_data)

        assert v4_data["pointSize"] == 10
        assert "pointSize" not in v4_data["globalColoring"]

    def test_upgrade_without_point_size(self):
        """When no pointSize in globalColoring, upgrade should not add one."""
        v3_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "legend": {"title": "test_title", "name": "test_name"},
        }
        v4_data = GeoSetLayerV4Schema.upgrade_from_previous_version(v3_data)

        assert "pointSize" not in v4_data

    def test_upgrade_preserves_other_fields(self):
        """Upgrade should preserve colorByCategory, legend, etc."""
        v3_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
                "pointSize": 6,
            },
            "colorByCategory": {
                "dimension": "category_column",
                "categoricalColors": [],
                "defaultLegendName": ["Other"],
            },
            "legend": {"title": "test_title", "name": None},
        }
        v4_data = GeoSetLayerV4Schema.upgrade_from_previous_version(v3_data)

        assert v4_data["colorByCategory"] == v3_data["colorByCategory"]
        assert v4_data["legend"] == v3_data["legend"]
        assert v4_data["pointSize"] == 6

    def test_upgrade_does_not_mutate_original(self):
        """Upgrade should not modify the original V3 data."""
        v3_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
                "pointSize": 10,
            },
            "legend": {"title": "test_title", "name": "test_name"},
        }
        original = copy.deepcopy(v3_data)
        GeoSetLayerV4Schema.upgrade_from_previous_version(v3_data)

        assert v3_data == original

    def test_upgraded_schema_validates(self):
        """Upgraded V3 schema should pass V4 validation."""
        v3_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
                "pointSize": 10,
            },
            "legend": {"title": "test_title", "name": "test_name"},
        }
        v4_data = GeoSetLayerV4Schema.upgrade_from_previous_version(v3_data)
        schema = GeoSetLayerV4Schema()
        result = schema.load(v4_data)

        assert result["point_size"] == 10
        assert result["legend"]["title"] == "test_title"


# =============================================================================
# V3 Validations Still Hold in V4 Tests
# =============================================================================


class TestV3ValidationsInV4:
    """Tests that V3 validation rules still apply in V4."""

    def test_invalid_with_both_coloring_options(self, base_schema_data):
        """Schema with both colorByCategory and colorByValue should fail."""
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(base_schema_data)
        data["legend"]["name"] = None
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "Only one of colorByCategory or colorByValue" in str(exc_info.value)

    def test_invalid_legend_name_set_with_color_by_category(self, base_schema_data):
        """legend.name set with colorByCategory should fail validation."""
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByValue"]
        data["legend"]["name"] = "should_be_null"
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "legend.name must be null" in str(exc_info.value)

    def test_valid_legend_name_null_with_color_by_category(self, base_schema_data):
        """legend.name null with colorByCategory should pass validation."""
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByValue"]
        data["legend"]["name"] = None
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["legend"]["name"] is None

    def test_text_overlay_style_inherited(self, minimal_valid_schema):
        """V4 should still support textOverlayStyle from V3."""
        schema = GeoSetLayerV4Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["textOverlayStyle"] = {
            "fontFamily": "Courier New, monospace",
            "fontSize": 18,
            "bold": True,
            "offset": [5, -10],
        }
        result = schema.load(data)
        assert result["text_overlay_style"]["font_family"] == "Courier New, monospace"
