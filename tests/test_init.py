"""Tests for TaskTracker integration setup."""

from unittest.mock import AsyncMock, MagicMock, patch

import pytest
from homeassistant.config_entries import ConfigEntry
from homeassistant.core import HomeAssistant

from custom_components.tasktracker import (
    async_setup,
    async_setup_entry,
    async_unload_entry,
)
from custom_components.tasktracker.const import DOMAIN


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
            mock_api.get_all_tasks.return_value = {"status": "success"}
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
            mock_api.get_all_tasks.return_value = {"status": "success"}
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
