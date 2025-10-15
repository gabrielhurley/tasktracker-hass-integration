# TaskTracker Cache and Event Pattern

## Identified Issues

### Services Missing Cache Invalidation (❌)

1. **update_task** - Fires event but does NOT invalidate cache
   - Impact: Snoozed tasks remain visible in cards until manual refresh
   - Impact: Edited tasks show stale data

2. **delete_task** - Fires events but does NOT invalidate cache
   - Impact: Deleted tasks remain visible in cards

3. **Voice Intents (intents.py)** - All fire events but do NOT invalidate cache
   - Impact: Voice-created tasks don't appear in cards
   - Affects: AddAdHocTaskIntentHandler, CreateTaskFromDescriptionIntentHandler, etc.

### Services with Wrong Event Names (⚠️)

1. **set_daily_state** - Fires `tasktracker_daily_state_updated` instead of `tasktracker_daily_state_set`
   - Event name doesn't match const.py definition

## The Correct Pattern

### Sequence for ALL Mutation Operations

For ANY service that modifies data (create, update, delete, complete, snooze, etc.):

```python
async def service_handler(call: ServiceCall) -> dict[str, Any]:
    try:
        # 1. Make API call
        result = await api.some_mutation(...)

        if result.get("success"):
            # 2. Invalidate cache + refresh coordinators
            # MUST await this to ensure fresh data is available before events fire
            await invalidate_all_user_caches(hass)

            # 3. Fire event to notify frontend cards
            hass.bus.fire(
                "tasktracker_event_name",
                {
                    # Event payload...
                },
            )

        return result
    except Exception:
        _LOGGER.exception("Failed to ...")
        raise
```

### Why This Order Matters

1. **API Call First**: Gets the server-side change done
2. **Cache Invalidation Second**:
   - Clears stale cached data
   - Triggers coordinator refresh (awaited)
   - Ensures fresh data is loaded before events fire
3. **Event Firing Last**:
   - Frontend cards receive event
   - Cards fetch data (gets fresh data from just-refreshed coordinator)
   - Cards display updated state

### Critical Rules

1. **ALWAYS use `invalidate_all_user_caches(hass)`** for operations that may affect multiple users
   - Task completions (assigned_users may include multiple people)
   - Task updates (reassignment scenarios)
   - Task deletions
   - Task creation

2. **ALWAYS await the invalidation** before firing events
   ```python
   await invalidate_all_user_caches(hass)  # Wait for coordinators to refresh
   hass.bus.fire(...)  # Now fire event
   ```

3. **Use `invalidate_user_cache(hass, username)`** ONLY for single-user operations
   - Setting daily state
   - User-specific queries
   - Operations that definitively affect only one user

## Event Names Reference

From `const.py`:

```python
EVENT_DAILY_PLAN = "tasktracker_daily_plan"
EVENT_DAILY_STATE_SET = "tasktracker_daily_state_set"  # ⚠️ set_daily_state uses wrong name
EVENT_TASK_COMPLETED = "tasktracker_task_completed"
EVENT_TASK_CREATED = "tasktracker_task_created"
EVENT_TASK_UPDATED = "tasktracker_task_updated"
EVENT_TASK_DELETED = "tasktracker_task_deleted"
EVENT_LEFTOVER_CREATED = "tasktracker_leftover_created"
EVENT_LEFTOVER_DISPOSED = "tasktracker_leftover_disposed"
EVENT_COMPLETION_DELETED = "tasktracker_completion_deleted"
EVENT_COMPLETION_UPDATED = "tasktracker_completion_updated"
```

## Service Handler Audit

### ✅ Correct Implementation

- `complete_task`
- `complete_task_by_name`
- `create_adhoc_task`
- `create_task_from_description`
- `delete_completion`
- `update_completion`
- `create_leftover`

### ❌ Needs Fix

- `update_task` - Missing cache invalidation
- `delete_task` - Missing cache invalidation
- `set_daily_state` - Wrong event name
- All voice intents in `intents.py` - Missing cache invalidation

## Frontend Card Event Listeners

Cards should listen for events and refresh data when they receive them:

```javascript
_setupEventListeners() {
  const cleanups = [];

  // Task completion
  cleanups.push(
    TaskTrackerUtils.setupTaskCompletionListener(this._hass, async (eventData) => {
      // Check if this affects current user
      const assignedUsers = eventData.assigned_users || [];
      if (shouldRefreshForUser(assignedUsers)) {
        await this._fetchData();
      }
    })
  );

  // Task creation
  cleanups.push(
    TaskTrackerUtils.setupTaskCreationListener(this._hass, async (eventData) => {
      if (shouldRefreshForUser(eventData.assigned_users)) {
        await this._fetchData();
      }
    })
  );

  // Task updates (includes snooze, edits)
  cleanups.push(
    TaskTrackerUtils.setupTaskUpdateListener(this._hass, async () => {
      await this._fetchData();
    })
  );

  // Task deletions
  cleanups.push(
    TaskTrackerUtils.setupTaskDeletionListener(this._hass, async () => {
      await this._fetchData();
    })
  );

  this.setEventCleanups(cleanups);
}
```

## Testing Strategy

For each service that mutates data, test:

1. **Cache invalidation is called**
   ```python
   with patch('custom_components.tasktracker.service_handlers.tasks.invalidate_all_user_caches') as mock_invalidate:
       await service_handler(call)
       mock_invalidate.assert_called_once_with(hass)
   ```

2. **Event is fired with correct name and payload**
   ```python
   with patch.object(hass.bus, 'fire') as mock_fire:
       await service_handler(call)
       mock_fire.assert_called_once_with(
           'tasktracker_event_name',
           {...expected payload...}
       )
   ```

3. **Sequence: cache before event**
   ```python
   call_order = []
   with patch('...invalidate_all_user_caches', side_effect=lambda h: call_order.append('cache')):
       with patch.object(hass.bus, 'fire', side_effect=lambda *a: call_order.append('event')):
           await service_handler(call)
           assert call_order == ['cache', 'event']
   ```

## Migration Checklist

- [ ] Fix `update_task` handler - add cache invalidation
- [ ] Fix `delete_task` handler - add cache invalidation
- [ ] Fix `set_daily_state` handler - correct event name
- [ ] Fix all voice intent handlers - add cache invalidation
- [ ] Write unit tests for all mutation services
- [ ] Verify frontend cards listen for correct events
- [ ] Test end-to-end: create task → appears in cards
- [ ] Test end-to-end: snooze task → disappears from daily plan
- [ ] Test end-to-end: update task → reflects in cards
- [ ] Test end-to-end: delete task → disappears from cards
