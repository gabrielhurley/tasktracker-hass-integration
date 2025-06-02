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
from pathlib import Path
from typing import TYPE_CHECKING, Any

from homeassistant.helpers.aiohttp_client import async_get_clientsession
from homeassistant.components import conversation
from homeassistant.helpers.intent import (
    IntentHandler,
    IntentResponse,
    async_register,
)

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


def _setup_voice_sentences(hass: HomeAssistant) -> bool:
    """Set up voice sentences by copying them to the correct location."""
    try:
        # Get the HA config directory
        config_dir = Path(hass.config.config_dir)

        # Source sentences file bundled with our integration
        source_file = Path(__file__).parent / "sentences.yaml"

        # Target location where HA expects sentences
        target_dir = config_dir / "custom_sentences" / "en"
        target_file = target_dir / "tasktracker.yaml"

        # Check if source file exists
        if not source_file.exists():
            _LOGGER.debug("TaskTracker sentences file not found at %s", source_file)
            return False

        # Create target directory if it doesn't exist
        target_dir.mkdir(parents=True, exist_ok=True)

        # Check if target already exists and is different
        if target_file.exists():
            try:
                # Compare file contents to avoid unnecessary overwrites
                if source_file.read_text(encoding="utf-8") == target_file.read_text(
                    encoding="utf-8"
                ):
                    _LOGGER.debug("TaskTracker sentences file is already up to date")
                    return True
                else:  # noqa: RET505
                    _LOGGER.info("Updating TaskTracker sentences file")
            except Exception as e:  # noqa: BLE001
                _LOGGER.warning("Could not compare sentence files: %s", e)

        # Copy the file
        shutil.copy2(source_file, target_file)
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


