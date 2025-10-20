"""Service handlers related to user information and mappings."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from ..cache_utils import get_cached_or_fetch
from ..const import (
    CACHE_TTL_AVAILABLE_USERS,
    CONF_HA_USER_ID,
    CONF_TASKTRACKER_USERNAME,
    CONF_USERS,
)
from ..utils import get_available_tasktracker_usernames

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from typing import Any

    from homeassistant.core import HomeAssistant, ServiceCall


_LOGGER = logging.getLogger(__name__)


def get_available_users_handler_factory(
    hass: HomeAssistant,
    get_current_config: Callable[[], dict[str, Any]],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    """
    Create a service handler for getting available users.

    Args:
        hass: The Home Assistant instance.
        get_current_config: Function to get the current configuration.

    Returns:
        A service handler function that gets available users.

    The returned handler expects no service data parameters.

    The handler will:
        - Get available TaskTracker usernames from configuration (with caching)
        - Enhance user data with Home Assistant user information
        - Create a spoken response listing available users
        - Log the operation result
        - Return enhanced user data including:
            - usernames: List of available TaskTracker usernames
            - enhanced_users: List of user objects with display names and HA user IDs

    """

    async def get_available_users_service(call: ServiceCall) -> dict[str, Any]:
        """
        Get available users with enhanced information.

        Args:
            call: The Home Assistant service call (unused).

        Returns:
            A dictionary containing:
                - success (bool): Always True
                - spoken_response (str): Human-readable list of available users
                - data (dict): Contains 'users' and 'enhanced_users' lists

        Raises:
            Exception: For any unexpected errors during user lookup.

        """
        try:
            # Use cache helper - config changes are rare
            cache_key = "available_users"

            async def fetch_available_users() -> dict[str, Any]:
                current_config = get_current_config()
                usernames = get_available_tasktracker_usernames(current_config)

                user_mappings = current_config.get(CONF_USERS, [])
                enhanced_users = []

                ha_users = await hass.auth.async_get_users()
                ha_user_map = {
                    user.id: user.name
                    for user in ha_users
                    if user.is_active and user.name
                }

                for username in usernames:
                    display_name = username
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

                return {
                    "success": True,
                    "spoken_response": f"Available users: {', '.join(usernames)}",
                    "data": {
                        "users": usernames,
                        "enhanced_users": enhanced_users,
                    },
                }

            return await get_cached_or_fetch(
                hass,
                cache_key,
                CACHE_TTL_AVAILABLE_USERS,
                fetch_available_users,
            )

        except Exception:
            _LOGGER.exception("Unexpected error in get_available_users_service")
            raise

    return get_available_users_service
