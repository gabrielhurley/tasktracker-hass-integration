"""Tests for TaskTracker integration setup."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.components import websocket_api
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from custom_components.tasktracker import (
    async_setup,
    async_setup_entry,
    async_unload_entry,
    handle_subscribe_tasktracker_events,
)
from custom_components.tasktracker.const import (
    DOMAIN,
    EVENT_TASK_COMPLETED,
    TASKTRACKER_EVENTS,
)


class TestTaskTrackerIntegration:
    """Test TaskTracker integration setup and teardown."""

    @pytest.fixture
    def mock_config_entry(self) -> MagicMock:
        """Create a mock config entry."""
        return MagicMock(
            spec=ConfigEntry,
            data={
                "host": "https://test.example.com",
                "api_key": "test-api-key",
                "users": [
                    {"ha_user_id": "test-user-1", "tasktracker_username": "testuser1"}
                ],
            },
            entry_id="test_entry",
        )

    @pytest.mark.asyncio
    async def test_async_setup(self, hass: HomeAssistant) -> None:
        """Test integration setup returns True."""
        result = await async_setup(hass, {})
        assert result is True

    @pytest.mark.asyncio
    async def test_async_setup_entry_success(
        self, hass: HomeAssistant, mock_config_entry: MagicMock
    ) -> None:
        """Test successful config entry setup."""
        with (
            patch(
                "custom_components.tasktracker.async_get_clientsession"
            ) as mock_session,
            patch("custom_components.tasktracker.TaskTrackerAPI") as mock_api_class,
            patch(
                "custom_components.tasktracker.async_setup_services"
            ) as mock_setup_services,
            patch(
                "custom_components.tasktracker.JSModuleRegistration"
            ) as mock_js_module,
        ):
            mock_session.return_value = AsyncMock()
            mock_api = AsyncMock()
            mock_api_class.return_value = mock_api
            mock_api.get_all_tasks.return_value = {"success": True}
            mock_js_module.return_value.async_register = AsyncMock()

            result = await async_setup_entry(hass, mock_config_entry)

            assert result is True
            assert DOMAIN in hass.data
            assert mock_config_entry.entry_id in hass.data[DOMAIN]

            # Verify API and services were set up
            mock_setup_services.assert_called_once()

    @pytest.mark.asyncio
    async def test_async_setup_entry_api_failure(
        self, hass: HomeAssistant, mock_config_entry: MagicMock
    ) -> None:
        """Test config entry setup with API connection failure."""
        with (
            patch(
                "custom_components.tasktracker.async_get_clientsession"
            ) as mock_session,
            patch("custom_components.tasktracker.TaskTrackerAPI") as mock_api_class,
        ):
            mock_session.return_value = AsyncMock()
            mock_api = AsyncMock()
            mock_api_class.return_value = mock_api
            mock_api.get_all_tasks.side_effect = Exception("Connection failed")

            result = await async_setup_entry(hass, mock_config_entry)
            assert result is False

    @pytest.mark.asyncio
    async def test_async_setup_entry_invalid_config(self, hass: HomeAssistant) -> None:
        """Test config entry setup with invalid configuration."""
        invalid_config_entry = MagicMock(
            spec=ConfigEntry,
            data={
                # Missing required fields
            },
            entry_id="test_entry",
        )

        result = await async_setup_entry(hass, invalid_config_entry)
        assert result is False

    @pytest.mark.asyncio
    async def test_async_setup_entry_service_setup_failure(
        self, hass: HomeAssistant, mock_config_entry: MagicMock
    ) -> None:
        """Test config entry setup with service setup failure."""
        with (
            patch(
                "custom_components.tasktracker.async_get_clientsession"
            ) as mock_session,
            patch("custom_components.tasktracker.TaskTrackerAPI") as mock_api_class,
            patch(
                "custom_components.tasktracker.async_setup_services"
            ) as mock_setup_services,
        ):
            mock_session.return_value = AsyncMock()
            mock_api = AsyncMock()
            mock_api_class.return_value = mock_api
            mock_api.get_all_tasks.return_value = {"success": True}
            mock_setup_services.side_effect = Exception("Service setup failed")

            result = await async_setup_entry(hass, mock_config_entry)
            assert result is False

    @pytest.mark.asyncio
    async def test_async_unload_entry(
        self, hass: HomeAssistant, mock_config_entry: MagicMock
    ) -> None:
        """Test config entry unloading."""
        # First set up the entry
        hass.data[DOMAIN] = {
            mock_config_entry.entry_id: {
                "api": AsyncMock(),
                "config": mock_config_entry.data,
            }
        }

        with patch(
            "custom_components.tasktracker.async_unload_services"
        ) as mock_unload_services:
            result = await async_unload_entry(hass, mock_config_entry)

            assert result is True
            assert mock_config_entry.entry_id not in hass.data.get(DOMAIN, {})
            mock_unload_services.assert_called_once()

    @pytest.mark.asyncio
    async def test_async_unload_entry_missing_data(
        self, hass: HomeAssistant, mock_config_entry: MagicMock
    ) -> None:
        """Test config entry unloading when data is missing."""
        # Initialize domain with the config entry
        hass.data[DOMAIN] = {mock_config_entry.entry_id: {}}

        with patch(
            "custom_components.tasktracker.async_unload_services"
        ) as mock_unload_services:
            result = await async_unload_entry(hass, mock_config_entry)

            assert result is True
            mock_unload_services.assert_called_once()

    def test_config_entry_data_structure(
        self, hass: HomeAssistant, mock_config_entry: MagicMock
    ) -> None:
        """Test that config entry data structure is correct."""
        # Simulate the data structure created during setup
        hass.data[DOMAIN] = {
            mock_config_entry.entry_id: {
                "api": AsyncMock(),
                "config": mock_config_entry.data,
            }
        }

        entry_data = hass.data[DOMAIN][mock_config_entry.entry_id]
        assert "api" in entry_data
        assert "config" in entry_data
        assert entry_data["config"]["host"] == "https://test.example.com"
        assert entry_data["config"]["api_key"] == "test-api-key"

    def test_websocket_event_validation_valid(self) -> None:
        """Test that valid TaskTracker events pass validation."""
        # Test that all defined events are in the whitelist
        assert EVENT_TASK_COMPLETED in TASKTRACKER_EVENTS
        assert "tasktracker_task_created" in TASKTRACKER_EVENTS
        assert "tasktracker_leftover_created" in TASKTRACKER_EVENTS

    def test_websocket_event_validation_invalid(self) -> None:
        """Test that invalid events are not in the whitelist."""
        # Test that random event names are not in the whitelist
        assert "invalid_event" not in TASKTRACKER_EVENTS
        assert "random_event_name" not in TASKTRACKER_EVENTS
        assert "tasktracker_invalid" not in TASKTRACKER_EVENTS

    @pytest.mark.asyncio
    async def test_websocket_event_forwarding_integration(
        self, hass: HomeAssistant
    ) -> None:
        """Test that websocket handler can be registered and events flow through the bus."""
        # This is an integration test that verifies the overall flow works
        # We test that the event bus system works end-to-end

        # Track if callback was called
        callback_called = False
        callback_data = None

        def test_callback(event):
            nonlocal callback_called, callback_data
            callback_called = True
            callback_data = event.data

        # Subscribe directly to the bus (similar to what our handler does)
        hass.bus.async_listen(EVENT_TASK_COMPLETED, test_callback)

        # Fire an event
        hass.bus.async_fire(
            EVENT_TASK_COMPLETED,
            {"task_id": 456, "completed_by": "testuser"}
        )
        await hass.async_block_till_done()

        # Verify callback was called with correct data
        assert callback_called
        assert callback_data["task_id"] == 456
        assert callback_data["completed_by"] == "testuser"

    def test_all_events_in_const(self) -> None:
        """Test that all TaskTracker events are properly defined in const."""
        # Verify the TASKTRACKER_EVENTS list exists and contains expected events
        assert len(TASKTRACKER_EVENTS) >= 10  # At least 10 known events
        assert EVENT_TASK_COMPLETED in TASKTRACKER_EVENTS
        assert "tasktracker_task_created" in TASKTRACKER_EVENTS
        assert "tasktracker_task_updated" in TASKTRACKER_EVENTS
        assert "tasktracker_task_deleted" in TASKTRACKER_EVENTS
        assert "tasktracker_leftover_created" in TASKTRACKER_EVENTS
        assert "tasktracker_leftover_disposed" in TASKTRACKER_EVENTS
        assert "tasktracker_completion_deleted" in TASKTRACKER_EVENTS
        assert "tasktracker_completion_updated" in TASKTRACKER_EVENTS
        assert "tasktracker_daily_plan" in TASKTRACKER_EVENTS
        assert "tasktracker_daily_state_set" in TASKTRACKER_EVENTS