class TaskTrackerIntentHandler(IntentHandler):
    """Base intent handler for TaskTracker intents."""

    def __init__(self, hass: HomeAssistant, intent_type: str) -> None:
        """Initialize the intent handler."""
        self.hass = hass
        self.intent_type = intent_type

    async def async_handle(self, intent_obj: Any) -> IntentResponse:
        """Handle the intent."""
        _LOGGER.debug(
            "Handling intent: %s with slots: %s", self.intent_type, intent_obj.slots
        )

        # Get the API from hass.data
        api = None
        for entry_data in self.hass.data.get(DOMAIN, {}).values():
            if "api" in entry_data:
                api = entry_data["api"]
                break

        if not api:
            _LOGGER.error("TaskTracker API not found in hass.data")
            response = IntentResponse(language=intent_obj.language)
            response.async_set_speech("TaskTracker API is not available.")
            return response

        # Route to the appropriate handler based on intent type
        if self.intent_type == "AddLeftover":
            return await self._handle_add_leftover(intent_obj, api)
        elif self.intent_type == "CompleteTask":
            return await self._handle_complete_task(intent_obj, api)
        elif self.intent_type == "AddAdHocTask":
            return await self._handle_add_adhoc_task(intent_obj, api)
        elif self.intent_type == "QueryTaskStatus":
            return await self._handle_query_task_status(intent_obj, api)
        elif self.intent_type == "GetTaskDetails":
            return await self._handle_get_task_details(intent_obj, api)
        elif self.intent_type == "GetRecommendedTasksForPerson":
            return await self._handle_get_recommended_tasks_for_person(intent_obj, api)
        elif self.intent_type == "GetRecommendedTasksForPersonAndTime":
            return await self._handle_get_recommended_tasks_for_person_and_time(
                intent_obj, api
            )
        else:
            _LOGGER.error("Unknown intent type: %s", self.intent_type)
            response = IntentResponse(language=intent_obj.language)
            response.async_set_speech(f"Unknown intent: {self.intent_type}")
            return response

    async def _handle_add_leftover(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle AddLeftover intent."""
        response = IntentResponse(language=intent_obj.language)

        try:
            leftover_name = intent_obj.slots.get("leftover_name", {}).get("value")
            if not leftover_name:
                response.async_set_speech("Leftover name is required.")
                return response

            leftover_assigned_to = intent_obj.slots.get("leftover_assigned_to", {}).get(
                "value", ""
            )
            shelf_life_days = intent_obj.slots.get("leftover_shelf_life", {}).get(
                "value", ""
            )
            days_ago = intent_obj.slots.get("days_ago", {}).get("value", "")

            result = await api.create_leftover(
                name=leftover_name,
                assigned_to=leftover_assigned_to,
                shelf_life_days=int(shelf_life_days) if shelf_life_days else None,
                days_ago=int(days_ago) if days_ago else None,
            )

            if not result.get("success"):
                error_msg = result.get("message", "Unknown error")
                response.async_set_speech(
                    f"There was an error adding the leftover: {error_msg}"
                )
            else:
                message = result.get(
                    "spoken_response",
                    f"The {leftover_name} leftover has been added successfully.",
                )
                response.async_set_speech(message)

        except Exception as e:
            _LOGGER.exception("Error handling AddLeftover intent")
            response.async_set_speech(f"Error adding leftover: {e}")

        return response

    async def _handle_complete_task(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle CompleteTask intent."""
        response = IntentResponse(language=intent_obj.language)

        try:
            task_name = intent_obj.slots.get("task_name", {}).get("value")
            task_completed_by = intent_obj.slots.get("task_completed_by", {}).get(
                "value"
            )

            if not task_name:
                response.async_set_speech("Task name is required.")
                return response

            result = await api.complete_task_by_name(
                name=task_name,
                assigned_to=task_completed_by,
            )

            if not result.get("success"):
                error_msg = result.get("message", "Unknown error")
                response.async_set_speech(
                    f"There was an error completing the task: {error_msg}"
                )
            else:
                message = result.get(
                    "spoken_response", f"Task {task_name} completed successfully."
                )
                response.async_set_speech(message)

        except Exception as e:
            _LOGGER.exception("Error handling CompleteTask intent")
            response.async_set_speech(f"Error completing task: {e}")

        return response

    async def _handle_add_adhoc_task(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle AddAdHocTask intent."""
        response = IntentResponse(language=intent_obj.language)

        try:
            task_name = intent_obj.slots.get("task_name", {}).get("value")
            if not task_name:
                response.async_set_speech("Task name is required.")
                return response

            task_assigned_to = intent_obj.slots.get("task_assigned_to", {}).get(
                "value", ""
            )
            task_duration = intent_obj.slots.get("task_duration", {}).get("value", "")
            task_priority = intent_obj.slots.get("task_priority", {}).get("value", "")

            result = await api.create_adhoc_task(
                name=task_name,
                assigned_to=task_assigned_to,
                duration_minutes=int(task_duration) if task_duration else None,
                priority=int(task_priority) if task_priority else None,
            )

            if not result.get("success"):
                error_msg = result.get("message", "Unknown error")
                response.async_set_speech(
                    f"There was an error creating the task: {error_msg}"
                )
            else:
                message = result.get(
                    "spoken_response", f"Task {task_name} created successfully."
                )
                response.async_set_speech(message)

        except Exception as e:
            _LOGGER.exception("Error handling AddAdHocTask intent")
            response.async_set_speech(f"Error creating task: {e}")

        return response

    async def _handle_query_task_status(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle QueryTaskStatus intent."""
        response = IntentResponse(language=intent_obj.language)

        try:
            task_name = intent_obj.slots.get("task_name", {}).get("value")
            question_type = intent_obj.slots.get("question_type", {}).get(
                "value", "general"
            )

            if not task_name:
                response.async_set_speech("Task name is required.")
                return response

            result = await api.query_task(
                name=task_name,
                question_type=question_type,
            )

            if not result.get("success"):
                error_msg = result.get("message", "Unknown error")
                response.async_set_speech(
                    f"There was an error querying the task: {error_msg}"
                )
            else:
                message = result.get("spoken_response", "Task query completed.")
                response.async_set_speech(message)

        except Exception as e:
            _LOGGER.exception("Error handling QueryTaskStatus intent")
            response.async_set_speech(f"Error querying task: {e}")

        return response

    async def _handle_get_task_details(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle GetTaskDetails intent."""
        return await self._handle_query_task_status(intent_obj, api)

    async def _handle_get_recommended_tasks_for_person(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle GetRecommendedTasksForPerson intent."""
        response = IntentResponse(language=intent_obj.language)

        try:
            person = intent_obj.slots.get("person", {}).get("value")
            if not person:
                response.async_set_speech("Person name is required.")
                return response

            result = await api.get_recommended_tasks(
                assigned_to=person, available_minutes=60
            )

            if not result.get("success"):
                error_msg = result.get("message", "Unknown error")
                response.async_set_speech(
                    f"There was an error getting recommended tasks: {error_msg}"
                )
            else:
                data = result.get("data", {})
                tasks = data.get("items", [])
                if tasks:
                    task_names = [
                        task.get("name", "Unknown") for task in tasks[:3]
                    ]  # Limit to 3 tasks
                    response.async_set_speech(
                        f"{person} can work on: {', '.join(task_names)}"
                    )
                else:
                    response.async_set_speech(
                        f"No recommended tasks found for {person}."
                    )

        except Exception as e:
            _LOGGER.exception("Error handling GetRecommendedTasksForPerson intent")
            response.async_set_speech(f"Error getting recommended tasks: {e}")

        return response

    async def _handle_get_recommended_tasks_for_person_and_time(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle GetRecommendedTasksForPersonAndTime intent."""
        response = IntentResponse(language=intent_obj.language)

        try:
            person = intent_obj.slots.get("person", {}).get("value")
            available_time = intent_obj.slots.get("available_time", {}).get("value")

            if not person:
                response.async_set_speech("Person name is required.")
                return response

            if not available_time:
                response.async_set_speech("Available time is required.")
                return response

            result = await api.get_recommended_tasks(
                assigned_to=person, available_minutes=int(available_time)
            )

            if not result.get("success"):
                error_msg = result.get("message", "Unknown error")
                response.async_set_speech(
                    f"There was an error getting recommended tasks: {error_msg}"
                )
            else:
                data = result.get("data", {})
                tasks = data.get("items", [])
                if tasks:
                    task_names = [
                        task.get("name", "Unknown") for task in tasks[:3]
                    ]  # Limit to 3 tasks
                    response.async_set_speech(
                        f"{person} can work on: {', '.join(task_names)}"
                    )
                else:
                    response.async_set_speech(
                        f"No recommended tasks found for {person} with {available_time} minutes available."
                    )

        except Exception as e:
            _LOGGER.exception(
                "Error handling GetRecommendedTasksForPersonAndTime intent"
            )
            response.async_set_speech(f"Error getting recommended tasks: {e}")

        return response


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
        intent_types = [
            "AddLeftover",
            "CompleteTask",
            "AddAdHocTask",
            "QueryTaskStatus",
            "GetTaskDetails",
            "GetRecommendedTasksForPerson",
            "GetRecommendedTasksForPersonAndTime",
        ]

        for intent_type in intent_types:
            handler = TaskTrackerIntentHandler(hass, intent_type)
            async_register(hass, handler)
            _LOGGER.debug("Registered intent handler for %s", intent_type)

        # Register frontend resources
        _LOGGER.debug("Registering TaskTracker frontend resources")
        module_register = JSModuleRegistration(hass)
        await module_register.async_register()

        # Set up voice sentences (optional, graceful failure)
        try:
            _LOGGER.debug("Setting up TaskTracker voice sentences")
            voice_setup_success = _setup_voice_sentences(hass)
            if not voice_setup_success:
                _LOGGER.debug(
                    "Automatic voice setup failed. See VOICE_SETUP.md for manual instructions."  # noqa: E501
                )
        except Exception as e:
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
