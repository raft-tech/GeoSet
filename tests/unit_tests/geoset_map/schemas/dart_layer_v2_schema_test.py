"""Tests for GeoSetLayerV2Schema validation logic."""

import copy
import json
from pathlib import Path

import pytest
from marshmallow import ValidationError

from superset.geoset_map.schemas.GeoSetLayerV2Schema import (
    GeoSetLayerV2Schema,
    LegendSchemaV2,
)


@pytest.fixture
def base_schema_data():
    """Load base schema data from schemaExampleV2.json."""
    schema_path = Path(__file__).parent / "schemaExampleV2.json"
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
# Legend Schema V2 Tests
# =============================================================================


class TestLegendSchemaV2:
    """Tests for LegendSchemaV2 validation."""

    def test_valid_legend_with_title_and_name(self):
        """Legend with both title and name should pass validation."""
        schema = LegendSchemaV2()
        data = {"title": "my_title", "name": "my_name"}
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["title"] == "my_title"
        assert result["name"] == "my_name"

    def test_valid_legend_with_title_only(self):
        """Legend with title and no name should pass validation."""
        schema = LegendSchemaV2()
        data = {"title": "my_title"}
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["title"] == "my_title"
        assert result["name"] is None

    def test_valid_legend_with_null_name(self):
        """Legend with title and explicit null name should pass validation."""
        schema = LegendSchemaV2()
        data = {"title": "my_title", "name": None}
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["title"] == "my_title"
        assert result["name"] is None

    def test_invalid_legend_missing_title(self):
        """Legend without title should fail validation."""
        schema = LegendSchemaV2()
        data = {"name": "my_name"}
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "title" in exc_info.value.messages


# =============================================================================
# ColorByCategory/ColorByValue Mutual Exclusivity Tests
# =============================================================================


class TestColoringMutualExclusivity:
    """Tests for colorByCategory and colorByValue mutual exclusivity."""

    def test_valid_with_only_color_by_category(self, base_schema_data):
        """Schema with only colorByCategory should pass validation."""
        schema = GeoSetLayerV2Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByValue"]
        data["legend"]["name"] = None
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["color_by_category"] is not None
        assert result["color_by_value"] is None

    def test_valid_with_only_color_by_value(self, base_schema_data):
        """Schema with only colorByValue should pass validation."""
        schema = GeoSetLayerV2Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByCategory"]
        data["legend"]["name"] = None
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["color_by_value"] is not None
        assert result["color_by_category"] is None

    def test_valid_with_neither_coloring_option(self, minimal_valid_schema):
        """Schema with neither colorByCategory nor colorByValue should pass."""
        schema = GeoSetLayerV2Schema()
        result = schema.load(minimal_valid_schema)
        assert isinstance(result, dict)
        assert result["color_by_category"] is None
        assert result["color_by_value"] is None

    def test_dump_excludes_none_values_at_top_level(self, minimal_valid_schema):
        """Dumped schema should not include top-level keys with None values."""
        schema = GeoSetLayerV2Schema()
        result = schema.load(minimal_valid_schema)
        dumped = schema.dump(result)

        assert "colorByCategory" not in dumped
        assert "colorByValue" not in dumped

    def test_dump_excludes_none_values_in_nested_schemas(self, minimal_valid_schema):
        """Dumped schema should not include nested keys with None values."""
        schema = GeoSetLayerV2Schema()
        # minimal_valid_schema has globalColoring without pointType, pointSize, lineStyle
        result = schema.load(minimal_valid_schema)
        dumped = schema.dump(result)

        # These optional fields should not appear in globalColoring
        assert "pointType" not in dumped["globalColoring"]
        assert "pointSize" not in dumped["globalColoring"]
        # lineStyle is present in the fixture, so it should still be there
        assert "lineStyle" in dumped["globalColoring"]

    def test_dump_excludes_none_values_in_color_by_value(self, valid_global_coloring):
        """Dumped schema should not include null bounds in colorByValue."""
        schema = GeoSetLayerV2Schema()
        data = {
            "globalColoring": valid_global_coloring,
            "colorByValue": {
                "valueColumn": "population",
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": [25, 50, 75],
                # upperBound and lowerBound intentionally omitted
            },
            "legend": {"title": "test_title", "name": None},
        }
        result = schema.load(data)
        dumped = schema.dump(result)

        assert "upperBound" not in dumped["colorByValue"]
        assert "lowerBound" not in dumped["colorByValue"]

    def test_dump_excludes_null_legend_name(self, valid_global_coloring):
        """Dumped schema should not include null legend.name."""
        schema = GeoSetLayerV2Schema()
        data = {
            "globalColoring": valid_global_coloring,
            "legend": {"title": "test_title", "name": None},
        }
        result = schema.load(data)
        dumped = schema.dump(result)

        assert "name" not in dumped["legend"]
        assert dumped["legend"]["title"] == "test_title"

    def test_invalid_with_both_coloring_options(self, base_schema_data):
        """Schema with both colorByCategory and colorByValue should fail."""
        schema = GeoSetLayerV2Schema()
        data = copy.deepcopy(base_schema_data)
        data["legend"]["name"] = None
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "Only one of colorByCategory or colorByValue" in str(exc_info.value)


