"""Tests for schema version validation in the DART map API."""

import pytest

from superset.dart_map.api import parse_version_number


class TestParseVersionNumber:
    """Tests for the parse_version_number helper function."""

    @pytest.mark.parametrize(
        "version,expected",
        [
            ("v1", 1),
            ("v2", 2),
            ("v10", 10),
            ("v100", 100),
            ("v0", 0),
        ],
    )
    def test_valid_version_formats(self, version: str, expected: int):
        """Test that valid version strings are parsed correctly."""
        assert parse_version_number(version) == expected

    @pytest.mark.parametrize(
        "version",
        [
            "1",  # missing 'v' prefix
            "V1",  # uppercase V
            "v",  # missing number
            "version1",  # wrong prefix
            "v1.0",  # decimal version
            "v-1",  # negative number
            "v1a",  # trailing characters
            "",  # empty string
            "va",  # non-numeric
        ],
    )
    def test_invalid_version_formats(self, version: str):
        """Test that invalid version strings return None."""
        assert parse_version_number(version) is None


class TestVersionOrderingValidation:
    """Tests for version ordering validation logic."""

    @pytest.mark.parametrize(
        "from_version,to_version",
        [
            ("v1", "v2"),
            ("v1", "v3"),
            ("v1", "v10"),
            ("v2", "v3"),
            ("v9", "v10"),
        ],
    )
    def test_valid_version_ordering(self, from_version: str, to_version: str):
        """Test that from_version < to_version is valid."""
        from_num = parse_version_number(from_version)
        to_num = parse_version_number(to_version)
        assert from_num is not None
        assert to_num is not None
        assert from_num < to_num

    @pytest.mark.parametrize(
        "from_version,to_version",
        [
            ("v2", "v1"),  # backwards
            ("v3", "v1"),  # backwards
            ("v10", "v1"),  # backwards (v10 > v1)
            ("v10", "v9"),  # backwards
        ],
    )
    def test_invalid_version_ordering_backwards(
        self, from_version: str, to_version: str
    ):
        """Test that from_version > to_version is invalid."""
        from_num = parse_version_number(from_version)
        to_num = parse_version_number(to_version)
        assert from_num is not None
        assert to_num is not None
        assert from_num >= to_num  # This should be rejected by the API

    @pytest.mark.parametrize(
        "version",
        [
            "v1",
            "v2",
            "v10",
        ],
    )
    def test_same_version_is_invalid(self, version: str):
        """Test that from_version == to_version is invalid."""
        from_num = parse_version_number(version)
        to_num = parse_version_number(version)
        assert from_num == to_num  # This should be rejected by the API
