"""Integration tests for TaskTracker using Home Assistant test framework."""

from unittest.mock import AsyncMock

import pytest
from aiohttp import ClientSession
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tasktracker.api import TaskTrackerAPI
from custom_components.tasktracker.const import DOMAIN


@pytest.mark.asyncio
async def test_setup_integration(
    hass: HomeAssistant, enable_custom_integrations: bool
) -> None:
    """Test setting up the integration."""
    config_entry = MockConfigEntry(
        domain=DOMAIN,
        data={
            "host": "https://test.example.com",
            "api_key": "test-api-key",
            "users": [],
        },
        entry_id="test",
        title="TaskTracker Test",
    )
    config_entry.add_to_hass(hass)

    # Test that the integration can be loaded
    assert config_entry.domain == DOMAIN
    assert config_entry.data["host"] == "https://test.example.com"


def test_basic_utility_functions() -> None:
    """Test basic utility functions without Home Assistant."""
    from custom_components.tasktracker.utils import (
        format_task_duration,
        format_time_ago,
        validate_api_response,
    )

    # Test format_task_duration
    assert format_task_duration(15) == "15 min"
    assert format_task_duration(60) == "1 hr"
    assert format_task_duration(90) == "1 hr 30 min"
    assert format_task_duration(0) == "0 min"

    # Test format_time_ago
    assert format_time_ago(30) == "30 minutes ago"
    assert format_time_ago(60) == "1 hour ago"
    assert format_time_ago(1440) == "1 day ago"

    # Test validate_api_response
    assert validate_api_response({"status": "success"}) is True
    assert validate_api_response({"status": "error"}) is False
    assert validate_api_response(None) is False


def test_api_client_creation() -> None:
    """Test API client creation without network calls."""
    session = AsyncMock(spec=ClientSession)
    api = TaskTrackerAPI(
        session=session, host="https://test.example.com", api_key="test-api-key"
    )

    # Test headers formation
    headers = api._get_headers()  # noqa: SLF001
    assert headers["X-API-Key"] == "test-api-key"
    assert headers["Content-Type"] == "application/json"
