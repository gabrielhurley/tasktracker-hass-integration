"""Service handlers related to tasks and queries."""

from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

from homeassistant.core import HomeAssistant, ServiceCall

from ..api import TaskTrackerAPI, TaskTrackerAPIError
from ..const import (
    DOMAIN,
    EVENT_DAILY_PLAN,
)

_LOGGER = logging.getLogger(__name__)


def complete_task_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def complete_task_service(call: ServiceCall) -> dict[str, Any]:
        try:
            completed_by = call.data.get("completed_by")
            if not completed_by:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                completed_by = user_lookup_fn(hass, user_id, current_config)
                if not completed_by:
                    msg = (
                        "No completed_by provided and could not determine from user context"
                    )
                    raise TaskTrackerAPIError(msg)
            result = await api.complete_task(
                task_id=call.data["task_id"],
                completed_by=completed_by,
                notes=call.data.get("notes"),
            )
            if result.get("success"):
                hass.bus.fire(
                    "tasktracker_task_completed",
                    {
                        "task_id": call.data["task_id"],
                        "username": completed_by,
                        "notes": call.data.get("notes"),
                        "completion_data": result.get("data"),
                    },
                )
            _LOGGER.info("Task completed successfully: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to complete task")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in complete_task_service")
            raise

    return complete_task_service


def complete_task_by_name_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def complete_task_by_name_service(call: ServiceCall) -> dict[str, Any]:
        try:
            completed_by = call.data.get("completed_by")
            if not completed_by:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                completed_by = user_lookup_fn(hass, user_id, current_config)
                if not completed_by:
                    msg = (
                        "No completed_by provided and could not determine from user context"
                    )
                    raise TaskTrackerAPIError(msg)
            _LOGGER.debug("Completing task by name: %s", call.data["name"])
            result = await api.complete_task_by_name(
                name=call.data["name"],
                completed_by=completed_by,
                notes=call.data.get("notes"),
                completed_at=call.data.get("completed_at"),
            )
            if result.get("success"):
                event_type = call.data.get("event_type", "task_completed")
                if event_type == "leftover_disposed":
                    hass.bus.fire(
                        f"tasktracker_{event_type}",
                        {
                            "leftover_name": call.data["name"],
                            "username": completed_by,
                            "notes": call.data.get("notes"),
                            "disposal_data": result.get("data"),
                        },
                    )
                else:
                    hass.bus.fire(
                        f"tasktracker_{event_type}",
                        {
                            "task_name": call.data["name"],
                            "username": completed_by,
                            "notes": call.data.get("notes"),
                            "completion_data": result.get("data"),
                        },
                    )
            _LOGGER.info("Task completed by name successfully: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to complete task by name")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in complete_task_by_name_service")
            raise

    return complete_task_by_name_service


def create_adhoc_task_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def create_adhoc_task_service(call: ServiceCall) -> dict[str, Any]:
        try:
            assigned_to = call.data.get("assigned_to")
            if not assigned_to:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                assigned_to = user_lookup_fn(hass, user_id, current_config)
                if not assigned_to:
                    msg = (
                        "No assigned_to provided and could not determine from user context"
                    )
                    raise TaskTrackerAPIError(msg)
            result = await api.create_adhoc_task(
                name=call.data["name"],
                assigned_to=assigned_to,
                duration_minutes=call.data.get("duration_minutes"),
                priority=call.data.get("priority"),
            )
            if result.get("success"):
                hass.bus.fire(
                    "tasktracker_task_created",
                    {
                        "task_name": call.data["name"],
                        "assigned_to": assigned_to,
                        "duration_minutes": call.data.get("duration_minutes"),
                        "priority": call.data.get("priority"),
                        "creation_data": result.get("data"),
                    },
                )
            _LOGGER.info("Ad-hoc task created successfully: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to create ad-hoc task")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in create_adhoc_task_service")
            raise

    return create_adhoc_task_service


