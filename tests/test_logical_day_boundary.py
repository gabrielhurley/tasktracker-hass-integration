"""
Tests for logical day boundary detection in the daily plan service.

These tests validate that the coordinator correctly detects when a new logical
day has started and forces a refresh to prevent serving stale data from yesterday.

This is a regression test for a bug where user_context was being looked up in the
wrong location (coordinator.data['data']['user_context'] instead of
coordinator.data['user_context']), causing the logical day check to always fail
and serve stale cached data indefinitely.
"""

from datetime import datetime, timedelta
from unittest.mock import AsyncMock, patch
from zoneinfo import ZoneInfo

import pytest
from homeassistant.core import HomeAssistant
from pytest_homeassistant_custom_component.common import MockConfigEntry

from custom_components.tasktracker.const import DOMAIN


@pytest.fixture
async def setup_integration_with_coordinator(hass: HomeAssistant):
    """Set up integration with coordinator containing yesterday's data."""
    entry = MockConfigEntry(
        domain=DOMAIN,
        data={
            "api_key": "test_key",
            "host": "http://test.example.com",
            "users": [
                {
                    "ha_user_id": "test_user_id",
                    "tasktracker_username": "testuser",
                }
            ],
        },
        entry_id="test_entry",
    )
    entry.add_to_hass(hass)

    with (
        patch("custom_components.tasktracker.TaskTrackerAPI") as mock_api_class,
        patch("custom_components.tasktracker.www.JSModuleRegistration.async_register"),
    ):
        mock_api = AsyncMock()
        mock_api_class.return_value = mock_api

        # Mock successful API validation and all service-related endpoints
        mock_api.get_daily_plan.return_value = {
            "success": True,
            "data": {"tasks": [], "self_care": [], "using_defaults": True},
            "user_context": {
                "username": "testuser",
                "timezone": "America/Los_Angeles",
                "daily_reset_time": "05:00:00",
                "current_logical_date": datetime.now(
                    ZoneInfo("America/Los_Angeles")
                ).date().isoformat(),
            },
        }
        mock_api.get_daily_state.return_value = {"success": True}

        assert await hass.config_entries.async_setup(entry.entry_id)
        await hass.async_block_till_done()

    return entry, mock_api


@pytest.mark.asyncio
async def test_logical_day_boundary_detection(
    hass: HomeAssistant, setup_integration_with_coordinator
):
    """Test that logical day boundary is correctly detected from coordinator data.

    This is a regression test for the bug where user_context was being looked up
    in coordinator.data['data']['user_context'] instead of coordinator.data['user_context'].
    """
    entry, mock_api = setup_integration_with_coordinator

    # Get the coordinator for testuser
    entry_data = hass.data[DOMAIN][entry.entry_id]
    coordinator = entry_data["coordinators"]["testuser"]["daily_plan"]

    # Simulate coordinator having data from yesterday's logical day
    yesterday = (datetime.now(ZoneInfo("America/Los_Angeles")) - timedelta(days=1)).date()
    coordinator.data = {
        "success": True,
        "data": {
            "tasks": [{"id": 1, "name": "Old Task"}],
            "self_care": [],
            "using_defaults": False,  # Daily state was set yesterday
        },
        "user_context": {
            "username": "testuser",
            "timezone": "America/Los_Angeles",
            "daily_reset_time": "05:00:00",
            "current_logical_date": yesterday.isoformat(),  # Yesterday's date
        },
    }

    # Mock the API to return fresh data for today
    today = datetime.now(ZoneInfo("America/Los_Angeles")).date()
    mock_api.get_daily_plan.return_value = {
        "success": True,
        "data": {
            "tasks": [{"id": 2, "name": "New Task"}],
            "self_care": [],
            "using_defaults": True,  # No daily state set yet today
        },
        "user_context": {
            "username": "testuser",
            "timezone": "America/Los_Angeles",
            "daily_reset_time": "05:00:00",
            "current_logical_date": today.isoformat(),  # Today's date
        },
    }

    # Call the get_daily_plan service
    result = await hass.services.async_call(
        DOMAIN,
        "get_daily_plan",
        {"username": "testuser"},
        blocking=True,
        return_response=True,
    )

    # Verify that:
    # 1. The API was called (coordinator was refreshed due to logical day change)
    mock_api.get_daily_plan.assert_called()

    # 2. The returned data is from today (using_defaults should be True)
    assert result["success"] is True
    assert result["data"]["using_defaults"] is True
    assert result["user_context"]["current_logical_date"] == today.isoformat()

    # 3. The coordinator's data was updated
    assert coordinator.data["user_context"]["current_logical_date"] == today.isoformat()
    assert coordinator.data["data"]["using_defaults"] is True


