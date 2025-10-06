# TaskTracker Caching System

## Overview

The TaskTracker Home Assistant integration uses a hybrid caching approach combining in-memory TTL-based caching with Home Assistant's `DataUpdateCoordinator` pattern. This reduces API calls to the TaskTracker server while keeping data fresh across multiple users.

## Architecture

### Components

1. **TaskTrackerCache** (`cache.py`)
   - Simple in-memory cache with TTL (Time-To-Live)
   - Thread-safe using asyncio locks
   - Pattern-based invalidation for selective cache clearing
   - Used for pull-only data (encouragement messages) and supplementary endpoints

2. **DataUpdateCoordinator** (`coordinators.py`)
   - Home Assistant's standard pattern for background refresh
   - Automatic polling at configurable intervals
   - Built-in error handling and retry logic
   - Used for frequently-accessed data (daily plan)

3. **Cache Utilities** (`cache_utils.py`)
   - `get_cached_or_fetch()` - Retrieve from cache or fetch from API
   - `invalidate_user_cache()` - Clear cache for specific user
   - `invalidate_all_user_caches()` - Aggressively clear all caches (used on mutations)

## Design Decisions

### Hybrid Approach

**Why both cache and coordinator?**

- **Coordinator** for frequently-accessed data that changes often (daily plan)
  - Background refresh keeps data current without user action
  - Efficient debouncing prevents redundant API calls
  - Suitable for data displayed on multiple cards

- **Cache** for pull-only data that's expensive to generate (encouragement)
  - LLM-generated content costs money per request
  - Longer TTL (5 minutes) acceptable since content doesn't change without user action
  - `force_refresh` parameter allows manual refresh when needed

### Configuration

**Default Values** (`const.py`):
- Coordinator refresh: `180 seconds` (3 minutes)
- Cache TTL: `300 seconds` (5 minutes)
- Rationale: Data rarely changes without user activity, so longer intervals reduce server load

### Aggressive Cache Invalidation

**Design Choice**: Prioritize freshness over efficiency

When any task mutation occurs (complete, create, update, delete):
- **All user caches** are invalidated (not just the user who made the change)
- **All coordinators** refresh immediately (via `async_refresh()`)
- **All shared caches** are cleared (available tasks, all tasks, etc.)

**Rationale**:
- Multi-user task assignment makes it complex to determine all affected users
- Stale data is more problematic than a few extra API calls
- Coordinator debouncing prevents thundering herd issues
- Backend cache absorbs most of the load

### Multi-User Event Filtering

**Problem**: When Gabriel completes a task assigned to both Gabriel and Sara, both users' frontends need to know.

**Solution**:
1. Backend extracts `assigned_users` from coordinator data after cache invalidation
2. Includes `assigned_users` in `tasktracker_task_completed` event
3. Frontend cards check if current user is in `assigned_users` before refreshing
4. Falls back to refreshing if `assigned_users` is empty (safe default)

**Benefits**:
- Reduces unnecessary refreshes for unaffected users
- Works with partial updates to avoid DOM thrashing
- Backward compatible (empty list triggers refresh)

## Data Flow

### Read Path (Cached)

```
Frontend Card
    ↓
Service Call
    ↓
get_cached_or_fetch()
    ↓
Cache Hit? → Return cached data
    ↓ (miss)
API Request → Cache result → Return data
```

### Read Path (Coordinator)

```
Frontend Card
    ↓
Service Call
    ↓
Check Coordinator.data
    ↓
Return if available
    ↓ (stale/missing)
Coordinator.async_refresh() → Return fresh data

[Background: Coordinator polls every 3 minutes]
```

### Write Path (Mutation)

```
Frontend Card
    ↓
Service Call (complete/create/update)
    ↓
API Request
    ↓
invalidate_all_user_caches()
    ├── Clear all per-user caches (:username)
    ├── Clear all shared caches (:None)
    └── Refresh all coordinators (await)
    ↓
Fire Event (with assigned_users)
    ↓
Frontend Cards Filter by assigned_users
    ↓
Affected Cards Fetch Fresh Data
```

## Cache Keys

**Format**: `{endpoint}:{username}`

**Examples**:
- `daily_plan_encouragement:gabriel` - User-specific encouragement
- `recommended_tasks:sara` - Sara's recommended tasks
- `available_tasks:None` - Shared data (all users)
- `leftovers:gabriel` - Gabriel's leftovers

**Pattern Matching**:
- Invalidate user: `pattern=":gabriel"` clears all Gabriel's caches
- Invalidate shared: `pattern=":None"` clears all shared caches

## Performance Characteristics

### Cache Hit Scenario
- **Latency**: <1ms (in-memory lookup)
- **Network**: 0 requests
- **Cost**: $0

### Cache Miss + API Call
- **Latency**: ~50-200ms (depends on server)
- **Network**: 1 request per miss
- **Cost**: Minimal (backend cache absorbs load)

### Coordinator Background Refresh
- **Frequency**: Every 3 minutes per user
- **Network**: 1 request per user per interval
- **Cost**: ~20 requests/hour per user for daily plan

### Mutation Invalidation
- **Latency**: ~200-500ms (refreshes all coordinators)
- **Network**: N requests (N = number of configured users)
- **Cost**: Acceptable for infrequent mutations

## Monitoring

### Cache Statistics

```python
cache = entry_data["cache"]
stats = await cache.get_stats()
# Returns: {"size": 10, "keys": ["daily_plan_encouragement:gabriel", ...]}
```

### Coordinator Status

```python
coordinator = coordinators["gabriel"]["daily_plan"]
coordinator.last_update_success  # Boolean
coordinator.last_update_time     # DateTime
```

## Testing

### Unit Tests
- `test_cache.py` - Cache operations (get, set, invalidate, expiration)
- `test_coordinators.py` - Coordinator behavior (success, failure, refresh)

### Integration Tests
- `test_cache_integration.py` - End-to-end caching behavior
- `test_multi_user_events.py` - Multi-user event filtering and cache invalidation

## Trade-offs

### What We Optimized For
✅ Data freshness (no stale data)
✅ Simple, predictable behavior
✅ Multi-user correctness
✅ Reduced LLM API costs (encouragement)

### What We Accepted
⚠️ Slightly more API calls on mutations (all users refresh)
⚠️ Memory usage for cache storage (minimal, ~KB per user)
⚠️ Background polling overhead (20 req/hour per user)

## Future Enhancements

Possible improvements if needed:
1. **Redis cache** for multi-instance HA setups
2. **Smarter invalidation** using task metadata instead of aggressive clearing
3. **Configurable TTLs** via integration configuration
4. **Cache size limits** with LRU eviction
5. **WebSocket support** for push-based updates instead of polling
