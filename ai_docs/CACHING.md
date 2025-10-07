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

## Logical Day Boundary Handling

### The Problem

The coordinator caches data with a `current_logical_date`. When a new logical day starts (at the user's `daily_reset_time`), the cached data from yesterday persisted indefinitely:

**Example**:
- User sets daily state at 11 PM on 2025-10-06
- Coordinator caches plan with `current_logical_date: "2025-10-06"` and `using_defaults: false`
- Daily reset time is 5 AM
- New logical day starts at 5 AM on 2025-10-07
- **Coordinator continues returning stale data from 2025-10-06 all day**
- Frontend receives yesterday's plan showing tasks without the "Set Daily State" button
- Problem persists for hours (observed 9+ hours after reset time)

### The Solution

On each `get_daily_plan` request, the service handler:

1. Extracts `current_logical_date` and `user_context` from cached coordinator data
2. Calculates the current logical date using user's timezone and reset time
3. Compares cached vs. current logical date
4. If they don't match, clears coordinator data and forces immediate refresh

**Code location**: `service_handlers/daily.py` lines 99-141

```python
# Calculate current logical date
if now.hour < reset_hour or (now.hour == reset_hour and now.minute < reset_minute):
    current_logical_date = (now - timedelta(days=1)).date()
else:
    current_logical_date = now.date()

# If dates don't match, logical day has changed
if cached_logical_date_str != current_logical_date_str:
    logical_day_changed = True
    coordinator.data = None  # Clear stale data
    await coordinator.async_refresh()  # Fetch fresh data
```

### Why This Works

- **Timezone-aware**: Uses user's `timezone` from `user_context`
- **Respects reset time**: Correctly handles users with custom daily reset times
- **No extra API calls**: Uses data already in the coordinator response
- **Immediate**: Detects boundary crossing on first request, not after 3-minute delay
- **Safe fallback**: On error, coordinator continues normal refresh cycle

This ensures users always see the correct UI state (daily state button vs. full plan) immediately after crossing a logical day boundary, rather than waiting up to 3 minutes.

## Future Enhancements

Possible improvements if needed:
1. **Redis cache** for multi-instance HA setups
2. **Smarter invalidation** using task metadata instead of aggressive clearing
3. **Configurable TTLs** via integration configuration
4. **Cache size limits** with LRU eviction
5. **WebSocket support** for push-based updates instead of polling
6. **Proactive coordinator invalidation** at daily reset time (requires background task scheduler)
