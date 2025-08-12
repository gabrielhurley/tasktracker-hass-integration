"""Service handlers related to leftovers management."""

from __future__ import annotations

import logging
from typing import Any, Callable, Awaitable

from homeassistant.core import HomeAssistant, ServiceCall

from ..api import TaskTrackerAPI, TaskTrackerAPIError

_LOGGER = logging.getLogger(__name__)


def create_leftover_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
    get_current_config: Callable[[], dict[str, Any]],
    user_lookup_fn: Callable[[HomeAssistant, str | None, dict[str, Any]], str | None],
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def create_leftover_service(call: ServiceCall) -> dict[str, Any]:
        try:
            result = await api.create_leftover(
                name=call.data["name"],
                assigned_to=call.data.get("assigned_to"),
                shelf_life_days=call.data.get("shelf_life_days"),
                days_ago=call.data.get("days_ago"),
            )
            if result.get("success"):
                hass.bus.fire(
                    "tasktracker_leftover_created",
                    {
                        "leftover_name": call.data["name"],
                        "assigned_to": call.data.get("assigned_to"),
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
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:
    async def list_leftovers_service(call: ServiceCall) -> dict[str, Any]:
        try:
            result = await api.list_leftovers(
                assigned_to=call.data.get("assigned_to"),
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