# =============================================================================
# Legend Name Null Requirement Tests
# =============================================================================


class TestLegendNameNullRequirement:
    """Tests for legend.name null requirement when coloring options are used."""

    def test_valid_legend_name_null_with_color_by_category(self, base_schema_data):
        """legend.name null with colorByCategory should pass validation."""
        schema = GeoSetLayerV2Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByValue"]
        data["legend"]["name"] = None
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["legend"]["name"] is None

    def test_valid_legend_name_null_with_color_by_value(self, base_schema_data):
        """legend.name null with colorByValue should pass validation."""
        schema = GeoSetLayerV2Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByCategory"]
        data["legend"]["name"] = None
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["legend"]["name"] is None

    def test_valid_legend_name_set_without_coloring_options(self, minimal_valid_schema):
        """legend.name can be set when no coloring options are used."""
        schema = GeoSetLayerV2Schema()
        data = copy.deepcopy(minimal_valid_schema)
        data["legend"]["name"] = "my_legend_name"
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["legend"]["name"] == "my_legend_name"

    def test_invalid_legend_name_set_with_color_by_category(self, base_schema_data):
        """legend.name set with colorByCategory should fail validation."""
        schema = GeoSetLayerV2Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByValue"]
        data["legend"]["name"] = "should_be_null"
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "legend.name must be null" in str(exc_info.value)

    def test_invalid_legend_name_set_with_color_by_value(self, base_schema_data):
        """legend.name set with colorByValue should fail validation."""
        schema = GeoSetLayerV2Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByCategory"]
        data["legend"]["name"] = "should_be_null"
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "legend.name must be null" in str(exc_info.value)


# =============================================================================
# Schema Upgrade Tests
# =============================================================================


class TestSchemaUpgrade:
    """Tests for V1 to V2 schema upgrade function."""

    def test_upgrade_without_coloring_sets_name_to_title(self):
        """Without coloring options, V2 name should equal title."""
        v1_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "legend": {"name": "my_legend_name"},
        }

        v2_data = GeoSetLayerV2Schema.upgrade_from_previous_version(v1_data)

        assert v2_data["legend"]["title"] == "my_legend_name"
        assert v2_data["legend"]["name"] == "my_legend_name"

    def test_upgrade_with_color_by_category_sets_name_to_null(self):
        """With colorByCategory, V2 name should be null."""
        v1_data = {
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
            "legend": {"name": "my_legend_name"},
        }

        v2_data = GeoSetLayerV2Schema.upgrade_from_previous_version(v1_data)

        assert v2_data["legend"]["title"] == "my_legend_name"
        assert v2_data["legend"]["name"] is None

    def test_upgrade_with_color_by_value_sets_name_to_null(self):
        """With colorByValue, V2 name should be null."""
        v1_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "colorByValue": {
                "valueColumn": "population",
                "upperBound": 100,
                "lowerBound": 0,
                "startColor": [0, 255, 0, 255],
                "endColor": [255, 0, 0, 255],
                "breakpoints": [],
            },
            "legend": {"name": "my_legend_name"},
        }

        v2_data = GeoSetLayerV2Schema.upgrade_from_previous_version(v1_data)

        assert v2_data["legend"]["title"] == "my_legend_name"
        assert v2_data["legend"]["name"] is None

    def test_upgrade_preserves_other_fields(self):
        """Upgrade should preserve all non-legend fields."""
        v1_data = {
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
            "legend": {"name": "my_legend_name"},
        }

        v2_data = GeoSetLayerV2Schema.upgrade_from_previous_version(v1_data)

        assert v2_data["globalColoring"] == v1_data["globalColoring"]
        assert v2_data["colorByCategory"] == v1_data["colorByCategory"]

    def test_upgraded_schema_without_coloring_validates(self):
        """Upgraded V1 schema without coloring should pass V2 validation."""
        v1_data = {
            "globalColoring": {
                "fillColor": [40, 147, 179, 255],
                "strokeColor": [0, 0, 0, 255],
                "strokeWidth": 2,
                "lineStyle": "solid",
                "fillPattern": "solid",
            },
            "legend": {"name": "my_legend_name"},
        }

        v2_data = GeoSetLayerV2Schema.upgrade_from_previous_version(v1_data)
        schema = GeoSetLayerV2Schema()
        result = schema.load(v2_data)

        assert isinstance(result, dict)
        assert result["legend"]["title"] == "my_legend_name"
        assert result["legend"]["name"] == "my_legend_name"

    def test_upgraded_schema_with_coloring_validates(self):
        """Upgraded V1 schema with coloring should pass V2 validation."""
        v1_data = {
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
            "legend": {"name": "my_legend_name"},
        }

        v2_data = GeoSetLayerV2Schema.upgrade_from_previous_version(v1_data)
        schema = GeoSetLayerV2Schema()
        result = schema.load(v2_data)

        assert isinstance(result, dict)
        assert result["legend"]["title"] == "my_legend_name"
        assert result["legend"]["name"] is None
