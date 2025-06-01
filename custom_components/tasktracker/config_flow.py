"""Config flow for TaskTracker integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

import homeassistant.helpers.config_validation as cv
import voluptuous as vol
from homeassistant import config_entries
from homeassistant.const import CONF_API_KEY, CONF_HOST
from homeassistant.core import callback
from homeassistant.helpers.aiohttp_client import async_get_clientsession

from .api import TaskTrackerAPI
from .const import (
    CONF_HA_USER_ID,
    CONF_TASKTRACKER_USERNAME,
    CONF_USERS,
    DOMAIN,
)

if TYPE_CHECKING:
    from homeassistant.config_entries import ConfigFlowResult

_LOGGER = logging.getLogger(__name__)


class TaskTrackerConfigFlow(config_entries.ConfigFlow, domain=DOMAIN):
    """Handle a config flow for TaskTracker."""

    VERSION = 1

    def __init__(self) -> None:
        """Initialize the config flow."""
        self._api_data: dict[str, Any] = {}
        self._users: list[dict[str, str]] = []

    async def async_step_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Handle the initial step."""
        errors: dict[str, str] = {}

        if user_input is not None:
            # Validate API connection
            session = async_get_clientsession(self.hass)
            api = TaskTrackerAPI(
                session=session,
                host=user_input[CONF_HOST],
                api_key=user_input[CONF_API_KEY],
            )

            try:
                # Test API connection by getting tasks
                await api.get_all_tasks(thin=True)
                self._api_data = user_input
                return await self.async_step_users()
            except Exception:
                _LOGGER.exception("Could not connect to TaskTracker API")
                errors["base"] = "cannot_connect"

        data_schema = vol.Schema(
            {
                vol.Required(CONF_HOST): cv.string,
                vol.Required(CONF_API_KEY): cv.string,
            }
        )

        return self.async_show_form(
            step_id="user",
            data_schema=data_schema,
            errors=errors,
        )

    async def async_step_users(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Configure user mappings."""
        errors: dict[str, str] = {}

        if user_input is not None:
            # Add user mapping
            if user_input.get(CONF_HA_USER_ID) and user_input.get(
                CONF_TASKTRACKER_USERNAME
            ):
                self._users.append(
                    {
                        CONF_HA_USER_ID: user_input[CONF_HA_USER_ID],
                        CONF_TASKTRACKER_USERNAME: user_input[
                            CONF_TASKTRACKER_USERNAME
                        ],
                    }
                )

            # Check if user wants to add more or finish
            if user_input.get("add_another_user", False):
                return await self.async_step_users()
            else:  # noqa: RET505
                # Create the entry
                return self.async_create_entry(
                    title="TaskTracker",
                    data={
                        **self._api_data,
                        CONF_USERS: self._users,
                    },
                )

        # Get HA users for dropdown
        ha_users_data = await self.hass.auth.async_get_users()
        ha_users = [
            {"id": user.id, "name": user.name}
            for user in ha_users_data
            if user.is_active
        ]

        user_options = [f"{user['name']} ({user['id']})" for user in ha_users]
        user_options.append("Manual Entry")

        data_schema = vol.Schema(
            {
                vol.Required("ha_user_selection"): vol.In(user_options),
                vol.Optional(CONF_HA_USER_ID): cv.string,
                vol.Required(CONF_TASKTRACKER_USERNAME): cv.string,
                vol.Optional("add_another_user", default=False): cv.boolean,
            }
        )

        return self.async_show_form(
            step_id="users",
            data_schema=data_schema,
            errors=errors,
            description_placeholders={
                "configured_users": "\n".join(
                    [
                        f"- {user[CONF_TASKTRACKER_USERNAME]} (HA ID: {user[CONF_HA_USER_ID]})"  # noqa: E501
                        for user in self._users
                    ]
                )
                if self._users
                else "None configured yet"
            },
        )

    @staticmethod
    @callback
    def async_get_options_flow(
        config_entry: config_entries.ConfigEntry,  # noqa: ARG004
    ) -> TaskTrackerOptionsFlow:
        """Create the options flow."""
        return TaskTrackerOptionsFlow()


class TaskTrackerOptionsFlow(config_entries.OptionsFlow):
    """Handle options flow for TaskTracker."""

    def __init__(self) -> None:
        """Initialize the options flow."""
        self._updated_users: list[dict[str, str]] = []

    async def async_step_init(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage the options."""
        # Initialize updated_users on first init step call
        if not hasattr(self, "_updated_users") or self._updated_users is None:
            self._updated_users = list(self.config_entry.data.get(CONF_USERS, []))

        # Constant for redacted API key display
        REDACTED_API_KEY = "••••••••••••••••"  # noqa: N806

        if user_input is not None:
            action = user_input.get("action")
            if action == "manage_users":
                # Ensure _updated_users is initialized with current users
                self._updated_users = list(self.config_entry.data.get(CONF_USERS, []))
                return await self.async_step_manage_users()
            elif action == "save_basic":  # noqa: RET505
                # Update only basic settings, preserve existing users
                api_key = user_input[CONF_API_KEY]
                # If API key is the redacted placeholder, keep the original
                if api_key == REDACTED_API_KEY:
                    api_key = self.config_entry.data.get(CONF_API_KEY, "")

                new_data = {
                    CONF_HOST: user_input[CONF_HOST],
                    CONF_API_KEY: api_key,
                    CONF_USERS: self.config_entry.data.get(CONF_USERS, []),
                }
                # Update the config entry with new data
                self.hass.config_entries.async_update_entry(
                    self.config_entry, data=new_data
                )
                # Also update the stored config in hass.data if it exists
                if (
                    DOMAIN in self.hass.data
                    and self.config_entry.entry_id in self.hass.data[DOMAIN]
                ):
                    self.hass.data[DOMAIN][self.config_entry.entry_id]["config"] = (
                        new_data
                    )

                return self.async_create_entry(title="", data={})

        current_users = self.config_entry.data.get(CONF_USERS, [])
        users_summary = (
            "\n".join(
                [
                    f"• {user[CONF_TASKTRACKER_USERNAME]} ← {user[CONF_HA_USER_ID]}"
                    for user in current_users
                ]
            )
            if current_users
            else "None configured"
        )

        # Show redacted API key if one exists, empty string if none
        current_api_key = self.config_entry.data.get(CONF_API_KEY, "")
        api_key_display = REDACTED_API_KEY if current_api_key else ""

        data_schema = vol.Schema(
            {
                vol.Required(
                    CONF_HOST,
                    default=self.config_entry.data.get(CONF_HOST, ""),
                ): cv.string,
                vol.Required(
                    CONF_API_KEY,
                    default=api_key_display,
                ): cv.string,
                vol.Required("action", default="save_basic"): vol.In(
                    {
                        "save_basic": "Save API Settings Only",
                        "manage_users": "Manage User Mappings",
                    }
                ),
            }
        )

        return self.async_show_form(
            step_id="init",
            data_schema=data_schema,
            description_placeholders={
                "current_users": users_summary,
            },
        )

    async def async_step_manage_users(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Manage user mappings."""
        # Initialize with current users if not already done
        if not hasattr(self, "_updated_users") or self._updated_users is None:
            self._updated_users = list(self.config_entry.data.get(CONF_USERS, []))

        if user_input is not None:
            action = user_input.get("action")

            if action == "add_user":
                return await self.async_step_add_user()
            elif action == "remove_user":  # noqa: RET505
                return await self.async_step_remove_user()
            elif action == "save":
                # Save all changes to the config entry data
                new_data = {
                    **self.config_entry.data,
                    CONF_USERS: self._updated_users,
                }
                # Update the config entry with new data
                self.hass.config_entries.async_update_entry(
                    self.config_entry, data=new_data
                )
                # Also update the stored config in hass.data if it exists
                if (
                    DOMAIN in self.hass.data
                    and self.config_entry.entry_id in self.hass.data[DOMAIN]
                ):
                    self.hass.data[DOMAIN][self.config_entry.entry_id]["config"] = (
                        new_data
                    )

                return self.async_create_entry(title="", data={})
            elif action == "cancel":
                return await self.async_step_init()

        users_summary = (
            "\n".join(
                [
                    f"• {user[CONF_TASKTRACKER_USERNAME]} ← {user[CONF_HA_USER_ID]}"
                    for user in self._updated_users
                ]
            )
            if self._updated_users
            else "None configured"
        )

        # Build action options conditionally
        action_options = {
            "add_user": "Add User Mapping",
            "save": "Save Changes",
            "cancel": "Cancel",
        }

        # Only add remove option if there are users to remove
        if self._updated_users:
            action_options["remove_user"] = "Remove User Mapping"

        from homeassistant.helpers import selector

        data_schema = vol.Schema(
            {
                vol.Optional(
                    "current_mappings", default=users_summary
                ): selector.TextSelector(
                    selector.TextSelectorConfig(
                        multiline=True, type=selector.TextSelectorType.TEXT
                    )
                ),
                vol.Required("action"): vol.In(action_options),
            }
        )

        return self.async_show_form(
            step_id="manage_users",
            data_schema=data_schema,
        )

    async def async_step_add_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Add a new user mapping."""
        errors: dict[str, str] = {}

        if user_input is not None:
            ha_user_id = user_input.get(CONF_HA_USER_ID)
            tasktracker_username = user_input.get(CONF_TASKTRACKER_USERNAME)

            if ha_user_id and tasktracker_username:
                # Check for duplicates
                for existing_user in self._updated_users:
                    if existing_user.get(CONF_HA_USER_ID) == ha_user_id:
                        errors["base"] = "ha_user_already_mapped"
                        break
                    if (
                        existing_user.get(CONF_TASKTRACKER_USERNAME)
                        == tasktracker_username
                    ):
                        errors["base"] = "tasktracker_user_already_mapped"
                        break

                if not errors:
                    self._updated_users.append(
                        {
                            CONF_HA_USER_ID: ha_user_id,
                            CONF_TASKTRACKER_USERNAME: tasktracker_username,
                        }
                    )
                    return await self.async_step_manage_users()
                # If there are errors, we'll fall through to show the form again

        # Get HA users for dropdown
        ha_users_data = await self.hass.auth.async_get_users()
        ha_users = [
            {"id": user.id, "name": user.name}
            for user in ha_users_data
            if user.is_active
        ]

        # Filter out already mapped users
        mapped_ha_users = {user.get(CONF_HA_USER_ID) for user in self._updated_users}
        available_users = [
            user for user in ha_users if user["id"] not in mapped_ha_users
        ]

        if not available_users:
            # All users are mapped, go back
            return await self.async_step_manage_users()

        user_options = {
            user["id"]: f"{user['name']} ({user['id']})" for user in available_users
        }

        data_schema = vol.Schema(
            {
                vol.Required(CONF_HA_USER_ID): vol.In(user_options),
                vol.Required(CONF_TASKTRACKER_USERNAME): cv.string,
            }
        )

        return self.async_show_form(
            step_id="add_user",
            data_schema=data_schema,
            errors=errors,
        )

    async def async_step_remove_user(
        self, user_input: dict[str, Any] | None = None
    ) -> ConfigFlowResult:
        """Remove a user mapping."""
        if user_input is not None:
            user_to_remove = user_input.get("user_to_remove")
            if user_to_remove:
                # Find and remove the user
                self._updated_users = [
                    user
                    for user in self._updated_users
                    if f"{user[CONF_TASKTRACKER_USERNAME]}|{user[CONF_HA_USER_ID]}"
                    != user_to_remove
                ]
            return await self.async_step_manage_users()

        if not self._updated_users:
            return await self.async_step_manage_users()

        user_options = {}
        for user in self._updated_users:
            key = f"{user[CONF_TASKTRACKER_USERNAME]}|{user[CONF_HA_USER_ID]}"
            user_options[key] = (
                f"{user[CONF_TASKTRACKER_USERNAME]} ← {user[CONF_HA_USER_ID]}"
            )

        data_schema = vol.Schema(
            {
                vol.Required("user_to_remove"): vol.In(user_options),
            }
        )

        return self.async_show_form(
            step_id="remove_user",
            data_schema=data_schema,
        )
