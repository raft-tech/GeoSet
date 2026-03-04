"""Tests for GeoSetLayerV3Schema validation logic."""

import copy
import json
from pathlib import Path

import pytest
from marshmallow import ValidationError

from superset.geoset_map.schemas.GeoSetLayerV3Schema import (
    GeoSetLayerV3Schema,
    TextOverlayStyleSchema,
)


@pytest.fixture
def base_schema_data():
    """Load base schema data from schemaExampleV3.json."""
    schema_path = Path(__file__).parent / "schemaExampleV3.json"
    with open(schema_path) as f:
        return json.load(f)


@pytest.fixture
def valid_global_coloring():
    """Valid globalColoring configuration."""
    return {
        "fillColor": [40, 147, 179, 255],
        "strokeColor": [0, 0, 0, 255],
        "strokeWidth": 2,
        "lineStyle": "solid",
        "fillPattern": "solid",
    }


@pytest.fixture
def minimal_valid_schema(valid_global_coloring):
    """Minimal valid schema without colorByCategory or colorByValue."""
    return {
        "globalColoring": valid_global_coloring,
        "legend": {"title": "test_title", "name": "test_name"},
    }


# =============================================================================
# TextOverlayStyleSchema Tests
# =============================================================================


class TestTextOverlayStyleSchema:
    """Tests for TextOverlayStyleSchema validation."""

    def test_valid_full_style(self):
        """Full text overlay style should pass validation."""
        schema = TextOverlayStyleSchema()
        data = {
            "fontFamily": "Times New Roman, serif",
            "fontSize": 20,
            "bold": True,
            "offset": [10, -15],
        }
        result = schema.load(data)
        assert result["font_family"] == "Times New Roman, serif"
        assert result["font_size"] == 20
        assert result["bold"] is True
        assert result["offset"] == [10, -15]

    def test_defaults_applied(self):
        """Empty object should use defaults for all fields."""
        schema = TextOverlayStyleSchema()
        result = schema.load({})
        assert result["font_family"] == "Arial, sans-serif"
        assert result["font_size"] == 14
        assert result["bold"] is False
        assert result["offset"] == [0, 0]

    def test_invalid_font_size_too_small(self):
        """fontSize below 1 should fail validation."""
        schema = TextOverlayStyleSchema()
        with pytest.raises(ValidationError) as exc_info:
            schema.load({"fontSize": 0})
        assert "fontSize" in exc_info.value.messages

    def test_invalid_font_size_too_large(self):
        """fontSize above 128 should fail validation."""
        schema = TextOverlayStyleSchema()
        with pytest.raises(ValidationError) as exc_info:
            schema.load({"fontSize": 200})
        assert "fontSize" in exc_info.value.messages

    def test_partial_override(self):
        """Providing only some fields should use defaults for the rest."""
        schema = TextOverlayStyleSchema()
        result = schema.load({"bold": True})
        assert result["font_family"] == "Arial, sans-serif"
        assert result["font_size"] == 14
        assert result["bold"] is True
        assert result["offset"] == [0, 0]


# =============================================================================
# TextOverlayStyle Nested in V3 Schema Tests
# =============================================================================


