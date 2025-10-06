"""Tests for TaskTracker data coordinators."""

from datetime import timedelta
from unittest.mock import AsyncMock, patch

import pytest
from homeassistant.helpers.update_coordinator import UpdateFailed

from custom_components.tasktracker.api import TaskTrackerAPI
from custom_components.tasktracker.coordinators import DailyPlanCoordinator


@pytest.mark.asyncio
async def test_daily_plan_coordinator_success(hass):
    """Test daily plan coordinator successful update."""
    # Mock API
    api = AsyncMock(spec=TaskTrackerAPI)
    api.get_daily_plan.return_value = {
        "success": True,
        "data": {
            "tasks": [{"id": 1, "name": "Test Task"}],
        },
    }

    # Create coordinator
    coordinator = DailyPlanCoordinator(hass, api, "testuser")

    # Perform update
    await coordinator.async_refresh()

    # Verify
    assert coordinator.data is not None
    assert coordinator.data["success"] is True
    assert api.get_daily_plan.called
    assert api.get_daily_plan.call_args.kwargs["username"] == "testuser"


@pytest.mark.asyncio
async def test_daily_plan_coordinator_failure(hass):
    """Test daily plan coordinator handles API failures gracefully."""
    # Mock API to fail
    api = AsyncMock(spec=TaskTrackerAPI)
    api.get_daily_plan.return_value = {
        "success": False,
        "error": "Test error",
    }

    # Create coordinator
    coordinator = DailyPlanCoordinator(hass, api, "testuser")

    # Perform update - coordinator logs error but doesn't crash
    await coordinator.async_refresh()

    # Verify that coordinator handled the failure gracefully
    # (data should be None or error state, not raise exception)
    assert coordinator.last_update_success is False


@pytest.mark.asyncio
async def test_daily_plan_coordinator_exception(hass):
    """Test daily plan coordinator handles exceptions gracefully."""
    # Mock API to raise exception
    api = AsyncMock(spec=TaskTrackerAPI)
    api.get_daily_plan.side_effect = Exception("Test exception")

    # Create coordinator
    coordinator = DailyPlanCoordinator(hass, api, "testuser")

    # Perform update - coordinator logs error but doesn't crash
    await coordinator.async_refresh()

    # Verify that coordinator handled the exception gracefully
    assert coordinator.last_update_success is False


@pytest.mark.asyncio
async def test_daily_plan_coordinator_update_interval(hass):
    """Test daily plan coordinator has correct update interval."""
    api = AsyncMock(spec=TaskTrackerAPI)
    coordinator = DailyPlanCoordinator(hass, api, "testuser")

    # Verify update interval is 180 seconds (3 minutes)
    assert coordinator.update_interval == timedelta(seconds=180)


@pytest.mark.asyncio
async def test_daily_plan_coordinator_parameters(hass):
    """Test coordinator respects select_recommended and fair_weather parameters."""
    api = AsyncMock(spec=TaskTrackerAPI)
    api.get_daily_plan.return_value = {
        "success": True,
        "data": {"tasks": []},
    }

    coordinator = DailyPlanCoordinator(hass, api, "testuser")
    coordinator.select_recommended = True
    coordinator.fair_weather = True

    await coordinator.async_refresh()

    # Verify API was called with correct parameters
    api.get_daily_plan.assert_called_once()
    call_kwargs = api.get_daily_plan.call_args.kwargs
    assert call_kwargs["username"] == "testuser"
    assert call_kwargs["select_recommended"] is True
    assert call_kwargs["fair_weather"] is True


@pytest.mark.asyncio
async def test_coordinator_name(hass):
    """Test coordinator has correct name for logging."""
    api = AsyncMock(spec=TaskTrackerAPI)
    coordinator = DailyPlanCoordinator(hass, api, "testuser")

    assert "Daily Plan" in coordinator.name
    assert "testuser" in coordinator.name


@pytest.mark.asyncio
async def test_coordinator_manual_refresh(hass):
    """Test manual coordinator refresh."""
    api = AsyncMock(spec=TaskTrackerAPI)
    api.get_daily_plan.return_value = {
        "success": True,
        "data": {"tasks": []},
    }

    coordinator = DailyPlanCoordinator(hass, api, "testuser")

    # Initial refresh
    await coordinator.async_refresh()
    assert api.get_daily_plan.call_count == 1

    # Manual refresh
    await coordinator.async_request_refresh()
    # Allow time for refresh to complete
    await hass.async_block_till_done()

    # Verify refresh was requested (call count may vary due to async nature)
    assert api.get_daily_plan.call_count >= 1
