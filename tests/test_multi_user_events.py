"""Tests for multi-user task completion event handling."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest

from custom_components.tasktracker.const import DOMAIN, SERVICE_COMPLETE_TASK, SERVICE_COMPLETE_TASK_BY_NAME


@pytest.mark.asyncio
async def test_complete_task_includes_assigned_users_in_event(hass, mock_config_entry):
    """Test that completing a task includes assigned_users in the event payload."""
    mock_config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan, \
         patch("custom_components.tasktracker.api.TaskTrackerAPI.complete_task") as mock_complete:

        # Mock coordinator data with task that has assigned_users
        mock_daily_plan.return_value = {
            "success": True,
            "data": {
                "tasks": [
                    {
                        "id": 123,
                        "name": "Shared Task",
                        "assigned_users": ["gabriel", "sara"],
                    }
                ],
            },
        }

        mock_complete.return_value = {
            "success": True,
            "data": {"completion": {"task_id": 123}},
        }

        # Set up the integration
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # Track fired events
        events = []
        def event_listener(event):
            events.append(event.data)

        hass.bus.async_listen("tasktracker_task_completed", event_listener)

        # Complete the task
        await hass.services.async_call(
            DOMAIN,
            SERVICE_COMPLETE_TASK,
            {
                "task_id": 123,
                "completed_by": "gabriel",
            },
            blocking=True,
            return_response=True,
        )

        await hass.async_block_till_done()

        # Verify event was fired with assigned_users
        assert len(events) == 1
        event_data = events[0]
        assert event_data["task_id"] == 123
        assert event_data["username"] == "gabriel"
        assert event_data["assigned_users"] == ["gabriel", "sara"]


@pytest.mark.asyncio
async def test_complete_task_by_name_includes_assigned_users_in_event(hass, mock_config_entry):
    """Test that completing a task by name includes assigned_users in the event payload."""
    mock_config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan, \
         patch("custom_components.tasktracker.api.TaskTrackerAPI.complete_task_by_name") as mock_complete_by_name:

        # Mock coordinator data with task that has assigned_users
        mock_daily_plan.return_value = {
            "success": True,
            "data": {
                "tasks": [
                    {
                        "id": 456,
                        "name": "Put Out Bins",
                        "assigned_users": ["gabriel", "sara"],
                    }
                ],
            },
        }

        mock_complete_by_name.return_value = {
            "success": True,
            "data": {"completion": {"name": "Put Out Bins"}},
        }

        # Set up the integration
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # Track fired events
        events = []
        def event_listener(event):
            events.append(event.data)

        hass.bus.async_listen("tasktracker_task_completed", event_listener)

        # Complete the task by name
        await hass.services.async_call(
            DOMAIN,
            SERVICE_COMPLETE_TASK_BY_NAME,
            {
                "name": "Put Out Bins",
                "completed_by": "sara",
            },
            blocking=True,
            return_response=True,
        )

        await hass.async_block_till_done()

        # Verify event was fired with assigned_users
        assert len(events) == 1
        event_data = events[0]
        assert event_data["task_name"] == "Put Out Bins"
        assert event_data["username"] == "sara"
        assert event_data["assigned_users"] == ["gabriel", "sara"]


@pytest.mark.asyncio
async def test_complete_task_empty_assigned_users_when_task_not_in_coordinator(hass, mock_config_entry):
    """Test that completing a task returns empty assigned_users when task not found in coordinator."""
    mock_config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan, \
         patch("custom_components.tasktracker.api.TaskTrackerAPI.complete_task") as mock_complete:

        # Mock coordinator data WITHOUT the task being completed
        mock_daily_plan.return_value = {
            "success": True,
            "data": {
                "tasks": [
                    {
                        "id": 999,  # Different task
                        "name": "Other Task",
                        "assigned_users": ["testuser1"],
                    }
                ],
            },
        }

        mock_complete.return_value = {
            "success": True,
            "data": {"completion": {"task_id": 123}},
        }

        # Set up the integration
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # Track fired events
        events = []
        def event_listener(event):
            events.append(event.data)

        hass.bus.async_listen("tasktracker_task_completed", event_listener)

        # Complete a task that's not in coordinator data
        await hass.services.async_call(
            DOMAIN,
            SERVICE_COMPLETE_TASK,
            {
                "task_id": 123,
                "completed_by": "gabriel",
            },
            blocking=True,
            return_response=True,
        )

        await hass.async_block_till_done()

        # Verify event was fired with empty assigned_users (safe fallback)
        assert len(events) == 1
        event_data = events[0]
        assert event_data["task_id"] == 123
        assert event_data["assigned_users"] == []


@pytest.mark.asyncio
async def test_complete_task_searches_all_coordinators_for_assigned_users(hass):
    """Test that task completion searches all user coordinators to find assigned_users."""
    # Create config entry with multiple users
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    config_entry = MockConfigEntry(
        domain=DOMAIN,
        title="TaskTracker",
        data={
            "host": "http://test-server",
            "api_key": "test-key",
            "users": [
                {"tasktracker_username": "gabriel", "ha_user_id": "user1"},
                {"tasktracker_username": "sara", "ha_user_id": "user2"},
            ],
        },
    )
    config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan, \
         patch("custom_components.tasktracker.api.TaskTrackerAPI.complete_task") as mock_complete:

        # Mock different responses for each user's coordinator
        def mock_daily_plan_side_effect(*args, **kwargs):
            username = kwargs.get("username")
            if username == "gabriel":
                # Gabriel's coordinator doesn't have the task
                return {"success": True, "data": {"tasks": []}}
            elif username == "sara":
                # Sara's coordinator has the task with full assigned_users
                return {
                    "success": True,
                    "data": {
                        "tasks": [
                            {
                                "id": 789,
                                "name": "Multi-User Task",
                                "assigned_users": ["gabriel", "sara"],
                            }
                        ],
                    },
                }
            return {"success": True, "data": {"tasks": []}}

        mock_daily_plan.side_effect = mock_daily_plan_side_effect

        mock_complete.return_value = {
            "success": True,
            "data": {"completion": {"task_id": 789}},
        }

        # Set up the integration
        await hass.config_entries.async_setup(config_entry.entry_id)
        await hass.async_block_till_done()

        # Track fired events
        events = []
        def event_listener(event):
            events.append(event.data)

        hass.bus.async_listen("tasktracker_task_completed", event_listener)

        # Complete the task
        await hass.services.async_call(
            DOMAIN,
            SERVICE_COMPLETE_TASK,
            {
                "task_id": 789,
                "completed_by": "gabriel",
            },
            blocking=True,
            return_response=True,
        )

        await hass.async_block_till_done()

        # Verify event was fired with assigned_users found in Sara's coordinator
        assert len(events) == 1
        event_data = events[0]
        assert event_data["task_id"] == 789
        assert event_data["username"] == "gabriel"
        assert event_data["assigned_users"] == ["gabriel", "sara"]


@pytest.mark.asyncio
async def test_complete_task_invalidates_all_user_caches(hass):
    """Test that completing a task invalidates caches for all configured users."""
    # Create config entry with multiple users
    from pytest_homeassistant_custom_component.common import MockConfigEntry

    config_entry = MockConfigEntry(
        domain=DOMAIN,
        title="TaskTracker",
        data={
            "host": "http://test-server",
            "api_key": "test-key",
            "users": [
                {"tasktracker_username": "gabriel", "ha_user_id": "user1"},
                {"tasktracker_username": "sara", "ha_user_id": "user2"},
            ],
        },
    )
    config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan, \
         patch("custom_components.tasktracker.api.TaskTrackerAPI.complete_task") as mock_complete:

        mock_daily_plan.return_value = {"success": True, "data": {"tasks": []}}
        mock_complete.return_value = {
            "success": True,
            "data": {"completion": {"task_id": 123}},
        }

        # Set up the integration
        await hass.config_entries.async_setup(config_entry.entry_id)
        await hass.async_block_till_done()

        # Get cache and add entries for both users
        entry_data = hass.data[DOMAIN][config_entry.entry_id]
        cache = entry_data["cache"]

        await cache.set("test:gabriel", {"data": "gabriel_data"})
        await cache.set("test:sara", {"data": "sara_data"})
        await cache.set("shared:None", {"data": "shared_data"})

        # Verify data is cached
        assert await cache.get("test:gabriel", ttl=300) is not None
        assert await cache.get("test:sara", ttl=300) is not None
        assert await cache.get("shared:None", ttl=300) is not None

        # Complete a task
        await hass.services.async_call(
            DOMAIN,
            SERVICE_COMPLETE_TASK,
            {
                "task_id": 123,
                "completed_by": "gabriel",
            },
            blocking=True,
            return_response=True,
        )

        await hass.async_block_till_done()

        # Verify ALL user caches were invalidated
        assert await cache.get("test:gabriel", ttl=300) is None
        assert await cache.get("test:sara", ttl=300) is None
        # Note: shared cache won't have :gabriel or :sara pattern, so won't be invalidated by pattern match
        # but will be invalidated by the explicit shared cache invalidation logic


@pytest.mark.asyncio
async def test_leftover_disposal_includes_assigned_users_in_event(hass, mock_config_entry):
    """Test that disposing a leftover (via complete_task_by_name with event_type) includes assigned_users."""
    mock_config_entry.add_to_hass(hass)

    with patch("custom_components.tasktracker.api.TaskTrackerAPI.get_daily_plan") as mock_daily_plan, \
         patch("custom_components.tasktracker.api.TaskTrackerAPI.complete_task_by_name") as mock_complete_by_name:

        # Mock coordinator data - leftovers don't appear in daily plan, so assigned_users will be empty
        mock_daily_plan.return_value = {
            "success": True,
            "data": {"tasks": []},
        }

        mock_complete_by_name.return_value = {
            "success": True,
            "data": {"completion": {"name": "Old Pizza"}},
        }

        # Set up the integration
        await hass.config_entries.async_setup(mock_config_entry.entry_id)
        await hass.async_block_till_done()

        # Track fired events
        events = []
        def event_listener(event):
            events.append(event.data)

        hass.bus.async_listen("tasktracker_leftover_disposed", event_listener)

        # Dispose the leftover (complete_task_by_name with event_type)
        await hass.services.async_call(
            DOMAIN,
            SERVICE_COMPLETE_TASK_BY_NAME,
            {
                "name": "Old Pizza",
                "completed_by": "gabriel",
                "event_type": "leftover_disposed",
            },
            blocking=True,
            return_response=True,
        )

        await hass.async_block_till_done()

        # Verify event was fired with assigned_users (empty because leftovers not in daily plan)
        assert len(events) == 1
        event_data = events[0]
        assert event_data["leftover_name"] == "Old Pizza"
        assert event_data["username"] == "gabriel"
        assert "assigned_users" in event_data
