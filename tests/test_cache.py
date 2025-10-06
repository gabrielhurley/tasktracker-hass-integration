"""Tests for TaskTracker cache functionality."""

import pytest
from custom_components.tasktracker.cache import TaskTrackerCache


@pytest.mark.asyncio
async def test_cache_get_set():
    """Test basic cache get and set operations."""
    cache = TaskTrackerCache()

    # Set a value
    await cache.set("test_key", {"data": "test_value"})

    # Get the value within TTL
    result = await cache.get("test_key", ttl=60)
    assert result is not None
    assert result["data"] == "test_value"


@pytest.mark.asyncio
async def test_cache_miss():
    """Test cache miss returns None."""
    cache = TaskTrackerCache()

    result = await cache.get("nonexistent_key", ttl=60)
    assert result is None


@pytest.mark.asyncio
async def test_cache_expiration(monkeypatch):
    """Test cache expiration after TTL."""
    import time
    cache = TaskTrackerCache()

    # Set a value
    await cache.set("test_key", {"data": "test_value"})

    # Mock time to simulate TTL expiration
    original_time = time.time
    await cache.set("test_key", {"data": "test_value"})

    # Artificially age the cache entry
    cache._timestamps["test_key"] = original_time() - 100

    # Attempt to get with shorter TTL
    result = await cache.get("test_key", ttl=50)
    assert result is None


@pytest.mark.asyncio
async def test_cache_invalidate_all():
    """Test invalidating all cache entries."""
    cache = TaskTrackerCache()

    # Set multiple values
    await cache.set("key1", {"data": "value1"})
    await cache.set("key2", {"data": "value2"})
    await cache.set("key3", {"data": "value3"})

    # Invalidate all
    await cache.invalidate()

    # Verify all are gone
    assert await cache.get("key1", ttl=60) is None
    assert await cache.get("key2", ttl=60) is None
    assert await cache.get("key3", ttl=60) is None


@pytest.mark.asyncio
async def test_cache_invalidate_pattern():
    """Test invalidating cache entries by pattern."""
    cache = TaskTrackerCache()

    # Set multiple values with different patterns
    await cache.set("user:alice:tasks", {"data": "alice_tasks"})
    await cache.set("user:alice:plan", {"data": "alice_plan"})
    await cache.set("user:bob:tasks", {"data": "bob_tasks"})
    await cache.set("user:bob:plan", {"data": "bob_plan"})

    # Invalidate only alice's entries
    await cache.invalidate(pattern=":alice")

    # Verify alice's entries are gone
    assert await cache.get("user:alice:tasks", ttl=60) is None
    assert await cache.get("user:alice:plan", ttl=60) is None

    # Verify bob's entries remain
    assert await cache.get("user:bob:tasks", ttl=60) is not None
    assert await cache.get("user:bob:plan", ttl=60) is not None


@pytest.mark.asyncio
async def test_cache_stats():
    """Test cache statistics."""
    cache = TaskTrackerCache()

    # Empty cache
    stats = await cache.get_stats()
    assert stats["total_entries"] == 0

    # Add some entries
    await cache.set("key1", {"data": "value1"})
    await cache.set("key2", {"data": "value2"})

    stats = await cache.get_stats()
    assert stats["total_entries"] == 2
    assert stats["oldest_age"] >= 0
    assert stats["newest_age"] >= 0
    assert stats["average_age"] >= 0


@pytest.mark.asyncio
async def test_cache_concurrent_access():
    """Test cache with concurrent access."""
    import asyncio

    cache = TaskTrackerCache()

    async def writer(key, value):
        await cache.set(key, value)

    async def reader(key, expected):
        result = await cache.get(key, ttl=60)
        # Result may be None if read before write
        if result is not None:
            assert result == expected

    # Write and read concurrently
    tasks = []
    for i in range(10):
        tasks.append(writer(f"key{i}", {"data": f"value{i}"}))
        tasks.append(reader(f"key{i}", {"data": f"value{i}"}))

    await asyncio.gather(*tasks)

    # Verify all entries exist after concurrent operations
    for i in range(10):
        result = await cache.get(f"key{i}", ttl=60)
        assert result is not None
        assert result["data"] == f"value{i}"
