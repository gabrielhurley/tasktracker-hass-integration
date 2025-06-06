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
import shutil
from functools import partial
from pathlib import Path
from typing import TYPE_CHECKING

import homeassistant.helpers.config_validation as cv
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import TaskTrackerAPI
from .const import DOMAIN
from .intents import async_register_intents
from .services import async_setup_services, async_unload_services
from .www import JSModuleRegistration

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigEntry
    from homeassistant.const import Platform
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)

PLATFORMS: list[Platform] = []  # We'll add platforms here if needed

# Integration can only be set up via config entry
CONFIG_SCHEMA = cv.config_entry_only_config_schema(DOMAIN)


async def _setup_voice_sentences(hass: HomeAssistant) -> bool:
    """Set up voice sentences by copying them to the correct location."""
    try:
        # Get the HA config directory
        config_dir = Path(hass.config.config_dir)

        # Source sentences file bundled with our integration
        source_file = Path(__file__).parent / "sentences.yaml"

        # Target location where HA expects sentences
        target_dir = config_dir / "custom_sentences" / "en"
        target_file = target_dir / "tasktracker.yaml"

        # Check if source file exists (non-blocking)
        source_exists = await hass.async_add_executor_job(source_file.exists)
        if not source_exists:
            _LOGGER.debug("TaskTracker sentences file not found at %s", source_file)
            return False

        # Create target directory if it doesn't exist (non-blocking)
        await hass.async_add_executor_job(
            partial(target_dir.mkdir, parents=True, exist_ok=True)
        )

        # Check if target already exists and compare contents (non-blocking)
        target_exists = await hass.async_add_executor_job(target_file.exists)
        if target_exists:
            try:
                # Compare file contents to avoid unnecessary overwrites
                source_content = await hass.async_add_executor_job(
                    partial(source_file.read_text, encoding="utf-8")
                )
                target_content = await hass.async_add_executor_job(
                    partial(target_file.read_text, encoding="utf-8")
                )

                if source_content == target_content:
                    _LOGGER.debug("TaskTracker sentences file is already up to date")
                    return True
                else:  # noqa: RET505
                    _LOGGER.info("Updating TaskTracker sentences file")
            except Exception as e:  # noqa: BLE001
                _LOGGER.warning("Could not compare sentence files: %s", e)

        # Copy the file (non-blocking)
        await hass.async_add_executor_job(
            partial(shutil.copy2, source_file, target_file)
        )
        _LOGGER.info(
            "TaskTracker voice sentences installed to %s. "
            "Please restart Home Assistant to enable voice commands.",
            target_file,
        )
        return True  # noqa: TRY300

    except PermissionError:
        _LOGGER.exception(
            "Permission denied copying TaskTracker sentences file. "
            "Please manually copy the file as described in VOICE_SETUP.md"
        )
        return False
    except Exception:
        _LOGGER.exception("Failed to setup voice sentences")
        return False


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

        # Register intent handlers
        _LOGGER.debug("Registering TaskTracker intent handlers")
        await async_register_intents(hass)

        # Register frontend resources
        _LOGGER.debug("Registering TaskTracker frontend resources")
        module_register = JSModuleRegistration(hass)
        await module_register.async_register()

        # Set up voice sentences (optional, graceful failure)
        try:
            _LOGGER.debug("Setting up TaskTracker voice sentences")
            voice_setup_success = await _setup_voice_sentences(hass)
            if not voice_setup_success:
                _LOGGER.debug(
                    "Automatic voice setup failed. See VOICE_SETUP.md for manual instructions."  # noqa: E501
                )
        except Exception as e:  # noqa: BLE001
            _LOGGER.debug("Voice setup skipped due to error: %s", e)

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
