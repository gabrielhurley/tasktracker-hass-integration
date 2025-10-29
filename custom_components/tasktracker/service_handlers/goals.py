"""Service handlers for goal management operations."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from ..api import TaskTrackerAPI, TaskTrackerAPIError
from ..cache_utils import get_cached_or_fetch, invalidate_user_cache
from ..const import (
    CACHE_TTL_GOALS,
    EVENT_GOAL_CREATED,
    EVENT_GOAL_DELETED,
    EVENT_GOAL_UPDATED,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from typing import Any

    from homeassistant.core import HomeAssistant, ServiceCall


_LOGGER = logging.getLogger(__name__)


def list_goals_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable,
    get_tasktracker_username_for_ha_user: Callable,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a handler for listing goals.

    Args:
        hass: Home Assistant instance
        api: TaskTracker API client
        get_current_config: Function to get current integration config
        get_tasktracker_username_for_ha_user: Function to get username for HA user

    Returns:
        Async handler function

    """

    async def handler(call: ServiceCall) -> dict[str, Any]:
        """Handle list_goals service call."""
        try:
            # Get username from context
            user_id = call.context.user_id if call.context else None
            current_config = get_current_config()
            if not current_config:
                return {"success": False, "spoken_response": "Integration not configured"}

            username = get_tasktracker_username_for_ha_user(hass, user_id, current_config)
            if not username:
                return {"success": False, "spoken_response": "Unable to determine user"}

            result = await get_cached_or_fetch(
                hass=hass,
                cache_key=f"goals_{username}",
                ttl=CACHE_TTL_GOALS,
                fetch_fn=lambda: api.list_goals(username),
            )
            # Return response directly - Home Assistant wraps it automatically
            return {"success": True, "data": result}
        except TaskTrackerAPIError as err:
            _LOGGER.error("Failed to list goals: %s", err)
            return {"success": False, "spoken_response": str(err)}

    return handler


def create_goal_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable,
    get_tasktracker_username_for_ha_user: Callable,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a handler for creating a new goal.

    Args:
        hass: Home Assistant instance
        api: TaskTracker API client
        get_current_config: Function to get current integration config
        get_tasktracker_username_for_ha_user: Function to get username for HA user

    Returns:
        Async handler function

    """

    async def handler(call: ServiceCall) -> dict[str, Any]:
        """Handle create_goal service call."""
        # Get username from context
        user_id = call.context.user_id if call.context else None
        current_config = get_current_config()
        if not current_config:
            return {"success": False, "spoken_response": "Integration not configured"}

        username = get_tasktracker_username_for_ha_user(hass, user_id, current_config)
        if not username:
            return {"success": False, "spoken_response": "Unable to determine user"}

        name = call.data["name"]
        description = call.data.get("description")
        is_active = call.data.get("is_active", True)
        priority = call.data.get("priority", 2)

        try:
            result = await api.create_goal(
                username=username,
                name=name,
                description=description,
                is_active=is_active,
                priority=priority,
            )

            # Invalidate goals cache
            invalidate_user_cache(hass, username, ["goals"])

            # Fire goal created event
            hass.bus.async_fire(
                EVENT_GOAL_CREATED,
                {
                    "goal_id": result.get("id"),
                    "name": result.get("name"),
                    "username": username,
                },
            )

            # Return response directly - Home Assistant wraps it automatically
            return {"success": True, "data": result}
        except TaskTrackerAPIError as err:
            _LOGGER.error("Failed to create goal: %s", err)
            return {"response": {"success": False, "spoken_response": str(err)}}

    return handler


def update_goal_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable,
    get_tasktracker_username_for_ha_user: Callable,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a handler for updating an existing goal.

    Args:
        hass: Home Assistant instance
        api: TaskTracker API client
        get_current_config: Function to get current integration config
        get_tasktracker_username_for_ha_user: Function to get username for HA user

    Returns:
        Async handler function

    """

    async def handler(call: ServiceCall) -> dict[str, Any]:
        """Handle update_goal service call."""
        # Get username from context
        user_id = call.context.user_id if call.context else None
        current_config = get_current_config()
        if not current_config:
            return {"success": False, "spoken_response": "Integration not configured"}

        username = get_tasktracker_username_for_ha_user(hass, user_id, current_config)
        if not username:
            return {"success": False, "spoken_response": "Unable to determine user"}

        goal_id = call.data["goal_id"]
        name = call.data.get("name")
        description = call.data.get("description")
        is_active = call.data.get("is_active")
        priority = call.data.get("priority")

        try:
            result = await api.update_goal(
                username=username,
                goal_id=goal_id,
                name=name,
                description=description,
                is_active=is_active,
                priority=priority,
            )

            # Invalidate goals cache
            invalidate_user_cache(hass, username, ["goals"])

            # Fire goal updated event
            hass.bus.async_fire(
                EVENT_GOAL_UPDATED,
                {
                    "goal_id": result.get("id"),
                    "name": result.get("name"),
                    "username": username,
                },
            )

            # Return response directly - Home Assistant wraps it automatically
            return {"success": True, "data": result}
        except TaskTrackerAPIError as err:
            _LOGGER.error("Failed to update goal %s: %s", goal_id, err)
            return {"response": {"success": False, "spoken_response": str(err)}}

    return handler


