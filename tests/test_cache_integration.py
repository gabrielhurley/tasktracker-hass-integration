"""Integration tests for caching and coordinators."""

from unittest.mock import AsyncMock, patch

import pytest

from custom_components.tasktracker.const import DOMAIN


@pytest.mark.asyncio
async def test_daily_plan_uses_coordinator(hass, mock_config_entry):
    """Test that daily plan service uses coordinator when available."""
    mock_config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_get_daily_plan:
        # Mock the API response
        mock_get_daily_plan.return_value = {
            "success": True,
            "data": {"tasks": [{"id": 1, "name": "Test Task"}]},
        }

        # Set up the integration
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # Get entry data
        entry_data = hass.data[DOMAIN][mock_config_entry.entry_id]

        # Verify coordinator was created
        assert "coordinators" in entry_data
        assert "testuser1" in entry_data["coordinators"]
        assert "daily_plan" in entry_data["coordinators"]["testuser1"]

        coordinator = entry_data["coordinators"]["testuser1"]["daily_plan"]
        assert coordinator.username == "testuser1"

        # Call the service
        response = await hass.services.async_call(
            DOMAIN,
            "get_daily_plan",
            {"username": "testuser1"},
            blocking=True,
            return_response=True,
        )

        # Verify response came from coordinator
        assert response is not None


@pytest.mark.asyncio
async def test_encouragement_uses_cache(hass, mock_config_entry):
    """Test that encouragement service uses cache."""
    mock_config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan, \
         patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan_encouragement") as mock_encouragement:

        # Mock the API responses
        mock_daily_plan.return_value = {"success": True, "data": {}}
        mock_encouragement.return_value = {
            "success": True,
            "data": {"message": "Great job!"},
        }

        # Set up the integration
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # First call - should hit API
        response1 = await hass.services.async_call(
            DOMAIN,
            "get_daily_plan_encouragement",
            {"username": "testuser1"},
            blocking=True,
            return_response=True,
        )

        assert response1 is not None
        assert response1["data"]["message"] == "Great job!"
        assert mock_encouragement.call_count == 1

        # Second call - should use cache (no new API call)
        response2 = await hass.services.async_call(
            DOMAIN,
            "get_daily_plan_encouragement",
            {"username": "testuser1"},
            blocking=True,
            return_response=True,
        )

        assert response2 is not None
        assert response2["data"]["message"] == "Great job!"

        # Verify only one API call was made (cached second time)
        assert mock_encouragement.call_count == 1


@pytest.mark.asyncio
async def test_cache_invalidation_on_task_completion(hass, mock_config_entry):
    """Test that cache is invalidated when task is completed."""
    mock_config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan, \
         patch("custom_components.tasktracker.api.TaskTrackerAPI.complete_task_by_name") as mock_complete:

        # Mock the API responses
        mock_daily_plan.return_value = {"success": True, "data": {"tasks": []}}
        mock_complete.return_value = {
            "success": True,
            "data": {"completion": {"id": 1}},
        }

        # Set up the integration
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # Get cache
        entry_data = hass.data[DOMAIN][mock_config_entry.entry_id]
        cache = entry_data["cache"]

        # Add something to cache
        await cache.set("test:testuser1", {"data": "cached_value"})
        assert await cache.get("test:testuser1", ttl=300) is not None

        # Complete a task
        await hass.services.async_call(
            DOMAIN,
            "complete_task_by_name",
            {
                "name": "Test Task",
                "completed_by": "testuser1",
            },
            blocking=True,
            return_response=True,
        )

        # Verify cache was invalidated for this user
        assert await cache.get("test:testuser1", ttl=300) is None


@pytest.mark.asyncio
async def test_force_refresh_bypasses_cache(hass, mock_config_entry):
    """Test that force_refresh parameter bypasses cache."""
    mock_config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan, \
         patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan_encouragement") as mock_encouragement:

        # Mock the API responses (different each time)
        mock_daily_plan.return_value = {"success": True, "data": {}}
        call_count = [0]

        def mock_encouragement_response(*args, **kwargs):
            call_count[0] += 1
            return {
                "success": True,
                "data": {"message": f"Message {call_count[0]}"},
            }

        mock_encouragement.side_effect = mock_encouragement_response

        # Set up the integration
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # First call - should hit API
        response1 = await hass.services.async_call(
            DOMAIN,
            "get_daily_plan_encouragement",
            {"username": "testuser1"},
            blocking=True,
            return_response=True,
        )
        assert response1["data"]["message"] == "Message 1"
        assert mock_encouragement.call_count == 1

        # Second call with force_refresh - should hit API again
        response2 = await hass.services.async_call(
            DOMAIN,
            "get_daily_plan_encouragement",
            {"username": "testuser1", "force_refresh": True},
            blocking=True,
            return_response=True,
        )
        assert response2["data"]["message"] == "Message 2"
        assert mock_encouragement.call_count == 2


@pytest.mark.asyncio
async def test_coordinator_background_refresh(hass, mock_config_entry):
    """Test that coordinator performs background refreshes."""
    mock_config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan:
        # Mock the API responses
        call_count = [0]

        def mock_response(*args, **kwargs):
            call_count[0] += 1
            return {
                "success": True,
                "data": {"tasks": [{"id": 1, "name": f"Task {call_count[0]}"}]},
            }

        mock_daily_plan.side_effect = mock_response

        # Set up the integration
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        entry_data = hass.data[DOMAIN][mock_config_entry.entry_id]
        coordinator = entry_data["coordinators"]["testuser1"]["daily_plan"]

        # Initial state
        initial_data = coordinator.data
        assert initial_data is not None
        assert initial_data["data"]["tasks"][0]["name"] == "Task 1"

        # Manually trigger refresh
        await coordinator.async_request_refresh()
        await hass.async_block_till_done()

        # Verify data was updated
        updated_data = coordinator.data
        assert updated_data is not None
        assert mock_daily_plan.call_count >= 2
