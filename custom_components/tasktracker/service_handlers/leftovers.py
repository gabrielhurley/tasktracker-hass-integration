"""Service handlers related to leftovers management."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from ..api import TaskTrackerAPI, TaskTrackerAPIError
from ..cache_utils import get_cached_or_fetch, invalidate_user_cache
from ..const import CACHE_TTL_LEFTOVERS

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from typing import Any

    from homeassistant.core import HomeAssistant, ServiceCall


_LOGGER = logging.getLogger(__name__)


def create_leftover_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a service handler for creating leftover items.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.
        get_current_config: Function to get the current configuration.
        user_lookup_fn: Function to look up usernames from Home Assistant user IDs.

    Returns:
        A service handler function that creates leftover items.

    The returned handler expects the following service data:
        - name (str): The name of the leftover item.
        - assigned_users (list[str], optional): The usernames assigned to the leftover. If not provided,
          will be inferred from the service call context.
        - shelf_life_days (int, optional): How many days the leftover is good for.
        - days_ago (int, optional): How many days ago the leftover was created.

    The handler will:
        - Create the leftover item via the API
        - Fire a 'tasktracker_leftover_created' event on success
        - Log the operation result
        - Return the API response

    """

    async def create_leftover_service(call: ServiceCall) -> dict[str, Any]:
        """
        Create a leftover item.

        Args:
            call: The Home Assistant service call containing leftover data.

        Returns:
            The API response from the leftover creation operation.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
        try:
            assigned_users = call.data.get("assigned_users")
            result = await api.create_leftover(
                name=call.data["name"],
                assigned_users=assigned_users,
                shelf_life_days=call.data.get("shelf_life_days"),
                days_ago=call.data.get("days_ago"),
            )
            if result.get("success"):
                # Invalidate cache for all assigned users
                if assigned_users:
                    for user in assigned_users:
                        await invalidate_user_cache(hass, user)

                hass.bus.fire(
                    "tasktracker_leftover_created",
                    {
                        "leftover_name": call.data["name"],
                        "assigned_users": assigned_users,
                        "shelf_life_days": call.data.get("shelf_life_days"),
                        "days_ago": call.data.get("days_ago"),
                        "creation_data": result.get("data"),
                    },
                )
            _LOGGER.info("Leftover created successfully: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to create leftover")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in create_leftover_service")
            raise

    return create_leftover_service


def list_leftovers_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a service handler for listing leftover items.

    Args:
        hass: The Home Assistant instance.
        api: The TaskTracker API client instance.

    Returns:
        A service handler function that lists leftover items.

    The returned handler expects the following service data:
        - username (str, optional): Filter leftovers by assigned user.

    The handler will:
        - Retrieve leftover items via the API
        - Log the operation result
        - Return the API response

    """

    async def list_leftovers_service(call: ServiceCall) -> dict[str, Any]:
        """
        List leftover items.

        Args:
            call: The Home Assistant service call containing filter parameters.

        Returns:
            The API response containing the list of leftover items.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
        try:
            username = call.data.get("username")

            # Use cache helper
            cache_key = f"leftovers:{username}"

            async def fetch_leftovers():
                return await api.list_leftovers(username=username)

            result = await get_cached_or_fetch(
                hass,
                cache_key,
                CACHE_TTL_LEFTOVERS,
                fetch_leftovers,
            )

            _LOGGER.debug("Leftovers retrieved: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to list leftovers")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in list_leftovers_service")
            raise

    return list_leftovers_service
