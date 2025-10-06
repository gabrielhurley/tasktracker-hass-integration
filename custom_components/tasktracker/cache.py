"""Caching infrastructure for TaskTracker integration."""

from __future__ import annotations

import asyncio
import logging
import time
from typing import Any

_LOGGER = logging.getLogger(__name__)


class TaskTrackerCache:
    """Simple TTL-based cache for API responses."""

    def __init__(self) -> None:
        """Initialize the cache."""
        self._data: dict[str, Any] = {}
        self._timestamps: dict[str, float] = {}
        self._lock = asyncio.Lock()

    async def get(self, key: str, ttl: int) -> Any | None:
        """
        Get a value from cache if not expired.

        Args:
            key: Cache key
            ttl: Time to live in seconds

        Returns:
            Cached value if found and not expired, None otherwise
        """
        async with self._lock:
            if key in self._data:
                age = time.time() - self._timestamps[key]
                if age < ttl:
                    _LOGGER.debug("Cache hit: %s (age: %.1fs)", key, age)
                    return self._data[key]
                else:
                    _LOGGER.debug("Cache expired: %s (age: %.1fs)", key, age)
                    # Clean up expired entry
                    del self._data[key]
                    del self._timestamps[key]
            return None

    async def set(self, key: str, value: Any) -> None:
        """
        Store a value in cache.

        Args:
            key: Cache key
            value: Value to cache
        """
        async with self._lock:
            self._data[key] = value
            self._timestamps[key] = time.time()
            _LOGGER.debug("Cached: %s", key)

    async def invalidate(self, pattern: str | None = None) -> None:
        """
        Invalidate cache entries matching pattern.

        Args:
            pattern: Pattern to match cache keys. If None, clears all cache.
        """
        async with self._lock:
            if pattern is None:
                count = len(self._data)
                self._data.clear()
                self._timestamps.clear()
                _LOGGER.debug("Cleared all cache entries (%d items)", count)
            else:
                keys_to_remove = [k for k in self._data if pattern in k]
                for key in keys_to_remove:
                    del self._data[key]
                    del self._timestamps[key]
                _LOGGER.debug(
                    "Invalidated %d cache entries matching pattern: %s",
                    len(keys_to_remove),
                    pattern,
                )

    async def get_stats(self) -> dict[str, Any]:
        """
        Get cache statistics.

        Returns:
            Dictionary with cache statistics
        """
        async with self._lock:
            now = time.time()
            ages = [now - ts for ts in self._timestamps.values()]
            return {
                "total_entries": len(self._data),
                "oldest_age": max(ages) if ages else 0,
                "newest_age": min(ages) if ages else 0,
                "average_age": sum(ages) / len(ages) if ages else 0,
            }
