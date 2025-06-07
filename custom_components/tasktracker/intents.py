"""
TaskTracker Home Assistant Intent Handlers.

This module provides voice command integration through Home Assistant's
conversation system. Each intent type has its own dedicated handler class
for better organization.
"""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from homeassistant.helpers.intent import (
    IntentHandler,
    IntentResponse,
    async_register,
)

from .const import DOMAIN
from .utils import get_user_context

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

    from .api import TaskTrackerAPI

_LOGGER = logging.getLogger(__name__)


class BaseTaskTrackerIntentHandler(IntentHandler):
    """Base class for TaskTracker intent handlers."""

    intent_type: str = ""

    def __init__(self, hass: HomeAssistant) -> None:
        """Initialize the intent handler."""
        self.hass = hass

    def _get_api(self) -> TaskTrackerAPI | None:
        """Get the TaskTracker API from hass.data."""
        for entry_data in self.hass.data.get(DOMAIN, {}).values():
            if "api" in entry_data:
                return entry_data["api"]
        return None

    async def async_handle(self, intent_obj: Any) -> IntentResponse:
        """Handle the intent."""
        _LOGGER.debug(
            "Handling intent: %s with slots: %s", self.intent_type, intent_obj.slots
        )

        api = self._get_api()
        if not api:
            _LOGGER.error("TaskTracker API not found in hass.data")
            response = IntentResponse(language=intent_obj.language)
            response.async_set_speech("TaskTracker API is not available.")
            return response

        try:
            return await self._handle_intent(intent_obj, api)
        except Exception as e:
            _LOGGER.exception("Error handling %s intent", self.intent_type)
            response = IntentResponse(language=intent_obj.language)
            response.async_set_speech(f"Error handling {self.intent_type}: {e}")
            return response

    async def _handle_intent(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle the specific intent. Override in subclasses."""
        raise NotImplementedError


class AddLeftoverIntentHandler(BaseTaskTrackerIntentHandler):
    """Handler for AddLeftover intent."""

    intent_type = "AddLeftover"

    async def _handle_intent(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle AddLeftover intent."""
        response = IntentResponse(language=intent_obj.language)

        leftover_name = intent_obj.slots.get("leftover_name", {}).get("value")
        if not leftover_name:
            response.async_set_speech("Leftover name is required.")
            return response

        leftover_assigned_to = intent_obj.slots.get("leftover_assigned_to", {}).get(
            "value", ""
        )
        if not leftover_assigned_to:
            leftover_assigned_to = get_user_context(
                self.hass, intent_obj.context.user_id
            )
            if not leftover_assigned_to:
                response.async_set_speech(
                    "Leftover assignee is required. Try rephrasing your request."
                )
                return response

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
            # Fire custom event for frontend cards
            self.hass.bus.fire(
                "tasktracker_leftover_created",
                {
                    "leftover_name": leftover_name,
                    "assigned_to": leftover_assigned_to,
                    "shelf_life_days": int(shelf_life_days)
                    if shelf_life_days
                    else None,
                    "days_ago": int(days_ago) if days_ago else None,
                    "creation_data": result.get("data"),
                },
            )

            message = result.get(
                "spoken_response",
                f"The {leftover_name} leftover has been added successfully.",
            )
            response.async_set_speech(message)

        return response


class CompleteTaskIntentHandler(BaseTaskTrackerIntentHandler):
    """Handler for CompleteTask intent."""

    intent_type = "CompleteTask"

    async def _handle_intent(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle CompleteTask intent."""
        response = IntentResponse(language=intent_obj.language)

        task_name = intent_obj.slots.get("task_name", {}).get("value")
        task_completed_by = intent_obj.slots.get("task_completed_by", {}).get("value")
        if not task_completed_by:
            task_completed_by = get_user_context(self.hass, intent_obj.context.user_id)
            if not task_completed_by:
                task_completed_by = "Anonymous"

        if not task_name:
            response.async_set_speech("Task name is required.")
            return response

        result = await api.complete_task_by_name(
            name=task_name,
            completed_by=task_completed_by,
        )

        if not result.get("success"):
            error_msg = result.get("message", "Unknown error")
            response.async_set_speech(
                f"There was an error completing the task: {error_msg}"
            )
        else:
            # Fire custom event for frontend cards
            self.hass.bus.fire(
                "tasktracker_task_completed",
                {
                    "task_name": task_name,
                    "username": task_completed_by,
                    "notes": None,
                    "completion_data": result.get("data"),
                },
            )

            message = result.get(
                "spoken_response", f"Task {task_name} completed successfully."
            )
            response.async_set_speech(message)

        return response


class AddAdHocTaskIntentHandler(BaseTaskTrackerIntentHandler):
    """Handler for AddAdHocTask intent."""

    intent_type = "AddAdHocTask"

    async def _handle_intent(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle AddAdHocTask intent."""
        response = IntentResponse(language=intent_obj.language)

        task_name = intent_obj.slots.get("task_name", {}).get("value")
        if not task_name:
            response.async_set_speech("Task name is required.")
            return response

        task_assigned_to = intent_obj.slots.get("task_assigned_to", {}).get("value", "")
        if not task_assigned_to:
            task_assigned_to = get_user_context(self.hass, intent_obj.context.user_id)
            if not task_assigned_to:
                response.async_set_speech(
                    "Task assignee is required. Try rephrasing your request."
                )
                return response

        task_duration = intent_obj.slots.get("task_duration", {}).get("value", "")
        task_priority = intent_obj.slots.get("task_priority", {}).get("value", "")

        result = await api.create_adhoc_task(
            name=task_name.capitalize(),
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
            # Fire custom event for frontend cards
            self.hass.bus.fire(
                "tasktracker_task_created",
                {
                    "task_name": task_name.capitalize(),
                    "assigned_to": task_assigned_to,
                    "duration_minutes": int(task_duration) if task_duration else None,
                    "priority": int(task_priority) if task_priority else None,
                    "creation_data": result.get("data"),
                },
            )

            message = result.get(
                "spoken_response", f"Task {task_name} created successfully."
            )
            response.async_set_speech(message)

        return response


class QueryTaskStatusIntentHandler(BaseTaskTrackerIntentHandler):
    """Handler for QueryTaskStatus intent."""

    intent_type = "QueryTaskStatus"

    async def _handle_intent(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle QueryTaskStatus intent."""
        response = IntentResponse(language=intent_obj.language)

        # More robust task_name extraction
        task_name_slot = intent_obj.slots.get("task_name", {})
        if isinstance(task_name_slot, dict):
            task_name = task_name_slot.get("value")
        else:
            task_name = task_name_slot

        # Handle nested dictionary case
        if isinstance(task_name, dict) and "value" in task_name:
            task_name = task_name["value"]

        # Ensure we have a string value for task_name
        if not isinstance(task_name, str):
            task_name = str(task_name) if task_name is not None else None

        # More robust question_type extraction
        question_type_slot = intent_obj.slots.get("question_type", {})
        if isinstance(question_type_slot, dict):
            question_type = question_type_slot.get("value", "general")
        else:
            question_type = question_type_slot

        # Handle nested dictionary case
        if isinstance(question_type, dict) and "value" in question_type:
            question_type = question_type["value"]

        # Ensure we have a string value
        if not isinstance(question_type, str):
            question_type = "general"

        if not task_name:
            response.async_set_speech("Task name is required.")
            return response

        _LOGGER.debug(
            "QueryTaskStatus: task_name=%s, question_type=%s (type: %s)",
            task_name,
            question_type,
            type(question_type),
        )

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

        return response


class GetTaskDetailsIntentHandler(QueryTaskStatusIntentHandler):
    """Handler for GetTaskDetails intent (reuses QueryTaskStatus logic)."""

    intent_type = "GetTaskDetails"


class GetRecommendedTasksForPersonIntentHandler(BaseTaskTrackerIntentHandler):
    """Handler for GetRecommendedTasksForPerson intent."""

    intent_type = "GetRecommendedTasksForPerson"

    async def _handle_intent(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle GetRecommendedTasksForPerson intent."""
        response = IntentResponse(language=intent_obj.language)

        person = intent_obj.slots.get("person", {}).get("value")
        if not person:
            person = get_user_context(self.hass, intent_obj.context.user_id)
            if not person:
                response.async_set_speech(
                    "Person name is required. Try rephrasing your request."
                )
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
                response.async_set_speech(f"No recommended tasks found for {person}.")

        return response


class GetRecommendedTasksForPersonAndTimeIntentHandler(BaseTaskTrackerIntentHandler):
    """Handler for GetRecommendedTasksForPersonAndTime intent."""

    intent_type = "GetRecommendedTasksForPersonAndTime"

    async def _handle_intent(
        self, intent_obj: Any, api: TaskTrackerAPI
    ) -> IntentResponse:
        """Handle GetRecommendedTasksForPersonAndTime intent."""
        response = IntentResponse(language=intent_obj.language)

        person = intent_obj.slots.get("person", {}).get("value")
        available_time = intent_obj.slots.get("available_time", {}).get("value")

        if not person:
            person = get_user_context(self.hass, intent_obj.context.user_id)
            if not person:
                response.async_set_speech(
                    "Person name is required. Try rephrasing your request."
                )
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
                    f"No recommended tasks found for {person} with {available_time} minutes available."  # noqa: E501
                )

        return response


# Registry of all intent handlers
INTENT_HANDLERS = [
    AddLeftoverIntentHandler,
    CompleteTaskIntentHandler,
    AddAdHocTaskIntentHandler,
    QueryTaskStatusIntentHandler,
    GetTaskDetailsIntentHandler,
    GetRecommendedTasksForPersonIntentHandler,
    GetRecommendedTasksForPersonAndTimeIntentHandler,
]


async def async_register_intents(hass: HomeAssistant) -> None:
    """Register all TaskTracker intent handlers."""
    _LOGGER.debug("Registering TaskTracker intent handlers")

    for handler_class in INTENT_HANDLERS:
        handler = handler_class(hass)
        async_register(hass, handler)
        _LOGGER.debug("Registered intent handler for %s", handler.intent_type)