@pytest.mark.asyncio
async def test_logical_day_boundary_with_matching_date(
    hass: HomeAssistant, setup_integration_with_coordinator
):
    """Test that coordinator data is used when logical date matches current.

    When coordinator has fresh data with today's logical date, it should be
    returned without triggering an API call.
    """
    entry, mock_api = setup_integration_with_coordinator

    entry_data = hass.data[DOMAIN][entry.entry_id]
    coordinator = entry_data["coordinators"]["testuser"]["daily_plan"]

    # Get today's logical date (the coordinator already has this from setup)
    today = datetime.now(ZoneInfo("America/Los_Angeles")).date()

    # Coordinator has data from today's logical day
    coordinator.data = {
        "success": True,
        "data": {"tasks": [], "self_care": [], "using_defaults": True},
        "user_context": {
            "username": "testuser",
            "timezone": "America/Los_Angeles",
            "daily_reset_time": "05:00:00",
            "current_logical_date": today.isoformat(),
        },
    }

    # Since the coordinator already has data from the current logical day,
    # it should NOT force a refresh
    initial_call_count = mock_api.get_daily_plan.call_count

    result = await hass.services.async_call(
        DOMAIN,
        "get_daily_plan",
        {"username": "testuser"},
        blocking=True,
        return_response=True,
    )

    # Verify the service returned the cached coordinator data
    assert result["success"] is True
    assert result["user_context"]["current_logical_date"] == today.isoformat()

    # Verify API was not called (data was returned from coordinator)
    assert mock_api.get_daily_plan.call_count == initial_call_count


@pytest.mark.asyncio
async def test_logical_day_boundary_with_missing_user_context(
    hass: HomeAssistant, setup_integration_with_coordinator
):
    """Test that missing user_context in coordinator data triggers a refresh.

    This is a defensive check - if user_context is somehow missing or malformed,
    we should force a refresh to be safe.
    """
    entry, mock_api = setup_integration_with_coordinator

    entry_data = hass.data[DOMAIN][entry.entry_id]
    coordinator = entry_data["coordinators"]["testuser"]["daily_plan"]

    # Coordinator has data but user_context is missing (edge case)
    coordinator.data = {
        "success": True,
        "data": {"tasks": [], "self_care": [], "using_defaults": True},
        # Missing user_context
    }

    # Mock fresh API response
    today = datetime.now(ZoneInfo("America/Los_Angeles")).date()
    mock_api.get_daily_plan.return_value = {
        "success": True,
        "data": {"tasks": [], "self_care": [], "using_defaults": True},
        "user_context": {
            "username": "testuser",
            "timezone": "America/Los_Angeles",
            "daily_reset_time": "05:00:00",
            "current_logical_date": today.isoformat(),
        },
    }

    result = await hass.services.async_call(
        DOMAIN,
        "get_daily_plan",
        {"username": "testuser"},
        blocking=True,
        return_response=True,
    )

    # Verify that a refresh was triggered
    mock_api.get_daily_plan.assert_called()

    # Verify fresh data was returned
    assert result["user_context"]["current_logical_date"] == today.isoformat()


@pytest.mark.asyncio
async def test_user_context_location_in_coordinator_data(
    hass: HomeAssistant, setup_integration_with_coordinator
):
    """Test that user_context is correctly accessed from the top level of coordinator.data.

    This is the core regression test for the bug. Previously, the code was looking
    for user_context at coordinator.data['data']['user_context'], but the actual
    API response structure has it at coordinator.data['user_context'].
    """
    entry, mock_api = setup_integration_with_coordinator

    entry_data = hass.data[DOMAIN][entry.entry_id]
    coordinator = entry_data["coordinators"]["testuser"]["daily_plan"]

    # Set up coordinator data with the CORRECT structure
    # (user_context at top level, NOT inside data)
    coordinator.data = {
        "success": True,
        "data": {
            "tasks": [],
            "self_care": [],
            "using_defaults": True,
            # user_context is NOT here
        },
        "user_context": {  # user_context is at TOP LEVEL
            "username": "testuser",
            "timezone": "America/Los_Angeles",
            "daily_reset_time": "05:00:00",
            "current_logical_date": datetime.now(
                ZoneInfo("America/Los_Angeles")
            ).date().isoformat(),
        },
    }

    # Verify the coordinator data structure matches the API response format
    assert "user_context" in coordinator.data
    assert "user_context" not in coordinator.data.get("data", {})
    assert coordinator.data["user_context"]["username"] == "testuser"
    assert coordinator.data["user_context"]["timezone"] == "America/Los_Angeles"
    assert "current_logical_date" in coordinator.data["user_context"]

    # Call the service - it should use the coordinator data without refresh
    # since the logical date matches today
    initial_call_count = mock_api.get_daily_plan.call_count

    result = await hass.services.async_call(
        DOMAIN,
        "get_daily_plan",
        {"username": "testuser"},
        blocking=True,
        return_response=True,
    )

    # Verify coordinator data was returned (no API call needed)
    assert result["success"] is True
    assert "user_context" in result
    assert result["user_context"]["username"] == "testuser"

    # Verify no additional API call was made
    assert mock_api.get_daily_plan.call_count == initial_call_count
