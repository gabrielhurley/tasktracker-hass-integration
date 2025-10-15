"""Tests for cache invalidation and event firing in service handlers."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch, call
from aioresponses import aioresponses

from custom_components.tasktracker.const import (
    EVENT_TASK_COMPLETED,
    EVENT_TASK_CREATED,
    EVENT_TASK_UPDATED,
    EVENT_TASK_DELETED,
    EVENT_COMPLETION_DELETED,
    EVENT_COMPLETION_UPDATED,
    EVENT_LEFTOVER_CREATED,
    EVENT_LEFTOVER_DISPOSED,
    EVENT_DAILY_STATE_SET,
)


@pytest.fixture
def mock_hass():
    """Create a mock Home Assistant instance."""
    hass = MagicMock()
    hass.bus = MagicMock()
    hass.bus.fire = MagicMock()
    hass.data = {}
    return hass


@pytest.fixture
def mock_api():
    """Create a mock TaskTracker API."""
    api = MagicMock()
    return api


@pytest.fixture
def mock_service_call(mock_hass):
    """Create a mock service call."""
    call = MagicMock()
    call.hass = mock_hass
    call.context = MagicMock()
    call.context.user_id = "test-user-id"
    call.data = {}
    return call


class TestCompleteTaskHandler:
    """Tests for complete_task service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_event(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated before event is fired."""
        from custom_components.tasktracker.service_handlers.tasks import (
            complete_task_handler_factory,
        )

        # Setup
        mock_api.complete_task = AsyncMock(return_value={
            "success": True,
            "data": {"completion_id": "123"}
        })
        mock_service_call.data = {
            "task_id": "task-1",
            "task_type": "RecurringTask",
            "completed_by": "testuser",
            "notes": "Done",
        }

        # Track call order
        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.tasks.invalidate_all_user_caches',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h: call_order.append('cache')
            mock_hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            # Create handler
            get_config = lambda: {}
            user_lookup = lambda h, u, c: "testuser"
            handler = complete_task_handler_factory(mock_hass, mock_api, get_config, user_lookup)

            # Execute
            result = await handler(mock_service_call)

            # Verify
            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass)
            mock_hass.bus.fire.assert_called_once()

            # Verify correct event name
            event_name = mock_hass.bus.fire.call_args[0][0]
            assert event_name == EVENT_TASK_COMPLETED

            # Verify call order: cache invalidation before event
            assert call_order == ['cache', 'event']


class TestCompleteTaskByNameHandler:
    """Tests for complete_task_by_name service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_event(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated before event is fired."""
        from custom_components.tasktracker.service_handlers.tasks import (
            complete_task_by_name_handler_factory,
        )

        # Setup
        mock_api.complete_task_by_name = AsyncMock(return_value={
            "success": True,
            "data": {"completion_id": "123"}
        })
        mock_service_call.data = {
            "name": "Test Task",
            "completed_by": "testuser",
            "notes": "Done",
        }

        # Track call order
        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.tasks.invalidate_all_user_caches',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h: call_order.append('cache')
            mock_hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            get_config = lambda: {}
            user_lookup = lambda h, u, c: "testuser"
            handler = complete_task_by_name_handler_factory(mock_hass, mock_api, get_config, user_lookup)

            result = await handler(mock_service_call)

            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass)
            assert call_order == ['cache', 'event']


class TestCreateAdHocTaskHandler:
    """Tests for create_adhoc_task service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_event(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated before event is fired."""
        from custom_components.tasktracker.service_handlers.tasks import (
            create_adhoc_task_handler_factory,
        )

        mock_api.create_adhoc_task = AsyncMock(return_value={
            "success": True,
            "data": {"task_id": "new-task-1"}
        })
        mock_service_call.data = {
            "name": "New Task",
            "assigned_users": ["testuser"],
        }

        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.tasks.invalidate_all_user_caches',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h: call_order.append('cache')
            mock_hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            get_config = lambda: {}
            user_lookup = lambda h, u, c: "testuser"
            handler = create_adhoc_task_handler_factory(mock_hass, mock_api, get_config, user_lookup)

            result = await handler(mock_service_call)

            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass)
            event_name = mock_hass.bus.fire.call_args[0][0]
            assert event_name == EVENT_TASK_CREATED
            assert call_order == ['cache', 'event']


class TestUpdateTaskHandler:
    """Tests for update_task service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_event(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated before event is fired."""
        from custom_components.tasktracker.service_handlers.tasks import (
            update_task_handler_factory,
        )

        mock_api.update_task = AsyncMock(return_value={
            "success": True,
            "data": {"task_id": "task-1"}
        })
        mock_service_call.data = {
            "task_id": "task-1",
            "task_type": "RecurringTask",
            "name": "Updated Task",
        }

        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.tasks.invalidate_all_user_caches',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h: call_order.append('cache')
            mock_hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            handler = update_task_handler_factory(mock_api)

            result = await handler(mock_service_call)

            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass)
            event_name = mock_hass.bus.fire.call_args[0][0]
            assert event_name == EVENT_TASK_UPDATED
            assert call_order == ['cache', 'event']


class TestDeleteTaskHandler:
    """Tests for delete_task service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_events(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated before events are fired."""
        from custom_components.tasktracker.service_handlers.tasks import (
            delete_task_handler_factory,
        )

        mock_api.delete_task = AsyncMock(return_value={
            "success": True,
            "data": {"deleted": True}
        })
        mock_service_call.data = {
            "task_id": "task-1",
            "task_type": "RecurringTask",
            "assigned_to": "testuser",
        }

        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.tasks.invalidate_all_user_caches',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h: call_order.append('cache')
            mock_hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            get_config = lambda: {}
            user_lookup = lambda h, u, c: "testuser"
            handler = delete_task_handler_factory(mock_hass, mock_api, get_config, user_lookup)

            result = await handler(mock_service_call)

            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass)

            # Should fire both task_updated and task_deleted events
            assert mock_hass.bus.fire.call_count == 2
            event_names = [call_args[0][0] for call_args in mock_hass.bus.fire.call_args_list]
            assert EVENT_TASK_UPDATED in event_names
            assert EVENT_TASK_DELETED in event_names

            # Cache should be called before both events
            assert call_order == ['cache', 'event', 'event']


class TestDeleteCompletionHandler:
    """Tests for delete_completion service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_event(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated before event is fired."""
        from custom_components.tasktracker.service_handlers.completions import (
            delete_completion_handler_factory,
        )

        mock_api.delete_completion = AsyncMock(return_value={
            "success": True,
            "data": {"deleted": True}
        })
        mock_service_call.data = {
            "completion_id": "completion-1",
        }

        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.completions.invalidate_all_user_caches',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h: call_order.append('cache')
            mock_service_call.hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            handler = delete_completion_handler_factory(mock_hass, mock_api)

            result = await handler(mock_service_call)

            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass)
            event_name = mock_service_call.hass.bus.fire.call_args[0][0]
            assert event_name == EVENT_COMPLETION_DELETED
            assert call_order == ['cache', 'event']


class TestUpdateCompletionHandler:
    """Tests for update_completion service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_event(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated before event is fired."""
        from custom_components.tasktracker.service_handlers.completions import (
            update_completion_handler_factory,
        )

        mock_api.update_completion = AsyncMock(return_value={
            "success": True,
            "data": {"completion_id": "completion-1"}
        })
        mock_service_call.data = {
            "completion_id": "completion-1",
            "notes": "Updated notes",
        }

        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.completions.invalidate_all_user_caches',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h: call_order.append('cache')
            mock_service_call.hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            handler = update_completion_handler_factory(mock_hass, mock_api)

            result = await handler(mock_service_call)

            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass)
            event_name = mock_service_call.hass.bus.fire.call_args[0][0]
            assert event_name == EVENT_COMPLETION_UPDATED
            assert call_order == ['cache', 'event']


class TestCreateLeftoverHandler:
    """Tests for create_leftover service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_event(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated before event is fired."""
        from custom_components.tasktracker.service_handlers.leftovers import (
            create_leftover_handler_factory,
        )

        mock_api.create_leftover = AsyncMock(return_value={
            "success": True,
            "data": {"leftover_id": "leftover-1"}
        })
        mock_service_call.data = {
            "name": "Pizza",
            "assigned_users": ["testuser"],
        }

        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.leftovers.invalidate_user_cache',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h, u: call_order.append('cache')
            mock_hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            get_config = lambda: {}
            user_lookup = lambda h, u, c: "testuser"
            handler = create_leftover_handler_factory(mock_hass, mock_api, get_config, user_lookup)

            result = await handler(mock_service_call)

            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass, "testuser")
            event_name = mock_hass.bus.fire.call_args[0][0]
            assert event_name == EVENT_LEFTOVER_CREATED
            assert call_order == ['cache', 'event']


class TestSetDailyStateHandler:
    """Tests for set_daily_state service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_correct_event(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated and correct event name is used."""
        from custom_components.tasktracker.service_handlers.daily import (
            set_daily_state_handler_factory,
        )

        mock_api.set_daily_state = AsyncMock(return_value={
            "success": True,
            "data": {"state": "updated"}
        })
        mock_service_call.data = {
            "username": "testuser",
            "energy": 5,
            "motivation": 7,
        }

        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.daily.invalidate_user_cache',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h, u: call_order.append('cache')
            mock_hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            get_config = lambda: {}
            user_lookup = lambda h, u, c: "testuser"
            handler = set_daily_state_handler_factory(mock_hass, mock_api, get_config, user_lookup)

            result = await handler(mock_service_call)

            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass, "testuser")
            event_name = mock_hass.bus.fire.call_args[0][0]

            # This test will FAIL until we fix the event name in set_daily_state
            assert event_name == EVENT_DAILY_STATE_SET
            assert call_order == ['cache', 'event']


class TestCreateTaskFromDescriptionHandler:
    """Tests for create_task_from_description service handler."""

    @pytest.mark.asyncio
    async def test_invalidates_cache_and_fires_event(self, mock_hass, mock_api, mock_service_call):
        """Test that cache is invalidated before event is fired."""
        from custom_components.tasktracker.service_handlers.tasks import (
            create_task_from_description_handler_factory,
        )

        mock_api.create_task_from_description = AsyncMock(return_value={
            "success": True,
            "data": {"task": {"name": "New Task", "id": "task-1"}}
        })
        mock_service_call.data = {
            "task_type": "RecurringTask",
            "task_description": "Clean the kitchen",
            "assigned_users": ["testuser"],
        }

        call_order = []

        with patch(
            'custom_components.tasktracker.service_handlers.tasks.invalidate_all_user_caches',
            new_callable=AsyncMock
        ) as mock_invalidate:
            mock_invalidate.side_effect = lambda h: call_order.append('cache')
            mock_hass.bus.fire.side_effect = lambda *args: call_order.append('event')

            get_config = lambda: {}
            user_lookup = lambda h, u, c: "testuser"
            handler = create_task_from_description_handler_factory(mock_hass, mock_api, get_config, user_lookup)

            result = await handler(mock_service_call)

            assert result["success"] is True
            mock_invalidate.assert_called_once_with(mock_hass)
            event_name = mock_hass.bus.fire.call_args[0][0]
            assert event_name == EVENT_TASK_CREATED
            assert call_order == ['cache', 'event']
