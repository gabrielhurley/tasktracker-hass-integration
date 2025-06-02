"""TaskTracker services for Home Assistant integration."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.helpers import config_validation as cv

from .api import TaskTrackerAPI, TaskTrackerAPIError
from .const import (
    DOMAIN,
    SERVICE_COMPLETE_TASK,
    SERVICE_COMPLETE_TASK_BY_NAME,
    SERVICE_CREATE_ADHOC_TASK,
    SERVICE_CREATE_LEFTOVER,
    SERVICE_GET_ALL_TASKS,
    SERVICE_GET_AVAILABLE_TASKS,
    SERVICE_GET_AVAILABLE_USERS,
    SERVICE_GET_RECENT_COMPLETIONS,
    SERVICE_GET_RECOMMENDED_TASKS,
    SERVICE_LIST_LEFTOVERS,
    SERVICE_QUERY_TASK,
)
from .utils import (
    get_available_tasktracker_usernames,
    get_tasktracker_username_for_ha_user,
)

_LOGGER = logging.getLogger(__name__)

# Service schemas
COMPLETE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("task_id"): cv.positive_int,
        vol.Optional("assigned_to"): cv.string,
        vol.Optional("notes"): cv.string,
    }
)

COMPLETE_TASK_BY_NAME_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("assigned_to"): cv.string,
        vol.Optional("notes"): cv.string,
    }
)

CREATE_LEFTOVER_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("assigned_to"): cv.string,
        vol.Optional("shelf_life_days"): cv.positive_int,
        vol.Optional("days_ago"): cv.positive_int,
    }
)

CREATE_ADHOC_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("assigned_to"): cv.string,
        vol.Optional("duration_minutes"): cv.positive_int,
        vol.Optional("priority"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
    }
)

QUERY_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("question_type"): vol.In(
            ["safe_to_eat", "how_old", "notes", "general"]
        ),
    }
)

GET_RECOMMENDED_TASKS_SCHEMA = vol.Schema(
    {
        vol.Optional("assigned_to"): cv.string,
        vol.Required("available_minutes"): cv.positive_int,
    }
)

GET_AVAILABLE_TASKS_SCHEMA = vol.Schema(
    {
        vol.Optional("assigned_to"): cv.string,
        vol.Optional("available_minutes"): cv.positive_int,
        vol.Optional("upcoming_days"): cv.positive_int,
    }
)

GET_RECENT_COMPLETIONS_SCHEMA = vol.Schema(
    {
        vol.Optional("assigned_to"): cv.string,
        vol.Optional("days"): cv.positive_int,
        vol.Optional("limit"): cv.positive_int,
    }
)

GET_ALL_TASKS_SCHEMA = vol.Schema(
    {
        vol.Optional("thin"): cv.boolean,
        vol.Optional("assigned_to"): cv.string,
    }
)


async def async_setup_services(  # noqa: C901, PLR0915
    hass: HomeAssistant, api: TaskTrackerAPI, config: dict[str, Any]
) -> None:
    """Set up TaskTracker services."""
    _LOGGER.debug("Starting service registration for TaskTracker")

    def get_current_config() -> dict[str, Any]:
        """Get the current config from hass.data instead of using static config."""
        # Find the first (and should be only) TaskTracker config entry
        for entry_data in hass.data.get(DOMAIN, {}).values():
            if "config" in entry_data:
                return entry_data["config"]
        # Fallback to the original config if no entry found
        return config

    try:

        async def complete_task_service(call: ServiceCall) -> dict[str, Any]:
            """Complete a task by ID."""
            try:
                assigned_to = call.data.get("assigned_to")
                if not assigned_to:
                    # Handle case where user_id might be None
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    assigned_to = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    if not assigned_to:
                        msg = "No assigned_to provided and could not determine from user context"  # noqa: E501
                        raise TaskTrackerAPIError(msg)  # noqa: TRY301

                result = await api.complete_task(
                    task_id=call.data["task_id"],
                    assigned_to=assigned_to,
                    notes=call.data.get("notes"),
                )

                _LOGGER.info("Task completed successfully: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to complete task")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in complete_task_service")
                raise

        async def complete_task_by_name_service(call: ServiceCall) -> dict[str, Any]:
            """Complete a task by name."""
            try:
                assigned_to = call.data.get("assigned_to")
                if not assigned_to:
                    # Handle case where user_id might be None
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    assigned_to = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    if not assigned_to:
                        msg = "No assigned_to provided and could not determine from user context"  # noqa: E501
                        raise TaskTrackerAPIError(msg)  # noqa: TRY301

                _LOGGER.debug("Completing task by name: %s", call.data["name"])
                result = await api.complete_task_by_name(
                    name=call.data["name"],
                    assigned_to=assigned_to,
                    notes=call.data.get("notes"),
                )

                _LOGGER.info("Task completed by name successfully: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to complete task by name")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in complete_task_by_name_service")
                raise

        async def create_leftover_service(call: ServiceCall) -> dict[str, Any]:
            """Create a leftover."""
            try:
                result = await api.create_leftover(
                    name=call.data["name"],
                    assigned_to=call.data.get("assigned_to"),
                    shelf_life_days=call.data.get("shelf_life_days"),
                    days_ago=call.data.get("days_ago"),
                )

                _LOGGER.info("Leftover created successfully: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to create leftover")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in create_leftover_service")
                raise

        async def create_adhoc_task_service(call: ServiceCall) -> dict[str, Any]:
            """Create an ad-hoc task."""
            try:
                assigned_to = call.data.get("assigned_to")
                if not assigned_to:
                    # Handle case where user_id might be None
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    assigned_to = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    if not assigned_to:
                        msg = "No assigned_to provided and could not determine from user context"  # noqa: E501
                        raise TaskTrackerAPIError(msg)  # noqa: TRY301

                result = await api.create_adhoc_task(
                    name=call.data["name"],
                    assigned_to=assigned_to,
                    duration_minutes=call.data.get("duration_minutes"),
                    priority=call.data.get("priority"),
                )

                _LOGGER.info("Ad-hoc task created successfully: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to create ad-hoc task")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in create_adhoc_task_service")
                raise

        async def query_task_service(call: ServiceCall) -> dict[str, Any]:
            """Query a task."""
            try:
                result = await api.query_task(
                    name=call.data["name"],
                    question_type=call.data.get("question_type"),
                )

                _LOGGER.info("Task query successful: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to query task")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in query_task_service")
                raise

        async def get_recommended_tasks_service(call: ServiceCall) -> dict[str, Any]:
            """Get recommended tasks."""
            try:
                assigned_to = call.data.get("assigned_to")
                if not assigned_to:
                    # Handle case where user_id might be None
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    assigned_to = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    if not assigned_to:
                        msg = "No assigned_to provided and could not determine from user context"  # noqa: E501
                        raise TaskTrackerAPIError(msg)  # noqa: TRY301

                available_minutes = call.data.get("available_minutes")
                if available_minutes is None:
                    msg = "available_minutes is required for get_recommended_tasks"
                    raise TaskTrackerAPIError(msg)  # noqa: TRY301

                result = await api.get_recommended_tasks(
                    assigned_to=assigned_to,
                    available_minutes=available_minutes,
                )

                _LOGGER.debug("Recommended tasks retrieved: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to get recommended tasks")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in get_recommended_tasks_service")
                raise

        async def get_available_tasks_service(call: ServiceCall) -> dict[str, Any]:
            """Get available tasks."""
            try:
                result = await api.get_available_tasks(
                    assigned_to=call.data.get("assigned_to"),
                    available_minutes=call.data.get("available_minutes"),
                    upcoming_days=call.data.get("upcoming_days"),
                )

                _LOGGER.debug("Available tasks retrieved: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to get available tasks")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in get_available_tasks_service")
                raise

        async def get_recent_completions_service(call: ServiceCall) -> dict[str, Any]:
            """Get recent completions."""
            try:
                result = await api.get_recent_completions(
                    assigned_to=call.data.get("assigned_to"),
                    days=call.data.get("days"),
                    limit=call.data.get("limit"),
                )

                _LOGGER.debug("Recent completions retrieved: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to get recent completions")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in get_recent_completions_service")
                raise

        async def list_leftovers_service(call: ServiceCall) -> dict[str, Any]:  # noqa: ARG001
            """List leftovers."""
            try:
                result = await api.list_leftovers()

                _LOGGER.debug("Leftovers retrieved: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to list leftovers")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in list_leftovers_service")
                raise

        async def get_all_tasks_service(call: ServiceCall) -> dict[str, Any]:
            """Get all tasks."""
            try:
                result = await api.get_all_tasks(
                    thin=call.data.get("thin", False),
                    assigned_to=call.data.get("assigned_to"),
                )

                _LOGGER.debug("All tasks retrieved: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to get all tasks")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in get_all_tasks_service")
                raise

        async def get_available_users_service(call: ServiceCall) -> dict[str, Any]:  # noqa: ARG001
            """Get available TaskTracker usernames."""
            try:
                current_config = get_current_config()
                usernames = get_available_tasktracker_usernames(current_config)

                _LOGGER.debug("Available TaskTracker usernames: %s", usernames)
                result = {
                    "success": True,
                    "spoken_response": f"Available users: {', '.join(usernames)}",
                    "data": {"users": usernames},
                }
                return result  # noqa: TRY300
            except Exception:
                _LOGGER.exception("Unexpected error in get_available_users_service")
                raise

        # Register services
        _LOGGER.debug("Registering individual services...")

        hass.services.async_register(
            DOMAIN,
            SERVICE_COMPLETE_TASK,
            complete_task_service,
            schema=COMPLETE_TASK_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_COMPLETE_TASK)

        hass.services.async_register(
            DOMAIN,
            SERVICE_COMPLETE_TASK_BY_NAME,
            complete_task_by_name_service,
            schema=COMPLETE_TASK_BY_NAME_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_COMPLETE_TASK_BY_NAME)

        hass.services.async_register(
            DOMAIN,
            SERVICE_CREATE_LEFTOVER,
            create_leftover_service,
            schema=CREATE_LEFTOVER_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_CREATE_LEFTOVER)

        hass.services.async_register(
            DOMAIN,
            SERVICE_CREATE_ADHOC_TASK,
            create_adhoc_task_service,
            schema=CREATE_ADHOC_TASK_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_CREATE_ADHOC_TASK)

        hass.services.async_register(
            DOMAIN, SERVICE_QUERY_TASK, query_task_service, schema=QUERY_TASK_SCHEMA
        )
        _LOGGER.debug("Registered service: %s", SERVICE_QUERY_TASK)

        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_RECOMMENDED_TASKS,
            get_recommended_tasks_service,
            schema=GET_RECOMMENDED_TASKS_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_GET_RECOMMENDED_TASKS)

        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_AVAILABLE_TASKS,
            get_available_tasks_service,
            schema=GET_AVAILABLE_TASKS_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_GET_AVAILABLE_TASKS)

        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_RECENT_COMPLETIONS,
            get_recent_completions_service,
            schema=GET_RECENT_COMPLETIONS_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_GET_RECENT_COMPLETIONS)

        hass.services.async_register(
            DOMAIN,
            SERVICE_LIST_LEFTOVERS,
            list_leftovers_service,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_LIST_LEFTOVERS)

        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_ALL_TASKS,
            get_all_tasks_service,
            schema=GET_ALL_TASKS_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_GET_ALL_TASKS)

        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_AVAILABLE_USERS,
            get_available_users_service,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_GET_AVAILABLE_USERS)

        _LOGGER.info("TaskTracker services registered successfully")

    except Exception:
        _LOGGER.exception("Failed to register TaskTracker services")
        raise


async def async_unload_services(hass: HomeAssistant) -> None:
    """Unload TaskTracker services."""
    services_to_remove = [
        SERVICE_COMPLETE_TASK,
        SERVICE_COMPLETE_TASK_BY_NAME,
        SERVICE_CREATE_LEFTOVER,
        SERVICE_CREATE_ADHOC_TASK,
        SERVICE_QUERY_TASK,
        SERVICE_GET_RECOMMENDED_TASKS,
        SERVICE_GET_AVAILABLE_TASKS,
        SERVICE_GET_RECENT_COMPLETIONS,
        SERVICE_LIST_LEFTOVERS,
        SERVICE_GET_ALL_TASKS,
        SERVICE_GET_AVAILABLE_USERS,
    ]

    for service in services_to_remove:
        hass.services.async_remove(DOMAIN, service)

    _LOGGER.info("TaskTracker services unloaded successfully")
