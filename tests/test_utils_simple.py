"""Simple tests for TaskTracker utility functions."""

from custom_components.tasktracker.utils import (
    format_task_duration,
    format_time_ago,
    validate_api_response,
)


class TestTaskTrackerUtilsSimple:
    """Test TaskTracker utility functions that don't require HA fixtures."""

    def test_format_task_duration_minutes(self) -> None:
        """Test formatting task duration in minutes."""
        assert format_task_duration(15) == "15 min"
        assert format_task_duration(1) == "1 min"
        assert format_task_duration(45) == "45 min"

    def test_format_task_duration_hours(self) -> None:
        """Test formatting task duration in hours."""
        assert format_task_duration(60) == "1 hr"
        assert format_task_duration(120) == "2 hr"
        assert format_task_duration(90) == "1 hr 30 min"

    def test_format_task_duration_zero(self) -> None:
        """Test formatting zero duration."""
        assert format_task_duration(0) == "0 min"

    def test_format_time_ago_minutes(self) -> None:
        """Test formatting time ago in minutes."""
        assert format_time_ago(30) == "30 minutes ago"
        assert format_time_ago(1) == "1 minute ago"

    def test_format_time_ago_hours(self) -> None:
        """Test formatting time ago in hours."""
        assert format_time_ago(60) == "1 hour ago"
        assert format_time_ago(120) == "2 hours ago"
        assert format_time_ago(90) == "1 hour ago"

    def test_format_time_ago_days(self) -> None:
        """Test formatting time ago in days."""
        assert format_time_ago(1440) == "1 day ago"  # 24 hours
        assert format_time_ago(2880) == "2 days ago"  # 48 hours

    def test_validate_api_response(self) -> None:
        """Test validate_api_response function."""
        # Test valid response
        response = {"success": True, "data": {"task_id": 123}}
        assert validate_api_response(response) is True

        # Test invalid responses
        assert validate_api_response(None) is False
        assert validate_api_response({}) is False
        assert validate_api_response({"success": False}) is False
        assert validate_api_response({"success": "true"}) is False  # Should be boolean
