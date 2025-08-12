"""Service handlers related to user information and mappings."""

from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

from homeassistant.core import HomeAssistant, ServiceCall

from ..const import CONF_HA_USER_ID, CONF_TASKTRACKER_USERNAME, CONF_USERS
from ..utils import get_available_tasktracker_usernames

_LOGGER = logging.getLogger(__name__)


def get_available_users_handler_factory(
    hass: HomeAssistant,
    get_current_config: Callable[[], dict[str, Any]],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def get_available_users_service(call: ServiceCall) -> dict[str, Any]:  # noqa: ARG001
        try:
            current_config = get_current_config()
            usernames = get_available_tasktracker_usernames(current_config)

            user_mappings = current_config.get(CONF_USERS, [])
            enhanced_users = []

            ha_users = await hass.auth.async_get_users()
            ha_user_map = {user.id: user.name for user in ha_users if user.is_active and user.name}

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
        except Exception:
            _LOGGER.exception("Unexpected error in get_available_users_service")
            raise

    return get_available_users_service
