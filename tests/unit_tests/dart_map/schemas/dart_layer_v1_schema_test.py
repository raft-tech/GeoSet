"""Tests for DartLayerV1Schema validation logic."""

import copy
import json
from pathlib import Path

import pytest
from marshmallow import ValidationError

from superset.dart_map.schemas.DartLayerV1Schema import (
    ColorByCategorySchema,
    ColorByValueSchema,
    DartLayerV1Schema,
    GlobalColoringSchema,
)


@pytest.fixture
def base_schema_data():
    """Load base schema data from schemaExampleV1.json."""
    schema_path = Path(__file__).parent / "schemaExampleV1.json"
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
        "legend": {"name": "test_name"},
    }


# =============================================================================
# ColorField Validation Tests
# =============================================================================


class TestColorFieldValidation:
    """Tests for RGBA color array validation."""

    @pytest.mark.parametrize(
        "color",
        [
            [0, 0, 0, 0],
            [255, 255, 255, 255],
            [40, 147, 179, 255],
            [128, 128, 128, 128],
        ],
    )
    def test_valid_color_values(self, valid_global_coloring, color):
        """Valid RGBA colors with values 0-255 should pass validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["fillColor"] = color
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["fill_color"] == color

    @pytest.mark.parametrize(
        "color",
        [
            pytest.param([256, 0, 0, 255], id="value exceeds 255"),
            pytest.param([-1, 0, 0, 255], id="negative value"),
            pytest.param([0, 0, 0], id="only 3 values"),
            pytest.param([0, 0, 0, 0, 0], id="5 values"),
            pytest.param([], id="empty array"),
            pytest.param([128.5, 0, 0, 255], id="float value"),
            pytest.param([0, 0, 0, 255.0], id="float with zero decimal"),
        ],
    )
    def test_invalid_color_values(self, valid_global_coloring, color):
        """Invalid RGBA colors should fail validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["fillColor"] = color
        with pytest.raises(ValidationError):
            schema.load(data)


# =============================================================================
# LineStyle Validation Tests
# =============================================================================


class TestLineStyleValidation:
    """Tests for lineStyle field validation."""

    @pytest.mark.parametrize("line_style", ["solid", "dashed", "dotted"])
    def test_valid_line_styles(self, valid_global_coloring, line_style):
        """Valid lineStyle values should pass validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["lineStyle"] = line_style
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["line_style"] == line_style

    @pytest.mark.parametrize(
        "line_style",
        [
            "invalid",
            "SOLID",
            "Dashed",
            "",
            "none",
            "double",
        ],
    )
    def test_invalid_line_styles(self, valid_global_coloring, line_style):
        """Invalid lineStyle values should fail validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["lineStyle"] = line_style
        with pytest.raises(ValidationError):
            schema.load(data)


# =============================================================================
# FillPattern Validation Tests
# =============================================================================


class TestFillPatternValidation:
    """Tests for fillPattern field validation."""

    def test_valid_fill_pattern(self, valid_global_coloring):
        """fillPattern 'solid' should pass validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["fillPattern"] = "solid"
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["fill_pattern"] == "solid"

    @pytest.mark.parametrize(
        "fill_pattern",
        [
            "striped",
            "dotted",
            "SOLID",
            "",
            "none",
            "hatched",
        ],
    )
    def test_invalid_fill_patterns(self, valid_global_coloring, fill_pattern):
        """fillPattern values other than 'solid' should fail validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["fillPattern"] = fill_pattern
        with pytest.raises(ValidationError):
            schema.load(data)


# =============================================================================
# PointType Validation Tests
# =============================================================================


