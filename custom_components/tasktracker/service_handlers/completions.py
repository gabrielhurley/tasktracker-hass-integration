"""Service handlers for completion records editing."""

from __future__ import annotations

import logging
from typing import Callable, Awaitable

from homeassistant.core import ServiceCall

from ..api import TaskTrackerAPI, TaskTrackerAPIError

_LOGGER = logging.getLogger(__name__)


def delete_completion_handler_factory(
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:  # type: ignore[name-defined]
    async def delete_completion_service(call: ServiceCall) -> dict[str, Any]:
        try:
            result = await api.delete_completion(
                completion_id=call.data["completion_id"],
            )
            if result.get("success"):
                hass = call.hass
                hass.bus.fire(
                    "tasktracker_completion_deleted",
                    {
                        "completion_id": call.data["completion_id"],
                        "deletion_data": result.get("data"),
                    },
                )
            _LOGGER.info("Completion deleted successfully: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to delete completion")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in delete_completion_service")
            raise

    return delete_completion_service


def update_completion_handler_factory(
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:  # type: ignore[name-defined]
    async def update_completion_service(call: ServiceCall) -> dict[str, Any]:
        try:
            result = await api.update_completion(
                completion_id=call.data["completion_id"],
                completed_by=call.data.get("completed_by"),
                notes=call.data.get("notes"),
                completed_at=call.data.get("completed_at"),
            )
            if result.get("success"):
                hass = call.hass
                hass.bus.fire(
                    "tasktracker_completion_updated",
                    {
                        "completion_id": call.data["completion_id"],
                        "updates": {
                            k: v
                            for k, v in call.data.items()
                            if k != "completion_id" and v is not None
                        },
                        "update_data": result.get("data"),
                    },
                )
            _LOGGER.info("Completion updated successfully: %s", result)
            return result
        except TaskTrackerAPIError:
            _LOGGER.exception("Failed to update completion")
            raise
        except Exception:
            _LOGGER.exception("Unexpected error in update_completion_service")
            raise

    return update_completion_service
