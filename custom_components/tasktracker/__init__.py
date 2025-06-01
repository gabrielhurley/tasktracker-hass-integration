"""
TaskTracker Home Assistant Integration.

This integration provides task management capabilities through a custom TaskTracker API.
Supports multi-user task tracking, voice commands, and interactive dashboard cards.

Features:
- Real-time task recommendations with time filtering
- Cross-task-type completion (RecurringTask, AdHocTask, Leftover)
- Voice command integration through HA services
- Custom frontend cards for dashboard building
- User context detection and configuration-based mapping
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import TaskTrackerAPI
from .const import DOMAIN
from .services import async_setup_services, async_unload_services
from .www import JSModuleRegistration

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.const import Platform
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = []  # We'll add platforms here if needed


async def async_setup(hass: HomeAssistant, config: dict) -> bool:  # noqa: ARG001
    """Set up the TaskTracker integration from configuration.yaml (if needed)."""
    return True


async def async_setup_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Set up TaskTracker from a config entry."""
    _LOGGER.debug("Setting up TaskTracker integration")

    try:
        # Store API client in hass.data
        session = async_get_clientsession(hass)
        api = TaskTrackerAPI(
            session=session, host=entry.data["host"], api_key=entry.data["api_key"]
        )

        hass.data.setdefault(DOMAIN, {})
        hass.data[DOMAIN][entry.entry_id] = {
            "api": api,
            "config": entry.data,
        }

        # Set up services
        _LOGGER.debug("Setting up TaskTracker services")
        await async_setup_services(hass, api, dict(entry.data))

        # Register frontend resources
        _LOGGER.debug("Registering TaskTracker frontend resources")
        module_register = JSModuleRegistration(hass)
        await module_register.async_register()

        # Set up platforms if we add any entities later
        # await hass.config_entries.async_forward_entry_setups(entry, PLATFORMS) # noqa: ERA001 E501

        _LOGGER.info("TaskTracker integration setup completed successfully")

    except Exception:
        _LOGGER.exception("Failed to set up TaskTracker integration")
        return False

    return True


async def async_unload_entry(hass: HomeAssistant, entry: ConfigEntry) -> bool:
    """Unload a config entry."""
    _LOGGER.debug("Unloading TaskTracker integration")

    # Unload services
    await async_unload_services(hass)

    # Unload platforms if we have any
    # unload_ok = await hass.config_entries.async_unload_platforms(entry, PLATFORMS) # noqa: ERA001 E501

    # Remove from hass.data
    hass.data[DOMAIN].pop(entry.entry_id)

    return True
