"""Tests for TaskTracker utility functions."""

from collections.abc import AsyncGenerator

import pytest
import pytest_asyncio
from homeassistant.core import HomeAssistant

from custom_components.tasktracker.const import CONF_USERS, DOMAIN
from custom_components.tasktracker.utils import (
    format_task_duration,
    format_task_priority,
    format_time_ago,
    get_current_user_context,
    get_ha_user_for_tasktracker_username,
    get_integration_data,
    get_tasktracker_username_for_ha_user,
    get_user_context,
    validate_api_response,
)


class TestTaskTrackerUtils:
    """Test TaskTracker utility functions."""

    @pytest_asyncio.fixture
    async def hass_with_config(
        self, hass: HomeAssistant
    ) -> AsyncGenerator[HomeAssistant]:
        """Set up hass with TaskTracker config."""
        hass.data[DOMAIN] = {
            "test_entry": {
                "config": {
                    "users": [
                        {"ha_user_id": "user1", "tasktracker_username": "testuser1"},
                        {"ha_user_id": "user2", "tasktracker_username": "testuser2"},
                    ]
                }
            }
        }
        yield hass

    @pytest.mark.asyncio
    async def test_get_user_context_found(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test getting user context when user mapping exists."""
        result = get_user_context(hass_with_config, "user1")
        assert result == "testuser1"

    @pytest.mark.asyncio
    async def test_get_user_context_not_found(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test getting user context when user mapping doesn't exist."""
        result = get_user_context(hass_with_config, "unknown_user")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_user_context_no_config(self, hass: HomeAssistant) -> None:
        """Test getting user context when no config exists."""
        result = get_user_context(hass, "user1")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_tasktracker_username_for_ha_user_found(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test finding TaskTracker username for HA user."""
        config = {
            CONF_USERS: [
                {"ha_user_id": "user1", "tasktracker_username": "testuser1"},
                {"ha_user_id": "user2", "tasktracker_username": "testuser2"},
            ]
        }

        result = get_tasktracker_username_for_ha_user(hass_with_config, "user1", config)
        assert result == "testuser1"

    @pytest.mark.asyncio
    async def test_get_tasktracker_username_for_ha_user_not_found(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test TaskTracker username not found for HA user."""
        config = {
            CONF_USERS: [
                {"ha_user_id": "user1", "tasktracker_username": "testuser1"},
            ]
        }

        result = get_tasktracker_username_for_ha_user(
            hass_with_config, "unknown_user", config
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_get_tasktracker_username_for_ha_user_no_users(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test TaskTracker username with no users configured."""
        config = {}

        result = get_tasktracker_username_for_ha_user(hass_with_config, "user1", config)
        assert result is None

    @pytest.mark.asyncio
    async def test_get_tasktracker_username_for_ha_user_none_user_id(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test TaskTracker username with None user ID."""
        config = {
            CONF_USERS: [
                {"ha_user_id": "user1", "tasktracker_username": "testuser1"},
            ]
        }

        result = get_tasktracker_username_for_ha_user(hass_with_config, None, config)
        assert result is None

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
        response = {"success": True, "data": {"task_id": 123}}
        result = validate_api_response(response)
        assert result is True

    def test_validate_api_response_error(self) -> None:
        """Test validating error API response."""
        response = {"success": False, "message": "Task not found"}
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

    @pytest.mark.asyncio
    async def test_get_ha_user_for_tasktracker_username_found(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test finding HA user for TaskTracker username."""
        config = {
            CONF_USERS: [
                {"ha_user_id": "user1", "tasktracker_username": "testuser1"},
                {"ha_user_id": "user2", "tasktracker_username": "testuser2"},
            ]
        }

        result = get_ha_user_for_tasktracker_username(
            hass_with_config, "testuser1", config
        )
        assert result == "user1"

    @pytest.mark.asyncio
    async def test_get_ha_user_for_tasktracker_username_not_found(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test HA user not found for TaskTracker username."""
        config = {
            CONF_USERS: [
                {"ha_user_id": "user1", "tasktracker_username": "testuser1"},
            ]
        }

        result = get_ha_user_for_tasktracker_username(
            hass_with_config, "unknown_user", config
        )
        assert result is None

    @pytest.mark.asyncio
    async def test_get_current_user_context(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test getting current user context."""
        config = {
            CONF_USERS: [
                {"ha_user_id": "user1", "tasktracker_username": "testuser1"},
            ]
        }

        result = get_current_user_context(hass_with_config, config)
        assert isinstance(result, dict)

    def test_format_task_priority_low(self) -> None:
        """Test formatting low priority task."""
        result = format_task_priority(3)
        assert result == "Low"

    def test_format_task_priority_high(self) -> None:
        """Test formatting high priority task."""
        result = format_task_priority(1)
        assert result == "High"

    def test_format_task_priority_medium(self) -> None:
        """Test formatting medium priority task."""
        result = format_task_priority(2)
        assert result == "Medium"

    def test_format_task_priority_very_low(self) -> None:
        """Test formatting very low priority task."""
        result = format_task_priority(4)
        assert result == "Very Low"

    def test_format_task_priority_minimal(self) -> None:
        """Test formatting minimal priority task."""
        result = format_task_priority(5)
        assert result == "Minimal"

    def test_format_task_priority_unknown(self) -> None:
        """Test formatting unknown priority task."""
        result = format_task_priority(10)
        assert result == "Priority 10"

    @pytest.mark.asyncio
    async def test_get_integration_data_found(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test getting integration data when entry exists."""
        result = get_integration_data(hass_with_config, "test_entry")
        assert result is not None
        assert "config" in result

    @pytest.mark.asyncio
    async def test_get_integration_data_not_found(
        self, hass_with_config: HomeAssistant
    ) -> None:
        """Test getting integration data when entry doesn't exist."""
        result = get_integration_data(hass_with_config, "unknown_entry")
        assert result is None

    @pytest.mark.asyncio
    async def test_get_integration_data_no_domain_data(
        self, hass: HomeAssistant
    ) -> None:
        """Test getting integration data when no domain data exists."""
        result = get_integration_data(hass, "test_entry")
        assert result is None

    def test_format_task_duration_negative(self) -> None:
        """Test formatting negative duration."""
        result = format_task_duration(-30)
        # Check that it handles negative values gracefully
        assert isinstance(result, str)

    def test_format_time_ago_future(self) -> None:
        """Test formatting time ago with negative value (future)."""
        result = format_time_ago(-30)
        # Check that it handles negative values gracefully
        assert isinstance(result, str)