def delete_goal_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable,
    get_tasktracker_username_for_ha_user: Callable,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a handler for deleting a goal.

    Args:
        hass: Home Assistant instance
        api: TaskTracker API client
        get_current_config: Function to get current integration config
        get_tasktracker_username_for_ha_user: Function to get username for HA user

    Returns:
        Async handler function

    """

    async def handler(call: ServiceCall) -> dict[str, Any]:
        """Handle delete_goal service call."""
        # Get username from context
        user_id = call.context.user_id if call.context else None
        current_config = get_current_config()
        if not current_config:
            return {"success": False, "spoken_response": "Integration not configured"}

        username = get_tasktracker_username_for_ha_user(hass, user_id, current_config)
        if not username:
            return {"success": False, "spoken_response": "Unable to determine user"}

        goal_id = call.data["goal_id"]

        try:
            result = await api.delete_goal(username=username, goal_id=goal_id)

            # Invalidate goals cache
            invalidate_user_cache(hass, username, ["goals"])

            # Fire goal deleted event
            hass.bus.async_fire(
                EVENT_GOAL_DELETED,
                {
                    "goal_id": goal_id,
                    "username": username,
                },
            )

            # Wrap response for frontend compatibility (delete returns empty response)
            return {"response": {"success": True}}
        except TaskTrackerAPIError as err:
            _LOGGER.error("Failed to delete goal %s: %s", goal_id, err)
            return {"response": {"success": False, "spoken_response": str(err)}}

    return handler


def list_goal_tasks_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable,
    get_tasktracker_username_for_ha_user: Callable,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a handler for listing tasks associated with a goal.

    Args:
        hass: Home Assistant instance
        api: TaskTracker API client
        get_current_config: Function to get current integration config
        get_tasktracker_username_for_ha_user: Function to get username for HA user

    Returns:
        Async handler function

    """

    async def handler(call: ServiceCall) -> dict[str, Any]:
        """Handle list_goal_tasks service call."""
        # Get username from context
        user_id = call.context.user_id if call.context else None
        current_config = get_current_config()
        if not current_config:
            return {"success": False, "spoken_response": "Integration not configured"}

        username = get_tasktracker_username_for_ha_user(hass, user_id, current_config)
        if not username:
            return {"success": False, "spoken_response": "Unable to determine user"}

        goal_id = call.data["goal_id"]

        try:
            result = await get_cached_or_fetch(
                hass=hass,
                cache_key=f"goal_tasks_{username}_{goal_id}",
                ttl=CACHE_TTL_GOALS,
                fetch_fn=lambda: api.list_goal_tasks(username, goal_id),
            )
            # Return response directly - Home Assistant wraps it automatically
            return {"success": True, "data": result}
        except TaskTrackerAPIError as err:
            _LOGGER.error("Failed to list tasks for goal %s: %s", goal_id, err)
            return {"response": {"success": False, "spoken_response": str(err)}}

    return handler


