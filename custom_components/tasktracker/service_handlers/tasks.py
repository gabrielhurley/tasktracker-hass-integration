"""Service handlers related to tasks and queries."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from ..api import TaskTrackerAPI, TaskTrackerAPIError

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from typing import Any

    from homeassistant.core import HomeAssistant, ServiceCall


_LOGGER = logging.getLogger(__name__)


def complete_task_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a service handler for completing tasks by ID.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that completes tasks by ID.

    The returned handler expects the following service data:
        - task_id (str): The ID of the task to complete.
        - completed_by (str, optional): The username who completed the task. If not provided,
          will be inferred from the service call context.
        - notes (str, optional): Notes about the completion.

    The handler will:
        - Complete the task via the API
        - Fire a 'tasktracker_task_completed' event on success
        - Log the operation result
        - Return the API response

    Raises:
        TaskTrackerAPIError: If no completed_by can be determined from context.

    """

    async def complete_task_service(call: ServiceCall) -> dict[str, Any]:
        """
        Complete a task by ID.

        Args:
            call: The Home Assistant service call containing task completion data.

        Returns:
            The API response from the task completion operation.

        Raises:
            TaskTrackerAPIError: If the API call fails or no completed_by can be determined.
            Exception: For any other unexpected errors.

        """
        try:
            completed_by = call.data.get("completed_by")
            if not completed_by:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                completed_by = user_lookup_fn(hass, user_id, current_config)
                if not completed_by:
                    msg = "No completed_by provided and could not determine from user context"
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
    """
    Create a service handler for completing tasks by name.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that completes tasks by name.

    The returned handler expects the following service data:
        - name (str): The name of the task to complete.
        - completed_by (str, optional): The username who completed the task. If not provided,
          will be inferred from the service call context.
        - notes (str, optional): Notes about the completion.
        - completed_at (str, optional): ISO timestamp of when the task was completed.
        - event_type (str, optional): Type of event to fire. Defaults to "task_completed".
          Can be "leftover_disposed" for leftover disposal events.

    The handler will:
        - Complete the task via the API
        - Fire an appropriate event based on event_type on success
        - Log the operation result
        - Return the API response

    Raises:
        TaskTrackerAPIError: If no completed_by can be determined from context.

    """

    async def complete_task_by_name_service(call: ServiceCall) -> dict[str, Any]:
        """
        Complete a task by name.

        Args:
            call: The Home Assistant service call containing task completion data.

        Returns:
            The API response from the task completion operation.

        Raises:
            TaskTrackerAPIError: If the API call fails or no completed_by can be determined.
            Exception: For any other unexpected errors.

        """
        try:
            completed_by = call.data.get("completed_by")
            if not completed_by:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                completed_by = user_lookup_fn(hass, user_id, current_config)
                if not completed_by:
                    msg = "No completed_by provided and could not determine from user context"
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
    """
    Create a service handler for creating ad-hoc tasks.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that creates ad-hoc tasks.

    The returned handler expects the following service data:
        - name (str): The name of the ad-hoc task.
        - assigned_users (list[str], optional): The usernames assigned to the task. If not provided,
          will be inferred from the service call context.
        - duration_minutes (int, optional): Estimated duration in minutes.
        - priority (str, optional): Task priority level.

    The handler will:
        - Create the ad-hoc task via the API
        - Fire a 'tasktracker_task_created' event on success
        - Log the operation result
        - Return the API response

    Raises:
        TaskTrackerAPIError: If no assigned_users can be determined from context.

    """

    async def create_adhoc_task_service(call: ServiceCall) -> dict[str, Any]:
        """
        Create an ad-hoc task.

        Args:
            call: The Home Assistant service call containing task creation data.

        Returns:
            The API response from the task creation operation.

        Raises:
            TaskTrackerAPIError: If the API call fails or no assigned_to can be determined.
            Exception: For any other unexpected errors.

        """
        try:
            assigned_users = call.data.get("assigned_users", [])
            if not assigned_users:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                assigned_to = user_lookup_fn(hass, user_id, current_config)
                if not assigned_to:
                    msg = "No assigned_users provided and could not determine from user context"
                    raise TaskTrackerAPIError(msg)
                assigned_users = [assigned_to]
            result = await api.create_adhoc_task(
                name=call.data["name"],
                assigned_users=assigned_users,
                duration_minutes=call.data.get("duration_minutes"),
                priority=call.data.get("priority"),
            )
            if result.get("success"):
                hass.bus.fire(
                    "tasktracker_task_created",
                    {
                        "task_name": call.data["name"],
                        "assigned_users": assigned_users,
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
    """
    Create a service handler for querying task information.

    Args:
        api: The TaskTracker API client instance.

    Returns:
        A service handler function that queries task information.

    The returned handler expects the following service data:
        - name (str): The name of the task to query.
        - question_type (str, optional): Type of question to ask about the task.

    The handler will:
        - Query task information via the API
        - Log the operation result
        - Return the API response

    """

    async def query_task_service(call: ServiceCall) -> dict[str, Any]:
        """
        Query information about a task.

        Args:
            call: The Home Assistant service call containing query parameters.

        Returns:
            The API response containing task query results.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
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
    """
    Create a service handler for getting recommended tasks.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that gets recommended tasks.

    The returned handler expects the following service data:
        - username (str, optional): The username to get recommendations for. If not provided,
          will be inferred from the service call context.
        - available_minutes (int): The number of minutes available for tasks.

    The handler will:
        - Get recommended tasks via the API
        - Log the operation result
        - Return the API response

    Raises:
        TaskTrackerAPIError: If no username can be determined from context or if
        available_minutes is not provided.

    """

    async def get_recommended_tasks_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get recommended tasks for a user.

        Args:
            call: The Home Assistant service call containing recommendation parameters.

        Returns:
            The API response containing recommended tasks.

        Raises:
            TaskTrackerAPIError: If the API call fails, no username can be determined,
            or available_minutes is not provided.
            Exception: For any other unexpected errors.

        """
        try:
            username = call.data.get("username")
            if not username:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                username = user_lookup_fn(hass, user_id, current_config)
                if not username:
                    msg = "No username provided and could not determine from user context"
                    raise TaskTrackerAPIError(msg)
            available_minutes = call.data.get("available_minutes")
            if available_minutes is None:
                msg = "available_minutes is required for get_recommended_tasks"
                raise TaskTrackerAPIError(msg)
            result = await api.get_recommended_tasks(
                username=username,
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
    """
    Create a service handler for getting available tasks.

    Args:
        api: The TaskTracker API client instance.

    Returns:
        A service handler function that gets available tasks.

    The returned handler expects the following service data:
        - username (str, optional): Filter tasks by assigned user.
        - available_minutes (int, optional): Filter tasks by available time.
        - upcoming_days (int, optional): Number of upcoming days to consider.

    The handler will:
        - Get available tasks via the API
        - Log the operation result
        - Return the API response

    """

    async def get_available_tasks_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get available tasks.

        Args:
            call: The Home Assistant service call containing filter parameters.

        Returns:
            The API response containing available tasks.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
        try:
            result = await api.get_available_tasks(
                username=call.data.get("username"),
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
    """
    Create a service handler for getting all tasks.

    Args:
        api: The TaskTracker API client instance.

    Returns:
        A service handler function that gets all tasks.

    The returned handler expects the following service data:
        - thin (bool, optional): Whether to return thin task data. Defaults to False.
        - username (str, optional): Filter tasks by assigned user.

    The handler will:
        - Get all tasks via the API
        - Log the operation result
        - Return the API response

    """

    async def get_all_tasks_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get all tasks.

        Args:
            call: The Home Assistant service call containing filter parameters.

        Returns:
            The API response containing all tasks.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
        try:
            result = await api.get_all_tasks(
                thin=call.data.get("thin", False),
                username=call.data.get("username"),
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
    """
    Create a service handler for getting recent task completions.

    Args:
        api: The TaskTracker API client instance.

    Returns:
        A service handler function that gets recent completions.

    The returned handler expects the following service data:
        - username (str, optional): Filter completions by assigned user.
        - days (int, optional): Number of days to look back.
        - limit (int, optional): Maximum number of completions to return.

    The handler will:
        - Get recent completions via the API
        - Log the operation result
        - Return the API response

    """

    async def get_recent_completions_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get recent task completions.

        Args:
            call: The Home Assistant service call containing filter parameters.

        Returns:
            The API response containing recent completions.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
        try:
            result = await api.get_recent_completions(
                username=call.data.get("username"),
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
    """
    Create a service handler for updating tasks.

    Args:
        api: The TaskTracker API client instance.

    Returns:
        A service handler function that updates tasks.

    The returned handler expects the following service data:
        - task_id (str): The ID of the task to update.
        - task_type (str): The type of task (e.g., "recurring", "adhoc", "selfcare").
        - assigned_users (list[str], optional): New assigned users.
        - name (str, optional): New task name.
        - priority (str, optional): New priority level.
        - notes (str, optional): New notes.
        - is_active (bool, optional): Whether the task is active.
        - overdue_severity (str, optional): Overdue severity level.
        - duration_minutes (int, optional): New duration in minutes.
        - frequency_value (int, optional): New frequency value.
        - frequency_unit (str, optional): New frequency unit.
        - next_due (str, optional): New next due date.
        - energy_cost (int, optional): New energy cost.
        - focus_cost (int, optional): New focus cost.
        - pain_cost (int, optional): New pain cost.
        - motivation_boost (int, optional): New motivation boost.
        - satisfaction (int, optional): New satisfaction level.
        - impact (int, optional): New impact level.
        - suitable_after_hours (str, optional): Whether suitable after hours.
        - allowed_days (list, optional): New allowed days.
        - requires_fair_weather (bool, optional): Whether requires fair weather.
        - level (str, optional): New level.
        - required_occurrences (int, optional): New required occurrences.
        - tags (list, optional): New tags.

    The handler will:
        - Update the task via the API
        - Fire a 'tasktracker_task_updated' event on success
        - Log the operation result
        - Return the API response

    """

    async def update_task_service(call: ServiceCall) -> dict[str, Any]:
        """
        Update a task.

        Args:
            call: The Home Assistant service call containing task update data.

        Returns:
            The API response from the task update operation.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
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
            if "assigned_users" in call.data:
                updates["assigned_users"] = call.data["assigned_users"]
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
    """
    Create a service handler for creating tasks from descriptions.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that creates tasks from descriptions.

    The returned handler expects the following service data:
        - task_type (str): The type of task to create (e.g., "recurring", "adhoc", "selfcare").
        - task_description (str): Description of the task to create.
        - assigned_users (list[str], optional): The usernames assigned to the task. If not provided,
          will be inferred from the service call context.

    The handler will:
        - Create the task from description via the API
        - Fire a 'tasktracker_task_created' event on success
        - Log the operation result
        - Return the API response

    Raises:
        TaskTrackerAPIError: If no assigned_users can be determined from context.

    """

    async def create_task_from_description_service(call: ServiceCall) -> dict[str, Any]:
        """
        Create a task from a description.

        Args:
            call: The Home Assistant service call containing task creation data.

        Returns:
            The API response from the task creation operation.

        Raises:
            TaskTrackerAPIError: If the API call fails or no assigned_to can be determined.
            Exception: For any other unexpected errors.

        """
        try:
            assigned_users = call.data.get("assigned_users", [])
            if not assigned_users:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                assigned_to = user_lookup_fn(hass, user_id, current_config)
                if not assigned_to:
                    msg = "No assigned_users provided and could not determine from user context"
                    raise TaskTrackerAPIError(msg)
                assigned_users = [assigned_to]
            result = await api.create_task_from_description(
                task_type=call.data["task_type"],
                task_description=call.data["task_description"],
                assigned_users=assigned_users,
            )
            if result.get("success"):
                data = result.get("data", {}) or {}
                task = data.get("task") or {}
                hass.bus.fire(
                    "tasktracker_task_created",
                    {
                        "task_name": task.get("name")
                        or call.data.get("task_description"),
                        "assigned_users": assigned_users,
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
    """
    Create a service handler for deleting tasks.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that deletes tasks.

    The returned handler expects the following service data:
        - task_id (str): The ID of the task to delete.
        - task_type (str): The type of task to delete.
        - assigned_users (list[str], optional): The usernames assigned to the task. If not provided,
          will be inferred from the service call context.

    The handler will:
        - Delete the task via the API
        - Fire 'tasktracker_task_updated' and 'tasktracker_task_deleted' events on success
        - Log the operation result
        - Return the API response

    """

    async def delete_task_service(call: ServiceCall) -> dict[str, Any]:
        """
        Delete a task.

        Args:
            call: The Home Assistant service call containing task deletion data.

        Returns:
            The API response from the task deletion operation.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
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
