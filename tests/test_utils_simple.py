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

    def test_validate_api_response_success(self) -> None:
        """Test validating successful API response."""
        response = {"status": "success", "data": {"task_id": 123}}
        result = validate_api_response(response)
        assert result is True

    def test_validate_api_response_error(self) -> None:
        """Test validating error API response."""
        response = {"status": "error", "message": "Task not found"}
        result = validate_api_response(response)
        assert result is False

    def test_validate_api_response_malformed(self) -> None:
        """Test validating malformed API response."""
        response = {"invalid": "response"}
        result = validate_api_response(response)
        assert result is False

    def test_validate_api_response_none(self) -> None:
        """Test validating None response."""
        result = validate_api_response(None)
        assert result is False
