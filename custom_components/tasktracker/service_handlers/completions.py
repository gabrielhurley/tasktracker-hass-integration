"""Service handlers for completion records editing."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from ..api import TaskTrackerAPI, TaskTrackerAPIError
from ..cache_utils import invalidate_all_user_caches

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from typing import Any

    from homeassistant.core import HomeAssistant, ServiceCall

_LOGGER = logging.getLogger(__name__)


def delete_completion_handler_factory(
    hass: HomeAssistant,
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:  # type: ignore[name-defined]
    """
    Create a service handler for deleting completion records.

    Args:
        hass: Home Assistant instance for cache invalidation and events
        api: The TaskTracker API client instance.

    Returns:
        A service handler function that deletes completion records.

    The returned handler expects the following service data:
        - completion_id (str): The ID of the completion record to delete.
        - task_type (str, optional): The type of task ('RecurringTask', 'SelfCareTask', 'AdHocTask', 'Leftover')

    The handler will:
        - Delete the completion record via the API
        - Fire a 'tasktracker_completion_deleted' event on success
        - Log the operation result
        - Return the API response

    """

    async def delete_completion_service(call: ServiceCall) -> dict[str, Any]:
        """
        Delete a completion record.

        Args:
            call: The Home Assistant service call containing the completion_id and optional task_type.

        Returns:
            The API response from the delete operation.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
        try:
            result = await api.delete_completion(
                completion_id=call.data["completion_id"],
                task_type=call.data.get("task_type"),
            )
            if result.get("success"):
                # Aggressively invalidate all user caches
                # Undo may affect multiple users
                await invalidate_all_user_caches(hass)

                call.hass.bus.fire(
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
    hass: HomeAssistant,
    api: TaskTrackerAPI,
) -> Callable[[ServiceCall], Awaitable[dict[str, Any]]]:  # type: ignore[name-defined]
    """
    Create a service handler for updating completion records.

    Args:
        hass: Home Assistant instance for cache invalidation and events
        api: The TaskTracker API client instance.

    Returns:
        A service handler function that updates completion records.

    The returned handler expects the following service data:
        - completion_id (str): The ID of the completion record to update.
        - completed_by (str, optional): The username who completed the task.
        - notes (str, optional): Notes about the completion.
        - completed_at (str, optional): ISO timestamp of when the task was completed.

    The handler will:
        - Update the completion record via the API
        - Fire a 'tasktracker_completion_updated' event on success
        - Log the operation result
        - Return the API response

    """

    async def update_completion_service(call: ServiceCall) -> dict[str, Any]:
        """
        Update a completion record.

        Args:
            call: The Home Assistant service call containing update data.

        Returns:
            The API response from the update operation.

        Raises:
            TaskTrackerAPIError: If the API call fails.
            Exception: For any other unexpected errors.

        """
        try:
            result = await api.update_completion(
                completion_id=call.data["completion_id"],
                completed_by=call.data.get("completed_by"),
                notes=call.data.get("notes"),
                completed_at=call.data.get("completed_at"),
            )
            if result.get("success"):
                # Aggressively invalidate all user caches
                # Update may affect multiple users
                await invalidate_all_user_caches(hass)

                call.hass.bus.fire(
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
