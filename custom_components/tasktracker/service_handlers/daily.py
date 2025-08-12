"""Service handlers for daily plan and daily state."""

from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

from homeassistant.core import HomeAssistant, ServiceCall

from ..api import TaskTrackerAPI, TaskTrackerAPIError
from ..const import EVENT_DAILY_PLAN, EVENT_DAILY_STATE_SET

_LOGGER = logging.getLogger(__name__)


def get_daily_plan_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def get_daily_plan_service(call: ServiceCall) -> dict[str, Any]:
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
    async def get_daily_plan_encouragement_service(call: ServiceCall) -> dict[str, Any]:
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
            _LOGGER.exception("Unexpected error in get_daily_plan_encouragement_service")
            raise

    return get_daily_plan_encouragement_service


def get_daily_state_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def get_daily_state_service(call: ServiceCall) -> dict[str, Any]:
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
    async def set_daily_state_service(call: ServiceCall) -> dict[str, Any]:
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