def associate_task_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable,
    get_tasktracker_username_for_ha_user: Callable,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a handler for associating a task with a goal.

    Args:
        hass: Home Assistant instance
        api: TaskTracker API client
        get_current_config: Function to get current integration config
        get_tasktracker_username_for_ha_user: Function to get username for HA user

    Returns:
        Async handler function

    """

    async def handler(call: ServiceCall) -> dict[str, Any]:
        """Handle associate_task_with_goal service call."""
        # Get username from context
        user_id = call.context.user_id if call.context else None
        current_config = get_current_config()
        if not current_config:
            return {"success": False, "spoken_response": "Integration not configured"}

        username = get_tasktracker_username_for_ha_user(hass, user_id, current_config)
        if not username:
            return {"success": False, "spoken_response": "Unable to determine user"}

        goal_id = call.data["goal_id"]
        task_type = call.data["task_type"]
        task_id = call.data["task_id"]

        try:
            result = await api.associate_task_with_goal(
                username=username,
                goal_id=goal_id,
                task_type=task_type,
                task_id=task_id,
            )

            # Invalidate goals and goal tasks cache
            invalidate_user_cache(hass, username, ["goals", f"goal_tasks_{goal_id}"])

            # Fire goal updated event
            hass.bus.async_fire(
                EVENT_GOAL_UPDATED,
                {
                    "goal_id": goal_id,
                    "action": "task_associated",
                    "task_type": task_type,
                    "task_id": task_id,
                    "username": username,
                },
            )

            # Return response directly - Home Assistant wraps it automatically
            return {"success": True, "data": result}
        except TaskTrackerAPIError as err:
            _LOGGER.error(
                "Failed to associate task %s:%s with goal %s: %s",
                task_type,
                task_id,
                goal_id,
                err,
            )
            return {"response": {"success": False, "spoken_response": str(err)}}

    return handler


def remove_task_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable,
    get_tasktracker_username_for_ha_user: Callable,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a handler for removing a task association from a goal.

    Args:
        hass: Home Assistant instance
        api: TaskTracker API client
        get_current_config: Function to get current integration config
        get_tasktracker_username_for_ha_user: Function to get username for HA user

    Returns:
        Async handler function

    """

    async def handler(call: ServiceCall) -> dict[str, Any]:
        """Handle remove_task_from_goal service call."""
        # Get username from context
        user_id = call.context.user_id if call.context else None
        current_config = get_current_config()
        if not current_config:
            return {"success": False, "spoken_response": "Integration not configured"}

        username = get_tasktracker_username_for_ha_user(hass, user_id, current_config)
        if not username:
            return {"success": False, "spoken_response": "Unable to determine user"}

        goal_id = call.data["goal_id"]
        association_id = call.data["association_id"]

        try:
            result = await api.remove_task_from_goal(
                username=username,
                goal_id=goal_id,
                association_id=association_id,
            )

            # Invalidate goals and goal tasks cache
            invalidate_user_cache(hass, username, ["goals", f"goal_tasks_{goal_id}"])

            # Fire goal updated event
            hass.bus.async_fire(
                EVENT_GOAL_UPDATED,
                {
                    "goal_id": goal_id,
                    "action": "task_removed",
                    "association_id": association_id,
                    "username": username,
                },
            )

            # Wrap response for frontend compatibility (delete returns empty response)
            return {"response": {"success": True}}
        except TaskTrackerAPIError as err:
            _LOGGER.error(
                "Failed to remove task association %s from goal %s: %s",
                association_id,
                goal_id,
                err,
            )
            return {"response": {"success": False, "spoken_response": str(err)}}

    return handler
