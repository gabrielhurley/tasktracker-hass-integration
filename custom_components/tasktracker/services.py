"""TaskTracker services for Home Assistant integration."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

from homeassistant.core import SupportsResponse

from .const import (
    DOMAIN,
    SERVICE_COMPLETE_TASK,
    SERVICE_COMPLETE_TASK_BY_NAME,
    SERVICE_CREATE_ADHOC_TASK,
    SERVICE_CREATE_LEFTOVER,
    SERVICE_CREATE_TASK_FROM_DESCRIPTION,
    SERVICE_DELETE_COMPLETION,
    SERVICE_DELETE_TASK,
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
)
from .service_handlers.completions import (
    delete_completion_handler_factory,
    update_completion_handler_factory,
)
from .service_handlers.daily import (
    get_daily_plan_encouragement_handler_factory,
    get_daily_plan_handler_factory,
    get_daily_state_handler_factory,
    set_daily_state_handler_factory,
)
from .service_handlers.leftovers import (
    create_leftover_handler_factory,
    list_leftovers_handler_factory,
)
from .service_handlers.tasks import (
    complete_task_by_name_handler_factory,
    complete_task_handler_factory,
    create_adhoc_task_handler_factory,
    create_task_from_description_handler_factory,
    delete_task_handler_factory,
    get_all_tasks_handler_factory,
    get_available_tasks_handler_factory,
    get_recent_completions_handler_factory,
    get_recommended_tasks_handler_factory,
    query_task_handler_factory,
    update_task_handler_factory,
)
from .service_handlers.users import (
    get_available_users_handler_factory,
)

# Import schemas and handler factories (refactored into modules)
from .service_schemas import (
    COMPLETE_TASK_BY_NAME_SCHEMA,
    COMPLETE_TASK_SCHEMA,
    CREATE_ADHOC_TASK_SCHEMA,
    CREATE_LEFTOVER_SCHEMA,
    CREATE_TASK_FROM_DESCRIPTION_SCHEMA,
    DELETE_COMPLETION_SCHEMA,
    DELETE_TASK_SCHEMA,
    GET_ALL_TASKS_SCHEMA,
    GET_AVAILABLE_TASKS_SCHEMA,
    GET_DAILY_PLAN_ENCOURAGEMENT_SCHEMA,
    GET_DAILY_PLAN_SCHEMA,
    GET_DAILY_STATE_SCHEMA,
    GET_RECENT_COMPLETIONS_SCHEMA,
    GET_RECOMMENDED_TASKS_SCHEMA,
    LIST_LEFTOVERS_SCHEMA,
    QUERY_TASK_SCHEMA,
    SET_DAILY_STATE_SCHEMA,
    UPDATE_COMPLETION_SCHEMA,
    UPDATE_TASK_SCHEMA,
)
from .utils import (
    get_tasktracker_username_for_ha_user,
)

if TYPE_CHECKING:
    from typing import Any

    from homeassistant.core import HomeAssistant

    from .api import TaskTrackerAPI


_LOGGER = logging.getLogger(__name__)

# Service schemas were moved to service_schemas.py


async def async_setup_services(  # noqa: PLR0915
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
        complete_task_service = complete_task_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        complete_task_by_name_service = complete_task_by_name_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        create_leftover_service = create_leftover_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        create_adhoc_task_service = create_adhoc_task_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        query_task_service = query_task_handler_factory(api)
        get_recommended_tasks_service = get_recommended_tasks_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        get_available_tasks_service = get_available_tasks_handler_factory(hass, api)
        get_recent_completions_service = get_recent_completions_handler_factory(hass, api)
        list_leftovers_service = list_leftovers_handler_factory(hass, api)
        get_all_tasks_service = get_all_tasks_handler_factory(hass, api)
        get_available_users_service = get_available_users_handler_factory(
            hass, get_current_config
        )
        update_task_service = update_task_handler_factory(api)
        delete_completion_service = delete_completion_handler_factory(hass, api)
        update_completion_service = update_completion_handler_factory(hass, api)
        get_daily_plan_service = get_daily_plan_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        get_daily_plan_encouragement_service = (
            get_daily_plan_encouragement_handler_factory(
                hass, api, get_current_config, get_tasktracker_username_for_ha_user
            )
        )
        get_daily_state_service = get_daily_state_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        set_daily_state_service = set_daily_state_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        create_task_from_description_service = (
            create_task_from_description_handler_factory(
                hass, api, get_current_config, get_tasktracker_username_for_ha_user
            )
        )
        delete_task_service = delete_task_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        complete_task_service = complete_task_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        complete_task_by_name_service = complete_task_by_name_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        create_leftover_service = create_leftover_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        create_adhoc_task_service = create_adhoc_task_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        query_task_service = query_task_handler_factory(api)
        get_recommended_tasks_service = get_recommended_tasks_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        get_available_tasks_service = get_available_tasks_handler_factory(hass, api)
        list_leftovers_service = list_leftovers_handler_factory(hass, api)
        get_all_tasks_service = get_all_tasks_handler_factory(hass, api)
        update_task_service = update_task_handler_factory(api)
        delete_completion_service = delete_completion_handler_factory(hass, api)
        update_completion_service = update_completion_handler_factory(hass, api)
        get_daily_plan_service = get_daily_plan_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        get_daily_plan_encouragement_service = (
            get_daily_plan_encouragement_handler_factory(
                hass, api, get_current_config, get_tasktracker_username_for_ha_user
            )
        )
        get_daily_state_service = get_daily_state_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        set_daily_state_service = set_daily_state_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )
        create_task_from_description_service = (
            create_task_from_description_handler_factory(
                hass, api, get_current_config, get_tasktracker_username_for_ha_user
            )
        )
        delete_task_service = delete_task_handler_factory(
            hass, api, get_current_config, get_tasktracker_username_for_ha_user
        )

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
