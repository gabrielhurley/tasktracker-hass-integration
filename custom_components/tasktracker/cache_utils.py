"""Utility functions for cache and coordinator management."""

from __future__ import annotations

import logging
from typing import TYPE_CHECKING, Any

if TYPE_CHECKING:
    from collections.abc import Awaitable, Callable

    from homeassistant.core import HomeAssistant

from .const import DOMAIN

_LOGGER = logging.getLogger(__name__)


def get_entry_data(hass: HomeAssistant) -> dict[str, Any]:
    """
    Get the first TaskTracker entry data.

    Returns:
        Dictionary with entry data including api, cache, coordinators

    """
    for entry_data in hass.data.get(DOMAIN, {}).values():
        if isinstance(entry_data, dict) and "api" in entry_data:
            return entry_data
    return {}


async def invalidate_user_cache(hass: HomeAssistant, username: str) -> None:
    """
    Invalidate cache and request coordinator refresh for a user.

    This should be called after any mutation operation (complete task,
    create task, update task, etc.) to ensure data stays fresh.

    Args:
        hass: Home Assistant instance
        username: Username whose cache should be invalidated

    """
    entry_data = get_entry_data(hass)

    # Invalidate cache entries for this user
    cache = entry_data.get("cache")
    if cache:
        # Invalidate user-specific cache entries (matches keys like "recommended_tasks:username:...")
        await cache.invalidate(pattern=f":{username}")
        _LOGGER.debug("Invalidated user-specific cache for: %s", username)

        # Also invalidate shared/global caches that might include this user's data
        await cache.invalidate(pattern="available_tasks:")
        await cache.invalidate(pattern="all_tasks:")
        await cache.invalidate(pattern="recent_completions:")
        await cache.invalidate(pattern="leftovers:")
        _LOGGER.debug("Invalidated shared cache entries for user mutation")

    # Clear coordinator data and refresh (daily plan)
    coordinators = entry_data.get("coordinators", {})
    if username in coordinators:
        daily_plan_coord = coordinators[username].get("daily_plan")
        if daily_plan_coord:
            # Clear the coordinator's cached data so next call fetches fresh
            daily_plan_coord.data = None
            # Await refresh so fresh data is available before events fire
            try:
                await daily_plan_coord.async_refresh()
                _LOGGER.debug("Refreshed daily plan coordinator for: %s", username)
            except (TimeoutError, OSError) as err:
                _LOGGER.warning(
                    "Failed to refresh coordinator for %s: %s", username, err
                )


async def invalidate_all_user_caches(hass: HomeAssistant) -> None:
    """
    Aggressively invalidate caches for ALL configured users.

    This is the simple, reliable approach for task mutations where determining
    all affected users is complex. Better to invalidate too much than serve stale data.

    Invalidates:
    - All per-user caches
    - All shared/global caches
    - All coordinator data (triggers background refresh)

    Args:
        hass: Home Assistant instance

    """
    entry_data = get_entry_data(hass)
    cache = entry_data.get("cache")
    coordinators = entry_data.get("coordinators", {})

    if not cache:
        _LOGGER.warning("Cache not available for invalidation")
        return

    # Invalidate all task-related caches (use prefix patterns to match all variants)
    await cache.invalidate(pattern="recommended_tasks:")
    await cache.invalidate(pattern="available_tasks:")
    await cache.invalidate(pattern="all_tasks:")
    await cache.invalidate(pattern="recent_completions:")
    await cache.invalidate(pattern="leftovers:")
    await cache.invalidate(pattern="encouragement:")
    await cache.invalidate(pattern="available_users")
    _LOGGER.debug("Invalidated all shared caches")

    # Invalidate per-user caches and coordinators for ALL configured users
    for username in coordinators:
        # Invalidate user-specific cache entries
        await cache.invalidate(pattern=f":{username}")

        # Clear and refresh coordinator
        daily_plan_coord = coordinators[username].get("daily_plan")
        if daily_plan_coord:
            daily_plan_coord.data = None
            # Await refresh so fresh data is available before events fire
            try:
                await daily_plan_coord.async_refresh()
            except (TimeoutError, OSError) as err:
                _LOGGER.warning(
                    "Failed to refresh coordinator for %s: %s", username, err
                )
                # Continue with other users even if one fails

    user_count = len(coordinators)
    _LOGGER.info(
        "Invalidated caches and refreshed coordinators for all %d users", user_count
    )


async def get_cached_or_fetch(
    hass: HomeAssistant,
    cache_key: str,
    ttl: int,
    fetch_fn: Callable[[], Awaitable[dict[str, Any]]],
    *,
    force_refresh: bool = False,
) -> Any:
    """
    Get data from cache or fetch from API if not cached.

    Args:
        hass: Home Assistant instance
        cache_key: Key to use for caching
        ttl: Time to live in seconds
        fetch_fn: Async function to call if cache miss
        force_refresh: If True, bypass cache and fetch fresh data

    Returns:
        Cached or freshly fetched data

    """
    entry_data = get_entry_data(hass)
    cache = entry_data.get("cache")

    # Check cache first (unless force refresh)
    if cache and not force_refresh:
        cached = await cache.get(cache_key, ttl=ttl)
        if cached:
            _LOGGER.debug("Cache hit for: %s", cache_key)
            return cached

    # Fetch fresh data
    _LOGGER.debug("Cache miss for: %s, fetching fresh data", cache_key)
    result = await fetch_fn()

    # Store in cache if successful
    if cache and result and result.get("success"):
        await cache.set(cache_key, result)

    return result