class TestPointTypeValidation:
    """Tests for pointType field validation."""

    @pytest.mark.parametrize("point_type", ["circle", "fema", "fire", "point", "line"])
    def test_valid_point_types(self, valid_global_coloring, point_type):
        """Valid pointType values should pass validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["pointType"] = point_type
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["point_type"] == point_type

    def test_point_type_optional(self, valid_global_coloring):
        """pointType should be optional (defaults to None when not provided)."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        # Ensure pointType is not in the data
        data.pop("pointType", None)
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["point_type"] is None

    @pytest.mark.parametrize(
        "point_type",
        [
            "invalid",
            "CIRCLE",
            "Circle",
            "",
            "square",
            "triangle",
        ],
    )
    def test_invalid_point_types(self, valid_global_coloring, point_type):
        """Invalid pointType values should fail validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["pointType"] = point_type
        with pytest.raises(ValidationError):
            schema.load(data)


# =============================================================================
# PointSize Validation Tests
# =============================================================================


class TestPointSizeValidation:
    """Tests for pointSize field validation."""

    @pytest.mark.parametrize("point_size", [1, 25, 50])
    def test_valid_point_sizes(self, valid_global_coloring, point_size):
        """Valid pointSize values (1-50) should pass validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["pointSize"] = point_size
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["point_size"] == point_size

    def test_point_size_optional(self, valid_global_coloring):
        """pointSize should be optional (defaults to None when not provided)."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        # Ensure pointSize is not in the data
        data.pop("pointSize", None)
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["point_size"] is None

    @pytest.mark.parametrize(
        "point_size",
        [
            pytest.param(0, id="below minimum"),
            pytest.param(-1, id="negative value"),
            pytest.param(51, id="above maximum"),
            pytest.param(100, id="well above maximum"),
        ],
    )
    def test_invalid_point_sizes(self, valid_global_coloring, point_size):
        """Invalid pointSize values (outside 1-50) should fail validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["pointSize"] = point_size
        with pytest.raises(ValidationError):
            schema.load(data)


# =============================================================================
# StrokeWidth Validation Tests
# =============================================================================


