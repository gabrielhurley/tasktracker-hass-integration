"""TaskTracker services for Home Assistant integration."""

from __future__ import annotations

import logging
from typing import Any

import voluptuous as vol
from homeassistant.core import HomeAssistant, ServiceCall, SupportsResponse
from homeassistant.helpers import config_validation as cv

from .api import TaskTrackerAPI, TaskTrackerAPIError
from .const import (
    CONF_HA_USER_ID,
    CONF_TASKTRACKER_USERNAME,
    CONF_USERS,
    DOMAIN,
    EVENT_DAILY_PLAN,
    EVENT_DAILY_STATE_SET,
    SERVICE_COMPLETE_TASK,
    SERVICE_COMPLETE_TASK_BY_NAME,
    SERVICE_CREATE_ADHOC_TASK,
    SERVICE_CREATE_LEFTOVER,
    SERVICE_DELETE_COMPLETION,
    SERVICE_GET_ALL_TASKS,
    SERVICE_GET_AVAILABLE_TASKS,
    SERVICE_GET_AVAILABLE_USERS,
    SERVICE_GET_DAILY_PLAN,
    SERVICE_GET_DAILY_PLAN_ENCOURAGEMENT,
    SERVICE_GET_DAILY_STATE,
    SERVICE_GET_RECENT_COMPLETIONS,
    SERVICE_GET_RECOMMENDED_TASKS,
    SERVICE_LIST_LEFTOVERS,
    SERVICE_QUERY_TASK,
    SERVICE_SET_DAILY_STATE,
    SERVICE_UPDATE_COMPLETION,
    SERVICE_UPDATE_TASK,
    SERVICE_CREATE_TASK_FROM_DESCRIPTION,
    SERVICE_DELETE_TASK,
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
        vol.Optional("completed_by"): cv.string,
        vol.Optional("notes"): cv.string,
    }
)

COMPLETE_TASK_BY_NAME_SCHEMA = vol.Schema(
    {
        vol.Required("name"): cv.string,
        vol.Optional("completed_by"): cv.string,
        vol.Optional("notes"): cv.string,
        vol.Optional("completed_at"): cv.string,
        vol.Optional("event_type"): vol.In(["task_completed", "leftover_disposed"]),
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

LIST_LEFTOVERS_SCHEMA = vol.Schema(
    {
        vol.Optional("assigned_to"): cv.string,
    }
)

GET_ALL_TASKS_SCHEMA = vol.Schema(
    {
        vol.Optional("thin"): cv.boolean,
        vol.Optional("assigned_to"): cv.string,
    }
)

UPDATE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("task_id"): cv.string,
        vol.Required("task_type"): vol.In(
            ["RecurringTask", "AdHocTask", "SelfCareTask"]
        ),
        vol.Required("assigned_to"): cv.string,
        # BaseTask fields
        vol.Optional("name"): cv.string,
        vol.Optional("priority"): vol.All(cv.positive_int, vol.Range(min=1, max=3)),
        vol.Optional("notes"): cv.string,
        vol.Optional("is_active"): cv.boolean,
        vol.Optional("overdue_severity"): vol.All(
            cv.positive_int, vol.Range(min=1, max=3)
        ),
        # DurationMixin field
        vol.Optional("duration_minutes"): cv.positive_int,
        # FrequencyMixin fields (RecurringTask, SelfCareTask)
        vol.Optional("frequency_value"): cv.positive_int,
        vol.Optional("frequency_unit"): vol.In(
            ["days", "weeks", "months", "years", "minutes", "hours"]
        ),
        vol.Optional("next_due"): cv.string,
        # TaskFitMixin fields
        vol.Optional("energy_cost"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("focus_cost"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("pain_cost"): vol.All(cv.positive_int, vol.Range(min=0, max=5)),
        vol.Optional("motivation_boost"): vol.All(int, vol.Range(min=-5, max=5)),
        vol.Optional("satisfaction"): vol.All(cv.positive_int, vol.Range(min=0, max=5)),
        vol.Optional("impact"): vol.All(cv.positive_int, vol.Range(min=0, max=5)),
        vol.Optional("suitable_after_hours"): vol.In(
            ["yes", "if_necessary", "absolutely_not"]
        ),
        # DayOfWeekConstraintMixin field
        vol.Optional("allowed_days"): vol.All(
            cv.ensure_list, [vol.All(int, vol.Range(min=0, max=6))]
        ),
        # FairWeatherConstraintMixin field
        vol.Optional("requires_fair_weather"): cv.boolean,
        # SelfCareTask specific fields
        vol.Optional("level"): vol.All(cv.positive_int, vol.Range(min=1, max=3)),
        vol.Optional("required_occurrences"): cv.positive_int,
        # Tags field
        vol.Optional("tags"): vol.All(cv.ensure_list, [cv.string]),
    }
)

DELETE_COMPLETION_SCHEMA = vol.Schema(
    {
        vol.Required("completion_id"): cv.positive_int,
    }
)

UPDATE_COMPLETION_SCHEMA = vol.Schema(
    {
        vol.Required("completion_id"): cv.positive_int,
        vol.Optional("completed_by"): cv.string,
        vol.Optional("notes"): cv.string,
        vol.Optional("completed_at"): cv.string,
    }
)

# Create task from description schema
CREATE_TASK_FROM_DESCRIPTION_SCHEMA = vol.Schema(
    {
        vol.Required("task_type"): vol.In(["RecurringTask", "AdHocTask", "SelfCareTask"]),
        vol.Required("task_description"): cv.string,
        vol.Optional("assigned_to"): cv.string,
    }
)

# Service schemas
GET_DAILY_PLAN_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
        vol.Optional("fair_weather"): cv.boolean,
        vol.Optional("select_recommended"): cv.boolean,
    }
)

