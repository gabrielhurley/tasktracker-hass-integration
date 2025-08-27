"""Utility functions for the TaskTracker integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from .const import (
    CONF_HA_USER_ID,
    CONF_TASKTRACKER_USERNAME,
    CONF_USERS,
    DOMAIN,
)

if TYPE_CHECKING:
    from homeassistant.core import HomeAssistant

_LOGGER = logging.getLogger(__name__)


def get_user_context(hass: HomeAssistant, ha_user_id: str) -> str | None:
    """
    Get TaskTracker username for a Home Assistant user ID.

    Args:
        hass: Home Assistant instance
        ha_user_id: Home Assistant user ID

    Returns:
        TaskTracker username if found, None otherwise

    """
    if not ha_user_id:
        return None

    # Get all integration data
    domain_data = hass.data.get(DOMAIN, {})

    # Search through all config entries
    for entry_data in domain_data.values():
        config = entry_data.get("config", {})
        users = config.get(CONF_USERS, [])

        for user in users:
            if user.get(CONF_HA_USER_ID) == ha_user_id:
                return user.get(CONF_TASKTRACKER_USERNAME)

    return None


def format_task_duration(minutes: int) -> str:
    """
    Format task duration in a human-readable way.

    Args:
        minutes: Duration in minutes

    Returns:
        Formatted duration string

    """
    if minutes == 0:
        return "0 min"
    elif minutes == 1:  # noqa: RET505
        return "1 min"
    elif minutes < 60:  # noqa: PLR2004
        return f"{minutes} min"

    hours = minutes // 60
    remaining_minutes = minutes % 60

    if remaining_minutes == 0:
        return f"{hours} hr"

    return f"{hours} hr {remaining_minutes} min"


def format_time_ago(minutes: int) -> str:
    """
    Format time ago in a human-readable way.

    Args:
        minutes: Time in minutes ago

    Returns:
        Formatted time string

    """
    if minutes < 60:  # noqa: PLR2004
        if minutes == 1:
            return "1 minute ago"
        return f"{minutes} minutes ago"
    elif minutes < 1440:  # Less than 24 hours  # noqa: PLR2004, RET505
        hours = minutes // 60
        if hours == 1:
            return "1 hour ago"
        return f"{hours} hours ago"
    else:  # Days
        days = minutes // 1440
        if days == 1:
            return "1 day ago"
        return f"{days} days ago"


def validate_api_response(response: dict[str, Any] | None) -> bool:
    """
    Validate API response structure.

    Args:
        response: API response dictionary

    Returns:
        True if valid, False otherwise

    """
    if not response or not isinstance(response, dict):
        return False

    success = response.get("success")
    return success is True


def get_tasktracker_username_for_ha_user(
    hass: HomeAssistant,
    ha_user_id: str | None,
    config: dict[str, Any],
) -> str | None:
    """
    Get the TaskTracker username for a Home Assistant user ID.

    Args:
        hass: Home Assistant instance
        ha_user_id: Home Assistant user ID (from call context)
        config: Integration configuration containing user mappings

    Returns:
        TaskTracker username if found, None otherwise

    """
    if not ha_user_id:
        _LOGGER.debug("No HA user ID provided")
        return None

    users = config.get(CONF_USERS, [])
    _LOGGER.debug(
        "Looking for HA user ID '%s' in user mappings: %s",
        ha_user_id,
        users,
    )

    for user in users:
        user_ha_id = user.get(CONF_HA_USER_ID)
        user_tasktracker = user.get(CONF_TASKTRACKER_USERNAME)
        _LOGGER.debug(
            "Comparing HA user ID '%s' with mapping HA ID '%s' -> TaskTracker '%s'",
            ha_user_id,
            user_ha_id,
            user_tasktracker,
        )
        if user_ha_id == ha_user_id:
            username = user_tasktracker
            _LOGGER.debug(
                "Found TaskTracker username '%s' for HA user ID '%s'",
                username,
                ha_user_id,
            )
            return username

    _LOGGER.warning("No TaskTracker username found for HA user ID '%s'", ha_user_id)
    _LOGGER.warning("Available user mappings: %s", users)

    # Check if any mapping has the ha_user_id as a display name instead
    for user in users:
        if user.get(CONF_HA_USER_ID, "").lower() == ha_user_id.lower():
            _LOGGER.error(
                "Found potential misconfiguration: User mapping has '%s' as user ID, "
                "but this looks like a display name. Please reconfigure the user "
                "mapping in the integration options to use the proper user ID.",
                user.get(CONF_HA_USER_ID),
            )
            break

    return None


def get_ha_user_for_tasktracker_username(
    hass: HomeAssistant,
    tasktracker_username: str,
    config: dict[str, Any],
) -> str | None:
    """
    Get the Home Assistant user ID for a TaskTracker username.

    Args:
        hass: Home Assistant instance
        tasktracker_username: TaskTracker username
        config: Integration configuration containing user mappings

    Returns:
        Home Assistant user ID if found, None otherwise

    """
    users = config.get(CONF_USERS, [])

    for user in users:
        if user.get(CONF_TASKTRACKER_USERNAME) == tasktracker_username:
            ha_user_id = user.get(CONF_HA_USER_ID)
            _LOGGER.debug(
                "Found HA user ID '%s' for TaskTracker username '%s'",
                ha_user_id,
                tasktracker_username,
            )
            return ha_user_id

    _LOGGER.warning(
        "No HA user ID found for TaskTracker username '%s'", tasktracker_username
    )
    return None


def get_current_user_context(
    hass: HomeAssistant,
    config: dict[str, Any],
) -> dict[str, str | None]:
    """
    Get the current user context from Home Assistant.

    This is a placeholder for future implementation that might detect
    the current user from various HA context sources.

    Args:
        hass: Home Assistant instance
        config: Integration configuration

    Returns:
        Dictionary with user context information

    """
    # TODO(<gabrielhurley>):  # noqa: FIX002, TD003
    # Implement user detection from HA context
    # This might involve checking:
    # - Current dashboard user
    # - Last interacting user
    # - Device-specific user assignment
    # For now, return empty context

    return {
        "ha_user_id": None,
        "tasktracker_username": None,
    }


def format_task_priority(priority: int) -> str:
    """
    Format task priority in a human-readable way.

    Args:
        priority: Priority number (1=high, 2=medium, 3=low)

    Returns:
        Priority string

    """
    priority_map = {
        1: "High",
        2: "Medium",
        3: "Low",
        4: "Very Low",
        5: "Minimal",
    }
    return priority_map.get(priority, f"Priority {priority}")


def get_integration_data(hass: HomeAssistant, entry_id: str) -> dict[str, Any] | None:
    """
    Get integration data for a specific config entry.

    Args:
        hass: Home Assistant instance
        entry_id: Config entry ID

    Returns:
        Integration data dictionary or None if not found

    """
    return hass.data.get(DOMAIN, {}).get(entry_id)


def get_available_tasktracker_usernames(config: dict[str, Any]) -> list[str]:
    """
    Get list of available TaskTracker usernames from configuration.

    Args:
        config: Integration configuration containing user mappings

    Returns:
        List of TaskTracker usernames

    """
    _LOGGER.debug("Getting available TaskTracker usernames from configuration")
    _LOGGER.debug("Config: %s", config)
    users = config.get(CONF_USERS, [])
    usernames = []

    for user in users:
        username = user.get(CONF_TASKTRACKER_USERNAME)
        if username and username not in usernames:
            usernames.append(username)

    return sorted(usernames)


async def validate_user_configuration(
    hass: HomeAssistant,
    config: dict[str, Any],
) -> tuple[bool, list[str]]:
    """
    Validate user configuration and identify potential issues.

    Args:
        hass: Home Assistant instance
        config: Integration configuration containing user mappings

    Returns:
        Tuple of (is_valid, list_of_issues)

    """
    issues = []
    users = config.get(CONF_USERS, [])

    if not users:
        return True, []  # No users configured is valid

    # Get all Home Assistant users to validate against
    try:
        ha_users = await hass.auth.async_get_users()
        ha_user_ids = {user.id for user in ha_users if user.is_active}
        ha_user_names = {
            user.name.lower() for user in ha_users if user.is_active and user.name
        }
    except Exception:  # noqa: BLE001
        # If we can't get HA users, we can't validate
        return True, []

    for i, user in enumerate(users):
        ha_user_id = user.get(CONF_HA_USER_ID)
        tasktracker_username = user.get(CONF_TASKTRACKER_USERNAME)

        if not ha_user_id:
            issues.append(f"User mapping {i + 1}: Missing Home Assistant user ID")
            continue

        if not tasktracker_username:
            issues.append(f"User mapping {i + 1}: Missing TaskTracker username")
            continue

        # Check if the ha_user_id looks like a display name instead of a user ID
        if ha_user_id not in ha_user_ids:
            if ha_user_id.lower() in ha_user_names:
                issues.append(
                    f"User mapping {i + 1}: '{ha_user_id}' appears to be a display name "
                    f"instead of a user ID. Please reconfigure this mapping using the "
                    f"integration options."
                )
            else:
                issues.append(
                    f"User mapping {i + 1}: Home Assistant user ID '{ha_user_id}' "
                    f"does not exist or user is inactive"
                )

    return len(issues) == 0, issues