class TestTextOverlayStyleInV3Schema:
    """Tests for textOverlayStyle nested in GeoSetLayerV3Schema."""

    def test_valid_schema_with_text_overlay_style(self, minimal_valid_schema):
        """Schema with textOverlayStyle should pass validation."""
        schema = GeoSetLayerV3Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["textOverlayStyle"] = {
            "fontFamily": "Courier New, monospace",
            "fontSize": 18,
            "bold": True,
            "offset": [5, -10],
        }
        result = schema.load(data)
        assert result["text_overlay_style"]["font_family"] == "Courier New, monospace"
        assert result["text_overlay_style"]["font_size"] == 18
        assert result["text_overlay_style"]["bold"] is True
        assert result["text_overlay_style"]["offset"] == [5, -10]

    def test_valid_schema_without_text_overlay_style(self, minimal_valid_schema):
        """Schema without textOverlayStyle should default to None."""
        schema = GeoSetLayerV3Schema()
        result = schema.load(minimal_valid_schema)
        assert result["text_overlay_style"] is None

    def test_dump_excludes_null_text_overlay_style(self, minimal_valid_schema):
        """Dumped schema should not include textOverlayStyle when it is None."""
        schema = GeoSetLayerV3Schema()
        result = schema.load(minimal_valid_schema)
        dumped = schema.dump(result)
        assert "textOverlayStyle" not in dumped

    def test_dump_includes_text_overlay_style_when_set(self, minimal_valid_schema):
        """Dumped schema should include textOverlayStyle when provided."""
        schema = GeoSetLayerV3Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["textOverlayStyle"] = {"fontSize": 24, "bold": True}
        result = schema.load(data)
        dumped = schema.dump(result)
        assert "textOverlayStyle" in dumped
        assert dumped["textOverlayStyle"]["fontSize"] == 24
        assert dumped["textOverlayStyle"]["bold"] is True


# =============================================================================
# V2 to V3 Upgrade Tests
# =============================================================================


class TestV2ToV3Upgrade:
    """Tests for V2 to V3 schema upgrade function."""

    def test_upgrade_is_passthrough(self):
        """V2 data should pass through unchanged."""
        v2_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "legend": {"title": "test_title", "name": "test_name"},
        }

        v3_data = GeoSetLayerV3Schema.upgrade_from_previous_version(v2_data)

        assert v3_data["globalColoring"] == v2_data["globalColoring"]
        assert v3_data["legend"] == v2_data["legend"]

    def test_upgrade_preserves_all_fields(self):
        """Upgrade should preserve all V2 fields including coloring options."""
        v2_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "colorByCategory": {
                "dimension": "category_column",
                "categoricalColors": [],
                "defaultLegendName": ["Other"],
            },
            "legend": {"title": "test_title", "name": None},
        }

        v3_data = GeoSetLayerV3Schema.upgrade_from_previous_version(v2_data)

        assert v3_data["globalColoring"] == v2_data["globalColoring"]
        assert v3_data["colorByCategory"] == v2_data["colorByCategory"]
        assert v3_data["legend"] == v2_data["legend"]

    def test_upgraded_schema_validates(self):
        """Upgraded V2 schema should pass V3 validation."""
        v2_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "legend": {"title": "test_title", "name": "test_name"},
        }

        v3_data = GeoSetLayerV3Schema.upgrade_from_previous_version(v2_data)
        schema = GeoSetLayerV3Schema()
        result = schema.load(v3_data)

        assert isinstance(result, dict)
        assert result["legend"]["title"] == "test_title"
        assert result["legend"]["name"] == "test_name"
        assert result["text_overlay_style"] is None


# =============================================================================
# V2 Validations Still Hold in V3 Tests
# =============================================================================


class TestV2ValidationsInV3:
    """Tests that V2 validation rules still apply in V3."""

    def test_invalid_with_both_coloring_options(self, base_schema_data):
        """Schema with both colorByCategory and colorByValue should fail."""
        schema = GeoSetLayerV3Schema()
        data = copy.deepcopy(base_schema_data)
        data["legend"]["name"] = None
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "Only one of colorByCategory or colorByValue" in str(exc_info.value)

    def test_invalid_legend_name_set_with_color_by_category(self, base_schema_data):
        """legend.name set with colorByCategory should fail validation."""
        schema = GeoSetLayerV3Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByValue"]
        data["legend"]["name"] = "should_be_null"
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "legend.name must be null" in str(exc_info.value)

    def test_valid_legend_name_null_with_color_by_category(self, base_schema_data):
        """legend.name null with colorByCategory should pass validation."""
        schema = GeoSetLayerV3Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByValue"]
        data["legend"]["name"] = None
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["legend"]["name"] is None
