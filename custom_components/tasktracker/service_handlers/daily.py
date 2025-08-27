"""Service handlers for daily plan and daily state."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from ..api import TaskTrackerAPI, TaskTrackerAPIError

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from typing import Any

    from homeassistant.core import HomeAssistant, ServiceCall

from ..const import EVENT_DAILY_PLAN, EVENT_DAILY_STATE_SET

_LOGGER = logging.getLogger(__name__)


def get_daily_plan_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a service handler for retrieving daily plans.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that retrieves daily plans.

    The returned handler expects the following service data:
        - username (str, optional): The username to get the plan for. If not provided,
          will be inferred from the service call context.
        - fair_weather (bool, optional): Whether to include fair weather tasks.
        - select_recommended (bool, optional): Whether to select recommended tasks.

    The handler will:
        - Retrieve the daily plan via the API
        - Fire a 'tasktracker_daily_plan' event on success
        - Log the operation result
        - Return the API response

    """

    async def get_daily_plan_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get a daily plan for a user.

        Args:
            call: The Home Assistant service call containing plan parameters.

        Returns:
            The API response containing the daily plan.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
        try:
            username = call.data.get("username")
            if not username:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                username = user_lookup_fn(hass, user_id, current_config)
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
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to get daily plan")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in get_daily_plan_service")
            raise

    return get_daily_plan_service


def get_daily_plan_encouragement_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a service handler for retrieving daily plan encouragement messages.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that retrieves encouragement messages.

    The returned handler expects the following service data:
        - username (str, optional): The username to get encouragement for. If not provided,
          will be inferred from the service call context.

    The handler will:
        - Retrieve encouragement messages via the API
        - Log the operation result
        - Return the API response

    """

    async def get_daily_plan_encouragement_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get encouragement messages for a user's daily plan.

        Args:
            call: The Home Assistant service call containing user information.

        Returns:
            The API response containing encouragement messages.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
        try:
            username = call.data.get("username")
            if not username:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                username = user_lookup_fn(hass, user_id, current_config)
            result = await api.get_daily_plan_encouragement(username=username)
            _LOGGER.debug("Daily plan encouragement retrieved: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to get daily plan encouragement")
            raise
        except Exception:
            _LOGGER.exception(
                "Unexpected error in get_daily_plan_encouragement_service"
            )
            raise

    return get_daily_plan_encouragement_service


def get_daily_state_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a service handler for retrieving daily state information.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that retrieves daily state.

    The returned handler expects the following service data:
        - username (str, optional): The username to get state for. If not provided,
          will be inferred from the service call context.

    The handler will:
        - Retrieve daily state via the API
        - Log the operation result
        - Return the API response

    Raises:
        TaskTrackerAPIError: If no username can be determined from context.

    """

    async def get_daily_state_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get daily state information for a user.

        Args:
            call: The Home Assistant service call containing user information.

        Returns:
            The API response containing daily state information.

        Raises:
            TaskTrackerAPIError: If the API call fails or no username can be determined.
            Exception: For any other unexpected errors.

        """
        try:
            username = call.data.get("username")
            if not username:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                username = user_lookup_fn(hass, user_id, current_config)
                if not username:
                    msg = (
                        "No username provided and could not determine from user context"
                    )
                    raise TaskTrackerAPIError(msg)
            result = await api.get_daily_state(username)
            _LOGGER.debug("Daily state retrieved: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to get daily state")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in get_daily_state_service")
            raise

    return get_daily_state_service


def set_daily_state_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a service handler for setting daily state information.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that sets daily state.

    The returned handler expects the following service data:
        - username (str, optional): The username to set state for. If not provided,
          will be inferred from the service call context.
        - energy (int, optional): Energy level (1-10).
        - motivation (int, optional): Motivation level (1-10).
        - focus (int, optional): Focus level (1-10).
        - pain (int, optional): Pain level (1-10).
        - mood (int, optional): Mood level (1-10).
        - free_time (int, optional): Available free time in minutes.
        - is_sick (bool, optional): Whether the user is sick.

    The handler will:
        - Set daily state via the API
        - Fire a 'tasktracker_daily_state_set' event on success
        - Log the operation result
        - Return the API response

    Raises:
        TaskTrackerAPIError: If no username can be determined from context.

    """

    async def set_daily_state_service(call: ServiceCall) -> dict[str, Any]:
        """
        Set daily state information for a user.

        Args:
            call: The Home Assistant service call containing state data.

        Returns:
            The API response from the state update operation.

        Raises:
            TaskTrackerAPIError: If the API call fails or no username can be determined.
            Exception: For any other unexpected errors.

        """
        try:
            username = call.data.get("username")
            if not username:
                user_id = call.context.user_id if call.context else None
                current_config = get_current_config()
                username = user_lookup_fn(hass, user_id, current_config)
                if not username:
                    msg = (
                        "No username provided and could not determine from user context"
                    )
                    raise TaskTrackerAPIError(msg)
            result = await api.set_daily_state(
                username=username,
                energy=call.data.get("energy"),
                motivation=call.data.get("motivation"),
                focus=call.data.get("focus"),
                pain=call.data.get("pain"),
                mood=call.data.get("mood"),
                free_time=call.data.get("free_time"),
                is_sick=call.data.get("is_sick"),
            )
            if result.get("success"):
                state_data = result.get("data", {})
                hass.bus.fire(
                    EVENT_DAILY_STATE_SET,
                    {
                        "username": username,
                        "state": state_data,
                    },
                )
            _LOGGER.debug("Daily state updated: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to set daily state")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in set_daily_state_service")
            raise

    return set_daily_state_service