class TestStrokeWidthValidation:
    """Tests for strokeWidth field validation."""

    @pytest.mark.parametrize(
        "stroke_width",
        [
            pytest.param(0, id="zero integer"),
            pytest.param(1, id="positive integer"),
            pytest.param(10, id="larger integer"),
            pytest.param(0.0, id="zero float"),
            pytest.param(0.5, id="fractional float"),
            pytest.param(2.5, id="positive float"),
        ],
    )
    def test_valid_stroke_widths(self, valid_global_coloring, stroke_width):
        """Valid strokeWidth values (integers or floats >= 0) should pass."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["strokeWidth"] = stroke_width
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["stroke_width"] == stroke_width

    @pytest.mark.parametrize(
        "stroke_width",
        [
            pytest.param(-1, id="negative integer"),
            pytest.param(-0.5, id="negative float"),
            pytest.param(-10, id="larger negative integer"),
        ],
    )
    def test_invalid_stroke_widths(self, valid_global_coloring, stroke_width):
        """Negative strokeWidth values should fail validation."""
        schema = GlobalColoringSchema()
        data = copy.deepcopy(valid_global_coloring)
        data["strokeWidth"] = stroke_width
        with pytest.raises(ValidationError):
            schema.load(data)


# =============================================================================
# Bounds and Breakpoints Validation Tests
# =============================================================================


class TestBoundsAndBreakpointsValidation:
    """Tests for ColorByValueSchema bounds and breakpoints validation."""

    @pytest.fixture
    def valid_color_by_value(self):
        """Valid colorByValue configuration."""
        return {
            "valueColumn": "population",
            "upperBound": 100,
            "lowerBound": 0,
            "startColor": [0, 255, 0, 255],
            "endColor": [255, 0, 0, 255],
            "breakpoints": [25, 50, 75],
        }

    def test_valid_bounds_and_breakpoints(self, valid_color_by_value):
        """Valid bounds with breakpoints within range should pass."""
        schema = ColorByValueSchema()
        result = schema.load(valid_color_by_value)
        assert isinstance(result, dict)
        assert result["upper_bound"] == 100
        assert result["lower_bound"] == 0
        assert result["breakpoints"] == [25, 50, 75]

    def test_valid_null_bounds(self, valid_color_by_value):
        """Null bounds should pass validation."""
        schema = ColorByValueSchema()
        data = copy.deepcopy(valid_color_by_value)
        data["upperBound"] = None
        data["lowerBound"] = None
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["upper_bound"] is None
        assert result["lower_bound"] is None

    def test_valid_empty_breakpoints(self, valid_color_by_value):
        """Empty breakpoints array should pass validation."""
        schema = ColorByValueSchema()
        data = copy.deepcopy(valid_color_by_value)
        data["breakpoints"] = []
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["breakpoints"] == []

    def test_invalid_upper_bound_less_than_lower_bound(self, valid_color_by_value):
        """upperBound less than lowerBound should fail validation."""
        schema = ColorByValueSchema()
        data = copy.deepcopy(valid_color_by_value)
        data["upperBound"] = 0
        data["lowerBound"] = 100
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "upperBound must be greater than lowerBound" in str(exc_info.value)

    def test_invalid_upper_bound_equal_to_lower_bound(self, valid_color_by_value):
        """upperBound equal to lowerBound should fail validation."""
        schema = ColorByValueSchema()
        data = copy.deepcopy(valid_color_by_value)
        data["upperBound"] = 50
        data["lowerBound"] = 50
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "upperBound must be greater than lowerBound" in str(exc_info.value)

    def test_invalid_breakpoints_not_ascending(self, valid_color_by_value):
        """Breakpoints not in ascending order should fail validation."""
        schema = ColorByValueSchema()
        data = copy.deepcopy(valid_color_by_value)
        data["breakpoints"] = [75, 50, 25]
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "breakpoints must be listed lowest to highest" in str(exc_info.value)

    def test_invalid_breakpoint_below_lower_bound(self, valid_color_by_value):
        """Breakpoint below lowerBound should fail validation."""
        schema = ColorByValueSchema()
        data = copy.deepcopy(valid_color_by_value)
        data["breakpoints"] = [-10, 50, 75]
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "breakpoints must be between lowerBound and upperBound" in str(
            exc_info.value
        )

    def test_invalid_breakpoint_above_upper_bound(self, valid_color_by_value):
        """Breakpoint above upperBound should fail validation."""
        schema = ColorByValueSchema()
        data = copy.deepcopy(valid_color_by_value)
        data["breakpoints"] = [25, 50, 150]
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "breakpoints must be between lowerBound and upperBound" in str(
            exc_info.value
        )


# =============================================================================
# ColorByCategory Schema Tests
# =============================================================================


class TestColorByCategorySchema:
    """Tests for ColorByCategorySchema validation."""

    @pytest.fixture
    def valid_color_by_category(self):
        """Valid colorByCategory configuration."""
        return {
            "dimension": "category_column",
            "categoricalColors": [
                {
                    "category_1_name": {
                        "fillColor": [0, 0, 255, 255],
                        "legend_entry_name": "category_1_legend_name",
                    }
                }
            ],
            "defaultLegendName": ["Other"],
        }

    def test_valid_color_by_category_with_default_legend_name(
        self, valid_color_by_category
    ):
        """colorByCategory with defaultLegendName should pass validation."""
        schema = ColorByCategorySchema()
        result = schema.load(valid_color_by_category)
        assert isinstance(result, dict)
        assert result["default_legend_name"] == ["Other"]

    def test_valid_color_by_category_without_default_legend_name(
        self, valid_color_by_category
    ):
        """colorByCategory without defaultLegendName should pass validation."""
        schema = ColorByCategorySchema()
        data = copy.deepcopy(valid_color_by_category)
        del data["defaultLegendName"]
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result.get("default_legend_name") is None


# =============================================================================
# ColorByCategory/ColorByValue Mutual Exclusivity Tests
# =============================================================================


class TestColoringMutualExclusivity:
    """Tests for colorByCategory and colorByValue mutual exclusivity."""

    def test_valid_with_only_color_by_category(self, base_schema_data):
        """Schema with only colorByCategory should pass validation."""
        schema = DartLayerV1Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByValue"]
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["color_by_category"] is not None
        assert result["color_by_value"] is None

    def test_valid_with_only_color_by_value(self, base_schema_data):
        """Schema with only colorByValue should pass validation."""
        schema = DartLayerV1Schema()
        data = copy.deepcopy(base_schema_data)
        del data["colorByCategory"]
        result = schema.load(data)
        assert isinstance(result, dict)
        assert result["color_by_value"] is not None
        assert result["color_by_category"] is None

    def test_valid_with_neither_coloring_option(self, minimal_valid_schema):
        """Schema with neither colorByCategory nor colorByValue should pass."""
        schema = DartLayerV1Schema()
        result = schema.load(minimal_valid_schema)
        assert isinstance(result, dict)
        assert result["color_by_category"] is None
        assert result["color_by_value"] is None

    def test_invalid_with_both_coloring_options(self, base_schema_data):
        """Schema with both colorByCategory and colorByValue should fail."""
        schema = DartLayerV1Schema()
        data = copy.deepcopy(base_schema_data)
        with pytest.raises(ValidationError) as exc_info:
            schema.load(data)
        assert "Only one of colorByCategory or colorByValue" in str(exc_info.value)