GET_DAILY_PLAN_ENCOURAGEMENT_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
    }
)

GET_DAILY_STATE_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
    }
)

SET_DAILY_STATE_SCHEMA = vol.Schema(
    {
        vol.Optional("username"): cv.string,
        vol.Optional("energy"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("motivation"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("focus"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("pain"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
        vol.Optional("mood"): vol.All(int, vol.Range(min=-2, max=2)),
        vol.Optional("free_time"): vol.All(cv.positive_int, vol.Range(min=1, max=5)),
    }
)

# Delete task schema
DELETE_TASK_SCHEMA = vol.Schema(
    {
        vol.Required("task_id"): cv.positive_int,
        vol.Required("task_type"): vol.In(["RecurringTask", "AdHocTask", "SelfCareTask"]),
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
                completed_by = call.data.get("completed_by")
                if not completed_by:
                    # Handle case where user_id might be None
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    completed_by = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    if not completed_by:
                        msg = "No completed_by provided and could not determine from user context"  # noqa: E501
                        raise TaskTrackerAPIError(msg)  # noqa: TRY301

                result = await api.complete_task(
                    task_id=call.data["task_id"],
                    completed_by=completed_by,
                    notes=call.data.get("notes"),
                )

                # Fire custom event if completion was successful
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
                completed_by = call.data.get("completed_by")
                if not completed_by:
                    # Handle case where user_id might be None
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    completed_by = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    if not completed_by:
                        msg = "No completed_by provided and could not determine from user context"  # noqa: E501
                        raise TaskTrackerAPIError(msg)  # noqa: TRY301

                _LOGGER.debug("Completing task by name: %s", call.data["name"])
                result = await api.complete_task_by_name(
                    name=call.data["name"],
                    completed_by=completed_by,
                    notes=call.data.get("notes"),
                    completed_at=call.data.get("completed_at"),
                )

                # Fire custom event if completion was successful
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

                # Fire custom event if creation was successful
                if result.get("success"):
                    hass.bus.fire(
                        "tasktracker_leftover_created",
                        {
                            "leftover_name": call.data["name"],
                            "assigned_to": call.data.get("assigned_to"),
                            "shelf_life_days": call.data.get("shelf_life_days"),
                            "days_ago": call.data.get("days_ago"),
                            "creation_data": result.get("data"),
                        },
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

                # Fire custom event if creation was successful
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

        async def list_leftovers_service(call: ServiceCall) -> dict[str, Any]:
            """List leftovers."""
            try:
                result = await api.list_leftovers(
                    assigned_to=call.data.get("assigned_to"),
                )

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
            """Get available TaskTracker usernames with mapping information."""
            try:
                current_config = get_current_config()
                usernames = get_available_tasktracker_usernames(current_config)

                # Get user mappings for display names
                user_mappings = current_config.get(CONF_USERS, [])

                # Create enhanced user data with display names
                enhanced_users = []

                # Get HA users for display names
                ha_users = await hass.auth.async_get_users()
                ha_user_map = {
                    user.id: user.name
                    for user in ha_users
                    if user.is_active and user.name
                }

                for username in usernames:
                    # Find the corresponding HA user info
                    display_name = username  # Default fallback
                    ha_user_id = None

                    for mapping in user_mappings:
                        if mapping.get(CONF_TASKTRACKER_USERNAME) == username:
                            ha_user_id = mapping.get(CONF_HA_USER_ID)
                            if ha_user_id and ha_user_id in ha_user_map:
                                display_name = ha_user_map[ha_user_id]
                            break

                    enhanced_users.append(
                        {
                            "username": username,
                            "display_name": display_name,
                            "ha_user_id": ha_user_id,
                        }
                    )

                _LOGGER.debug("Available TaskTracker usernames: %s", usernames)
                _LOGGER.debug("Enhanced user data: %s", enhanced_users)

                result = {
                    "success": True,
                    "spoken_response": f"Available users: {', '.join(usernames)}",
                    "data": {
                        "users": usernames,  # Keep for backward compatibility
                        "enhanced_users": enhanced_users,  # New enhanced data
                    },
                }
                return result  # noqa: TRY300, RET504
            except Exception:
                _LOGGER.exception("Unexpected error in get_available_users_service")
                raise

        async def update_task_service(call: ServiceCall) -> dict[str, Any]:
            """Update a task's details."""
            try:
                # Extract update fields from call data
                updates = {}

                # List of all possible update fields (excluding required ones)
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

                # Extract any fields that are present in the call data
                for field in update_fields:
                    if field in call.data:
                        updates[field] = call.data[field]

                # Always include assigned_to if present (can be updated)
                if "assigned_to" in call.data:
                    updates["assigned_to"] = call.data["assigned_to"]

                result = await api.update_task(
                    task_id=call.data["task_id"],
                    task_type=call.data["task_type"],
                    **updates,
                )

                # Fire custom event if update was successful
                if result.get("success"):
                    hass.bus.fire(
                        "tasktracker_task_updated",
                        {
                            "task_id": call.data["task_id"],
                            "updates": updates,
                            "update_data": result.get("data"),
                        },
                    )

                _LOGGER.info("Task updated successfully: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to update task")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in update_task_service")
                raise

        async def delete_completion_service(call: ServiceCall) -> dict[str, Any]:
            """Delete/undo a completion record."""
            try:
                result = await api.delete_completion(
                    completion_id=call.data["completion_id"]
                )

                # Fire custom event if deletion was successful
                if result.get("success"):
                    hass.bus.fire(
                        "tasktracker_completion_deleted",
                        {
                            "completion_id": call.data["completion_id"],
                            "deletion_data": result.get("data"),
                        },
                    )

                _LOGGER.info("Completion deleted successfully: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to delete completion")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in delete_completion_service")
                raise

        async def update_completion_service(call: ServiceCall) -> dict[str, Any]:
            """Update a completion record."""
            try:
                result = await api.update_completion(
                    completion_id=call.data["completion_id"],
                    completed_by=call.data.get("completed_by"),
                    notes=call.data.get("notes"),
                    completed_at=call.data.get("completed_at"),
                )

                # Fire custom event if update was successful
                if result.get("success"):
                    hass.bus.fire(
                        "tasktracker_completion_updated",
                        {
                            "completion_id": call.data["completion_id"],
                            "updates": {
                                k: v
                                for k, v in call.data.items()
                                if k != "completion_id" and v is not None
                            },
                            "update_data": result.get("data"),
                        },
                    )

                _LOGGER.info("Completion updated successfully: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to update completion")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in update_completion_service")
                raise

        async def get_daily_plan_service(call: ServiceCall) -> dict[str, Any]:
            """Get the daily plan for a user."""
            try:
                username = call.data.get("username")
                if not username:
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    username = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    # username may remain None, backend will infer by api key mapping

                result = await api.get_daily_plan(
                    username=username,
                    fair_weather=call.data.get("fair_weather"),
                    select_recommended=call.data.get("select_recommended"),
                )

                if result.get("success"):
                    hass.bus.fire(
                        EVENT_DAILY_PLAN,
                        {
                            "username": username,
                            "plan": result.get("data"),
                        },
                    )

                _LOGGER.debug("Daily plan retrieved: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to get daily plan")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in get_daily_plan_service")
                raise

        async def get_daily_plan_encouragement_service(
            call: ServiceCall,
        ) -> dict[str, Any]:
            """Get AI-powered encouragement for the daily plan."""
            try:
                username = call.data.get("username")
                if not username:
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    username = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    # username may remain None, backend will infer by api key mapping

                result = await api.get_daily_plan_encouragement(username=username)

                _LOGGER.debug("Daily plan encouragement retrieved: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to get daily plan encouragement")
                raise
            except Exception:
                _LOGGER.exception(
                    "Unexpected error in get_daily_plan_encouragement_service"
                )
                raise

        async def get_daily_state_service(call: ServiceCall) -> dict[str, Any]:
            """Get the daily state for a user."""
            try:
                username = call.data.get("username")
                if not username:
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    username = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    if not username:
                        msg = "No username provided and could not determine from user context"  # noqa: E501
                        raise TaskTrackerAPIError(msg)  # noqa: TRY301

                result = await api.get_daily_state(username)
                _LOGGER.debug("Daily state retrieved: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to get daily state")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in get_daily_state_service")
                raise

        async def set_daily_state_service(call: ServiceCall) -> dict[str, Any]:
            """Set/update the daily state for a user."""
            try:
                username = call.data.get("username")
                if not username:
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    username = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    if not username:
                        msg = "No username provided and could not determine from user context"  # noqa: E501
                        raise TaskTrackerAPIError(msg)  # noqa: TRY301

                # Extract daily state parameters
                energy = call.data.get("energy")
                motivation = call.data.get("motivation")
                focus = call.data.get("focus")
                pain = call.data.get("pain")
                mood = call.data.get("mood")
                free_time = call.data.get("free_time")

                result = await api.set_daily_state(
                    username=username,
                    energy=energy,
                    motivation=motivation,
                    focus=focus,
                    pain=pain,
                    mood=mood,
                    free_time=free_time,
                )

                if result.get("success"):
                    # Fire event for daily state change
                    state_data = result.get("data", {})
                    hass.bus.fire(
                        EVENT_DAILY_STATE_SET,
                        {
                            "username": username,
                            "state": state_data,
                        },
                    )

                _LOGGER.debug("Daily state updated: %s", result)
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to set daily state")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in set_daily_state_service")
                raise

        async def create_task_from_description_service(call: ServiceCall) -> dict[str, Any]:
            """Create a task using a natural-language description via server AI."""
            try:
                assigned_to = call.data.get("assigned_to")
                if not assigned_to:
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    assigned_to = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                    if not assigned_to:
                        msg = "No assigned_to provided and could not determine from user context"
                        raise TaskTrackerAPIError(msg)  # noqa: TRY301

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
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to create task from description")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in create_task_from_description_service")
                raise

        async def delete_task_service(call: ServiceCall) -> dict[str, Any]:
            """Delete a task by id and type."""
            try:
                assigned_to = call.data.get("assigned_to")
                if not assigned_to:
                    user_id = call.context.user_id if call.context else None
                    current_config = get_current_config()
                    assigned_to = get_tasktracker_username_for_ha_user(
                        hass, user_id, current_config
                    )
                result = await api.delete_task(
                    task_id=call.data["task_id"],
                    task_type=call.data["task_type"],
                    assigned_to=assigned_to,
                )
                if result.get("success"):
                    # Reuse existing task update event so listeners refresh consistently
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
                return result  # noqa: TRY300
            except TaskTrackerAPIError:
                _LOGGER.exception("Failed to delete task")
                raise
            except Exception:
                _LOGGER.exception("Unexpected error in delete_task_service")
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
            schema=LIST_LEFTOVERS_SCHEMA,
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

        hass.services.async_register(
            DOMAIN,
            SERVICE_UPDATE_TASK,
            update_task_service,
            schema=UPDATE_TASK_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_UPDATE_TASK)

        hass.services.async_register(
            DOMAIN,
            SERVICE_DELETE_COMPLETION,
            delete_completion_service,
            schema=DELETE_COMPLETION_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_DELETE_COMPLETION)

        hass.services.async_register(
            DOMAIN,
            SERVICE_UPDATE_COMPLETION,
            update_completion_service,
            schema=UPDATE_COMPLETION_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_UPDATE_COMPLETION)

        # Daily Plan & Daily State services
        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_DAILY_PLAN,
            get_daily_plan_service,
            schema=GET_DAILY_PLAN_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_GET_DAILY_PLAN)

        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_DAILY_PLAN_ENCOURAGEMENT,
            get_daily_plan_encouragement_service,
            schema=GET_DAILY_PLAN_ENCOURAGEMENT_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_GET_DAILY_PLAN_ENCOURAGEMENT)

        hass.services.async_register(
            DOMAIN,
            SERVICE_GET_DAILY_STATE,
            get_daily_state_service,
            schema=GET_DAILY_STATE_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_GET_DAILY_STATE)

        hass.services.async_register(
            DOMAIN,
            SERVICE_SET_DAILY_STATE,
            set_daily_state_service,
            schema=SET_DAILY_STATE_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_SET_DAILY_STATE)

        hass.services.async_register(
            DOMAIN,
            SERVICE_CREATE_TASK_FROM_DESCRIPTION,
            create_task_from_description_service,
            schema=CREATE_TASK_FROM_DESCRIPTION_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_CREATE_TASK_FROM_DESCRIPTION)

        hass.services.async_register(
            DOMAIN,
            SERVICE_DELETE_TASK,
            delete_task_service,
            schema=DELETE_TASK_SCHEMA,
            supports_response=SupportsResponse.ONLY,
        )
        _LOGGER.debug("Registered service: %s", SERVICE_DELETE_TASK)

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
        SERVICE_UPDATE_TASK,
        SERVICE_DELETE_COMPLETION,
        SERVICE_UPDATE_COMPLETION,
        SERVICE_GET_DAILY_PLAN,
        SERVICE_GET_DAILY_PLAN_ENCOURAGEMENT,
        SERVICE_GET_DAILY_STATE,
        SERVICE_SET_DAILY_STATE,
        SERVICE_CREATE_TASK_FROM_DESCRIPTION,
        SERVICE_DELETE_TASK,
    ]

    for service in services_to_remove:
        hass.services.async_remove(DOMAIN, service)

    _LOGGER.info("TaskTracker services unloaded successfully")
