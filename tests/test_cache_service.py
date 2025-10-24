"""Test cache invalidation service."""

import pytest
from unittest.mock import AsyncMock, MagicMock, patch
from homeassistant.core import HomeAssistant, ServiceCall

from custom_components.tasktracker.service_handlers.cache import (
    invalidate_cache_handler_factory,
)


@pytest.mark.asyncio
async def test_invalidate_cache_service_calls_invalidate_all_caches():
    """Test that the invalidate_cache service calls invalidate_all_user_caches."""
    # Create mock hass
    hass = MagicMock(spec=HomeAssistant)

    # Create service call
    call = MagicMock(spec=ServiceCall)
    call.hass = hass

    # Create the service handler
    service_handler = invalidate_cache_handler_factory()

    # Mock invalidate_all_user_caches
    with patch(
        'custom_components.tasktracker.service_handlers.cache.invalidate_all_user_caches',
        new_callable=AsyncMock
    ) as mock_invalidate:
        # Call the service
        result = await service_handler(call)

        # Assert invalidate_all_user_caches was called with hass
        mock_invalidate.assert_called_once_with(hass)

        # Assert success response
        assert result == {
            "success": True,
            "message": "All caches invalidated and coordinators refreshed",
        }


@pytest.mark.asyncio
async def test_cache_invalidate_patterns():
    """Test that cache invalidation uses correct patterns to match all cache keys."""
    from custom_components.tasktracker.cache import TaskTrackerCache

    # Create cache with various keys
    cache = TaskTrackerCache()

    # Add cache entries with different patterns
    await cache.set("recommended_tasks:gabriel:30", {"data": "task1"})
    await cache.set("recommended_tasks:sara:60", {"data": "task2"})
    await cache.set("available_tasks:gabriel:None:None", {"data": "task3"})
    await cache.set("available_tasks:sara:45:7", {"data": "task4"})
    await cache.set("leftovers:gabriel", {"data": "leftover1"})
    await cache.set("leftovers:sara", {"data": "leftover2"})
    await cache.set("recent_completions:gabriel:None:None", {"data": "completion1"})
    await cache.set("encouragement:gabriel", {"data": "encourage1"})
    await cache.set("available_users", {"data": "users"})

    # Verify all entries exist
    stats = await cache.get_stats()
    assert stats["total_entries"] == 9

    # Invalidate using prefix patterns (as our code does)
    await cache.invalidate(pattern="recommended_tasks:")
    await cache.invalidate(pattern="available_tasks:")
    await cache.invalidate(pattern="leftovers:")
    await cache.invalidate(pattern="recent_completions:")
    await cache.invalidate(pattern="encouragement:")
    await cache.invalidate(pattern="available_users")

    # Verify all entries are gone
    stats = await cache.get_stats()
    assert stats["total_entries"] == 0, f"Expected 0 entries, but found {stats['total_entries']}"


@pytest.mark.asyncio
async def test_cache_invalidate_user_specific():
    """Test that user-specific cache keys are matched correctly."""
    from custom_components.tasktracker.cache import TaskTrackerCache

    cache = TaskTrackerCache()

    # Add cache entries
    await cache.set("recommended_tasks:gabriel:30", {"data": "task1"})
    await cache.set("recommended_tasks:sara:60", {"data": "task2"})
    await cache.set("available_tasks:gabriel:None:None", {"data": "task3"})

    # Invalidate gabriel's entries using :username pattern
    await cache.invalidate(pattern=":gabriel")

    # Gabriel's entries should be gone
    assert await cache.get("recommended_tasks:gabriel:30", ttl=300) is None
    assert await cache.get("available_tasks:gabriel:None:None", ttl=300) is None

    # Sara's entries should still exist
    assert await cache.get("recommended_tasks:sara:60", ttl=300) is not None
