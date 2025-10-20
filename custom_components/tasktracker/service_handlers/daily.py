"""Service handlers for daily plan and state operations."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from ..api import TaskTrackerAPI, TaskTrackerAPIError
from ..cache_utils import get_cached_or_fetch, invalidate_user_cache
from ..const import (
    CACHE_TTL_DAILY_STATE,
    CACHE_TTL_ENCOURAGEMENT,
)

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from typing import Any

    from homeassistant.core import HomeAssistant, ServiceCall

    from ..coordinators import DailyPlanCoordinator


_LOGGER = logging.getLogger(__name__)


def _check_logical_day_boundary(
    coordinator: DailyPlanCoordinator, username: str
) -> bool:
    """
    Check if the logical day has changed since coordinator data was cached.

    Args:
        coordinator: The daily plan coordinator instance
        username: Username for logging purposes

    Returns:
        True if logical day has changed (needs refresh), False otherwise

    """
    if not coordinator.data:
        return False

    from datetime import datetime, timedelta
    from zoneinfo import ZoneInfo

    try:
        # Extract user timezone and reset time from cached data
        user_context = coordinator.data.get("user_context", {})
        cached_logical_date_str = user_context.get("current_logical_date")
        user_tz_str = user_context.get("timezone", "UTC")
        reset_time_str = user_context.get("daily_reset_time", "05:00:00")

        # DEFENSIVE: If no logical date in cached data, assume stale
        if not cached_logical_date_str:
            _LOGGER.info(
                "No logical date in coordinator data for %s - forcing refresh",
                username,
            )
            return True

        # Parse reset time (HH:MM:SS)
        reset_hour, reset_minute, _reset_second = map(int, reset_time_str.split(":"))

        # Calculate current logical date
        user_tz = ZoneInfo(user_tz_str)
        now = datetime.now(user_tz)

        # If before reset time, logical day is yesterday
        if now.hour < reset_hour or (
            now.hour == reset_hour and now.minute < reset_minute
        ):
            current_logical_date = (now - timedelta(days=1)).date()
        else:
            current_logical_date = now.date()

        current_logical_date_str = current_logical_date.isoformat()

        # If dates don't match, logical day has changed
        if cached_logical_date_str != current_logical_date_str:
            _LOGGER.info(
                "Logical day changed for %s: cached=%s, current=%s - forcing refresh",
                username,
                cached_logical_date_str,
                current_logical_date_str,
            )
            return True
        return False
    except (ValueError, KeyError, OSError) as err:
        # DEFENSIVE: Force refresh on any error to avoid serving stale data
        _LOGGER.warning(
            "Failed to check logical day boundary for %s: %s - forcing refresh to be safe",
            username,
            err,
        )
        return True


async def _refresh_coordinator_if_needed(
    coordinator: DailyPlanCoordinator,
    username: str,
    select_recommended: bool,  # noqa: FBT001
    fair_weather: bool | None,
) -> bool:
    """
    Update coordinator parameters and refresh if needed.

    Args:
        coordinator: The daily plan coordinator instance
        username: Username for logging purposes
        select_recommended: Filter by recommendation
        fair_weather: Weather constraint filter

    Returns:
        True if coordinator has data after refresh, False otherwise

    """
    # Check if logical day changed
    logical_day_changed = _check_logical_day_boundary(coordinator, username)

    # Check if parameters changed
    params_changed = (
        coordinator.select_recommended != select_recommended
        or coordinator.fair_weather != fair_weather
    )

    # Force refresh if logical day changed or params changed
    if logical_day_changed or params_changed:
        if logical_day_changed:
            _LOGGER.debug("Logical day changed for %s - clearing stale data", username)
            coordinator.data = None
        if params_changed:
            _LOGGER.debug("Coordinator params changed for %s - refreshing", username)

        coordinator.select_recommended = select_recommended
        coordinator.fair_weather = fair_weather
        await coordinator.async_refresh()

    return coordinator.data is not None


def get_daily_plan_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a service handler for getting daily plans.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that gets daily plans.

    The returned handler expects the following service data:
        - username (str, optional): The username to get the plan for. If not provided,
          will be inferred from the service call context.
        - select_recommended (bool, optional): Whether to filter tasks by recommendation.
        - fair_weather (bool, optional): Weather constraint filter.

    The handler will:
        - Check for an existing DailyPlanCoordinator for the user
        - If found, update coordinator parameters and request refresh if needed
        - Return data from coordinator if available
        - Fall back to direct API call if no coordinator or data
        - Log the operation result
        - Return the API response

    """

    async def get_daily_plan_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get daily plan for a user.

        Args:
            call: The Home Assistant service call containing user information and filters.

        Returns:
            The API response containing the daily plan.

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

            select_recommended = call.data.get("select_recommended", False)
            fair_weather = call.data.get("fair_weather")

            # Check for coordinator
            from ..cache_utils import get_entry_data

            entry_data = get_entry_data(hass)
            coordinators = entry_data.get("coordinators", {})

            if username in coordinators and "daily_plan" in coordinators[username]:
                coordinator = coordinators[username]["daily_plan"]
                _LOGGER.debug(
                    "Found coordinator for %s, has data: %s",
                    username,
                    coordinator.data is not None,
                )

                # Update coordinator and refresh if needed
                has_data = await _refresh_coordinator_if_needed(
                    coordinator, username, select_recommended, fair_weather
                )

                # Return coordinator data if available
                if has_data:
                    _LOGGER.debug(
                        "Returning daily plan from coordinator for %s", username
                    )
                    return coordinator.data
                _LOGGER.warning(
                    "Coordinator for %s has no data after refresh - falling back to API",
                    username,
                )

            # Fallback to direct API call
            _LOGGER.debug("Using direct API call for %s daily plan", username)
            result = await api.get_daily_plan(
                username=username,
                select_recommended=select_recommended,
                fair_weather=fair_weather,
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
    Create a service handler for getting daily plan encouragement.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that gets daily plan encouragement.

    The returned handler expects the following service data:
        - username (str, optional): The username to get encouragement for. If not provided,
          will be inferred from the service call context.
        - force_refresh (bool, optional): Whether to bypass the cache.

    The handler will:
        - Get encouragement messages via the API (with caching)
        - Use cache-only approach (no background refresh) to avoid LLM API costs
        - Support force_refresh parameter to bypass cache when needed
        - Log the operation result
        - Return the API response

    """

    async def get_daily_plan_encouragement_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get encouragement messages for a user's daily plan.

        Uses cache-only approach (no background refresh) to avoid
        unnecessary LLM API calls when users aren't viewing the dashboard.

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

            # Check for force_refresh parameter
            force_refresh = call.data.get("force_refresh", False)

            # Use cache helper with long TTL
            cache_key = f"encouragement:{username}"

            async def fetch_encouragement() -> dict[str, Any]:
                _LOGGER.info(
                    "Fetching new encouragement for %s (LLM API call)", username
                )
                return await api.get_daily_plan_encouragement(username=username)

            result = await get_cached_or_fetch(
                hass,
                cache_key,
                CACHE_TTL_ENCOURAGEMENT,
                fetch_encouragement,
                force_refresh=force_refresh,
            )

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
    Create a service handler for getting daily state.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that gets daily state.

    The returned handler expects the following service data:
        - username (str, optional): The username to get state for. If not provided,
          will be inferred from the service call context.

    The handler will:
        - Get daily state information via the API (with caching)
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

            # Use cache helper
            cache_key = f"daily_state:{username}"

            async def fetch_daily_state() -> dict[str, Any]:
                return await api.get_daily_state(username)

            result = await get_cached_or_fetch(
                hass,
                cache_key,
                CACHE_TTL_DAILY_STATE,
                fetch_daily_state,
            )

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
    Create a service handler for setting daily state.

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
        - daily_state (dict): The daily state data to set.

    The handler will:
        - Set daily state information via the API
        - Invalidate cache for the user
        - Fire a 'tasktracker_daily_state_updated' event on success
        - Log the operation result
        - Return the API response

    Raises:
        TaskTrackerAPIError: If no username can be determined from context.

    """

    async def set_daily_state_service(call: ServiceCall) -> dict[str, Any]:
        """
        Set daily state information for a user.

        Args:
            call: The Home Assistant service call containing user information and state data.

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
                # Invalidate cache for user
                await invalidate_user_cache(hass, username)

                hass.bus.fire(
                    "tasktracker_daily_state_set",
                    {
                        "username": username,
                        "state_data": result.get("data"),
                    },
                )
            _LOGGER.debug("Daily state set: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to set daily state")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in set_daily_state_service")
            raise

    return set_daily_state_service