def query_task_handler_factory(
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def query_task_service(call: ServiceCall) -> dict[str, Any]:
        try:
            result = await api.query_task(
                name=call.data["name"],
                question_type=call.data.get("question_type"),
            )
            _LOGGER.info("Task query successful: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to query task")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in query_task_service")
            raise

    return query_task_service


def get_recommended_tasks_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def get_recommended_tasks_service(call: ServiceCall) -> dict[str, Any]:
        try:
            assigned_to = call.data.get("assigned_to")
            if not assigned_to:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                assigned_to = user_lookup_fn(hass, user_id, current_config)
                if not assigned_to:
                    msg = (
                        "No assigned_to provided and could not determine from user context"
                    )
                    raise TaskTrackerAPIError(msg)
            available_minutes = call.data.get("available_minutes")
            if available_minutes is None:
                msg = "available_minutes is required for get_recommended_tasks"
                raise TaskTrackerAPIError(msg)
            result = await api.get_recommended_tasks(
                assigned_to=assigned_to,
                available_minutes=available_minutes,
            )
            _LOGGER.debug("Recommended tasks retrieved: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to get recommended tasks")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in get_recommended_tasks_service")
            raise

    return get_recommended_tasks_service


def get_available_tasks_handler_factory(
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def get_available_tasks_service(call: ServiceCall) -> dict[str, Any]:
        try:
            result = await api.get_available_tasks(
                assigned_to=call.data.get("assigned_to"),
                available_minutes=call.data.get("available_minutes"),
                upcoming_days=call.data.get("upcoming_days"),
            )
            _LOGGER.debug("Available tasks retrieved: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to get available tasks")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in get_available_tasks_service")
            raise

    return get_available_tasks_service


def get_all_tasks_handler_factory(
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def get_all_tasks_service(call: ServiceCall) -> dict[str, Any]:
        try:
            result = await api.get_all_tasks(
                thin=call.data.get("thin", False),
                assigned_to=call.data.get("assigned_to"),
            )
            _LOGGER.debug("All tasks retrieved: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to get all tasks")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in get_all_tasks_service")
            raise

    return get_all_tasks_service


def get_recent_completions_handler_factory(
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def get_recent_completions_service(call: ServiceCall) -> dict[str, Any]:
        try:
            result = await api.get_recent_completions(
                assigned_to=call.data.get("assigned_to"),
                days=call.data.get("days"),
                limit=call.data.get("limit"),
            )
            _LOGGER.debug("Recent completions retrieved: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to get recent completions")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in get_recent_completions_service")
            raise

    return get_recent_completions_service


def update_task_handler_factory(
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def update_task_service(call: ServiceCall) -> dict[str, Any]:
        try:
            updates: dict[str, Any] = {}
            update_fields = [
                "name",
                "priority",
                "notes",
                "is_active",
                "overdue_severity",
                "duration_minutes",
                "frequency_value",
                "frequency_unit",
                "next_due",
                "energy_cost",
                "focus_cost",
                "pain_cost",
                "motivation_boost",
                "satisfaction",
                "impact",
                "suitable_after_hours",
                "allowed_days",
                "requires_fair_weather",
                "level",
                "required_occurrences",
                "tags",
            ]
            for field in update_fields:
                if field in call.data:
                    updates[field] = call.data[field]
            if "assigned_to" in call.data:
                updates["assigned_to"] = call.data["assigned_to"]
            result = await api.update_task(
                task_id=call.data["task_id"],
                task_type=call.data["task_type"],
                **updates,
            )
            if result.get("success"):
                hass = call.hass
                hass.bus.fire(
                    "tasktracker_task_updated",
                    {
                        "task_id": call.data["task_id"],
                        "updates": updates,
                        "update_data": result.get("data"),
                    },
                )
            _LOGGER.info("Task updated successfully: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to update task")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in update_task_service")
            raise

    return update_task_service


def create_task_from_description_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def create_task_from_description_service(call: ServiceCall) -> dict[str, Any]:
        try:
            assigned_to = call.data.get("assigned_to")
            if not assigned_to:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                assigned_to = user_lookup_fn(hass, user_id, current_config)
                if not assigned_to:
                    msg = (
                        "No assigned_to provided and could not determine from user context"
                    )
                    raise TaskTrackerAPIError(msg)
            result = await api.create_task_from_description(
                task_type=call.data["task_type"],
                task_description=call.data["task_description"],
                assigned_to=assigned_to,
            )
            if result.get("success"):
                data = result.get("data", {}) or {}
                task = data.get("task") or {}
                hass.bus.fire(
                    "tasktracker_task_created",
                    {
                        "task_name": task.get("name") or call.data.get("task_description"),
                        "assigned_to": assigned_to,
                        "creation_data": result.get("data"),
                    },
                )
            _LOGGER.info("Task created from description: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to create task from description")
            raise
        except Exception:
            _LOGGER.exception(
                "Unexpected error in create_task_from_description_service"
            )
            raise

    return create_task_from_description_service


def delete_task_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def delete_task_service(call: ServiceCall) -> dict[str, Any]:
        try:
            assigned_to = call.data.get("assigned_to")
            if not assigned_to:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                assigned_to = user_lookup_fn(hass, user_id, current_config)
            result = await api.delete_task(
                task_id=call.data["task_id"],
                task_type=call.data["task_type"],
                assigned_to=assigned_to,
            )
            if result.get("success"):
                hass.bus.fire(
                    "tasktracker_task_updated",
                    {
                        "task_id": call.data["task_id"],
                        "task_type": call.data["task_type"],
                        "assigned_to": assigned_to,
                        "deleted": True,
                        "update_data": result.get("data"),
                    },
                )
                hass.bus.fire(
                    "tasktracker_task_deleted",
                    {
                        "task_id": call.data["task_id"],
                        "task_type": call.data["task_type"],
                        "assigned_to": assigned_to,
                        "deletion_data": result.get("data"),
                    },
                )
            _LOGGER.info("Task deleted: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to delete task")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in delete_task_service")
            raise

    return delete_task_service
