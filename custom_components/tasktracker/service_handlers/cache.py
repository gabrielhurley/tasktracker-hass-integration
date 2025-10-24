"""Service handler for cache management operations."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING

from ..cache_utils import invalidate_all_user_caches

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable
    from typing import Any

    from homeassistant.core import ServiceCall

_LOGGER = logging.getLogger(__name__)


def invalidate_cache_handler_factory() -> Callable[
    [ServiceCall], Awaitable[dict[str, Any]]
]:
    """
    Create a service handler for invalidating all caches.

    Returns:
        A service handler function that invalidates all user caches and coordinators.

    The handler will:
        - Invalidate all cached data for all users
        - Refresh all coordinators to fetch fresh data
        - Return success status

    This is useful when users want to force a refresh from the UI or when
    external changes need to be reflected immediately.

    """

    async def invalidate_cache_service(call: ServiceCall) -> dict[str, Any]:
        """
        Invalidate all caches and refresh coordinators.

        Args:
            call: The Home Assistant service call.

        Returns:
            Success response with details about cache invalidation.

        Raises:
            Exception: For any unexpected errors during cache invalidation.

        """
        try:
            hass = call.hass

            _LOGGER.info(
                "Cache invalidation service called - clearing all caches and refreshing coordinators"
            )

            # Invalidate all user caches and refresh coordinators
            await invalidate_all_user_caches(hass)

            _LOGGER.info(
                "Cache invalidation complete - all caches cleared, coordinators refreshed"
            )

            return {
                "success": True,
                "message": "All caches invalidated and coordinators refreshed",
            }
        except Exception:
            _LOGGER.exception("Unexpected error in invalidate_cache_service")
            raise

    return invalidate_cache_service
