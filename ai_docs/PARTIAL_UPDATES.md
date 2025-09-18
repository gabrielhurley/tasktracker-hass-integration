# Partial Update System for TaskTracker Cards

## Overview

This document describes the partial update system implemented to improve performance during rapid task completions. The system prevents full DOM re-renders when users quickly complete multiple tasks, instead applying targeted changes to remove completed tasks with smooth animations.

## Key Features

### 1. Rapid Completion Detection
- Tracks completion timestamps in a 5-second sliding window
- Enables "rapid completion mode" after 2+ completions within 5 seconds
- Queues full refreshes when in rapid mode to prevent excessive API calls
- **Unified code path**: Event listeners use the same `_fetchPlan()` method, ensuring consistent partial update behavior

### 2. Smart Change Detection
- Compares old vs new data to determine if partial updates are feasible
- Identifies removed, added, and updated tasks
- Falls back to full re-render for complex changes (structure changes, too many changes)

### 3. Targeted DOM Updates
- Removes completed task elements with fade-out animation
- Updates section states (empty messages) when all tasks in a section are completed
- Preserves scroll position and UI state during updates

### 4. DRY Implementation
- Base utilities in `TaskTrackerTasksBaseCard` for reuse across all task cards
- Shared fade-out animation styles in `TaskTrackerStyles`
- Extensible hooks for card-specific update logic

## Implementation Details

### Base Class (`TaskTrackerTasksBaseCard`)

#### New Properties
```javascript
this._lastRefreshTime = 0;
this._recentCompletions = [];
this._queuedRefresh = false;
this._previousData = null;
```

#### Key Methods
- `_isInRapidCompletionMode()` - Detects rapid completion scenarios
- `_canDoPartialUpdate(oldData, newData)` - Determines update feasibility
- `_identifyChanges(oldData, newData)` - Finds specific changes between datasets
- `_applyPartialUpdates(changes)` - Applies targeted DOM updates
- `_removeTaskElements(removedTasks)` - Removes tasks with animation

### Daily Plan Card Implementation

#### Enhanced `_fetchPlan()` Method
```javascript
async _fetchPlan(options = {}) {
  // Skip refresh if in rapid completion mode
  if (this._isInRapidCompletionMode() && !options.forceRefresh) {
    this._queuedRefresh = true;
    return;
  }

  // ... fetch data ...

  // Try partial update first
  if (this._previousData && newPlan && !this._loading) {
    if (this._canDoPartialUpdate(this._previousData, newPlan.data)) {
      const changes = this._identifyChanges(this._previousData, newPlan.data);

      if (this._applyPartialUpdates(changes)) {
        // Success - update internal state without full re-render
        this._plan = newPlan;
        this._previousData = newPlan.data;
        this._populateTaskDataMap();
        this._loading = false;
        return;
      }
    }
  }

  // Fall back to full update if partial update fails
  // ...
}
```

#### Card-Specific Update Methods
- `_updateSectionStates()` - Updates section empty states for daily plan structure
- `_updateTaskElements()` - Handles task element updates with event listener reattachment
- `_attachElementEventListeners()` - Reattaches events to updated elements

### CSS Animations

```css
.task-item {
  transition: opacity 0.3s ease, transform 0.3s ease;
}

.task-item.fade-out {
  opacity: 0;
  transform: scale(0.95);
  pointer-events: none;
}
```

## Partial Update Scenarios

### ✅ Supported (Partial Update)
1. **Task Completion** - Tasks removed from list
2. **Self-Care Window Completion** - Window states updated
3. **Progress Updates** - Occurrence counts, scores updated
4. **Border Status Changes** - Due/overdue status updates
5. **Daily State Changes** - State display values updated

### ❌ Not Supported (Full Re-render)
1. **Plan Mode Switch** - Normal ↔ reduced plan
2. **Section Structure Changes** - Sections appearing/disappearing
3. **Window Structure Changes** - Number of windows changed
4. **User Context Changes** - Timezone, reset time changes
5. **Too Many Changes** - More than 3 changes at once
6. **Task Additions** - New tasks added (currently falls back)

## Performance Benefits

### Before
- Every completion triggered full API call + DOM rebuild
- 500ms+ delay between completion and UI update
- Lost scroll position, focus state
- Heavy DOM manipulation on each change

### After
- Rapid completions skip intermediate refreshes
- Instant visual feedback with fade animations
- Preserved UI state and scroll position
- Minimal DOM manipulation for simple changes

## Flow Example

```javascript
// Complete task flow:
// 1. User clicks "Complete" → Instant partial update (task removed with animation)
// 2. API call succeeds → Server fires completion event
// 3. Event listener → _fetchPlan() after 100ms
// 4. Fresh data fetched → Compare with previous data
// 5. Changes detected → Already applied optimistically, data sync confirms
// 6. No additional DOM changes needed → Consistent state maintained

// Rapid completion flow:
// 1st completion: Normal flow above
// 2nd completion: Enters rapid mode, skips fetch in step 3
// 3rd completion: Still in rapid mode, queues refresh
// After delay: Single _fetchPlan() processes all accumulated changes
```

## Future Enhancements

### Potential Improvements
1. **Task Addition Support** - Handle new tasks in partial updates
2. **Window-Level Updates** - More granular self-care task updates
3. **Optimistic Updates** - Show changes before server confirmation
4. **Virtual DOM** - Full virtual DOM implementation for complex scenarios
5. **Other Cards** - Apply system to recommended, available, leftovers cards

### Configuration Options
- Rapid completion threshold (currently 2 completions in 5 seconds)
- Change count threshold (currently 3 changes)
- Animation duration (currently 300ms)
- Queue delay (currently 1 second)

## Maintainability

### Code Organization
- ✅ Base functionality in `TaskTrackerTasksBaseCard` for reuse
- ✅ Shared utilities prevent code duplication
- ✅ Clear separation between detection, identification, and application
- ✅ Comprehensive inline documentation
- ✅ Extensible hooks for card-specific behavior

### Testing
- ✅ All existing tests continue to pass
- ✅ No breaking changes to existing APIs
- ✅ Logic validated with mock data scenarios

### Error Handling
- ✅ Graceful fallback to full re-render on partial update failure
- ✅ Robust change detection prevents false positives
- ✅ Queued refresh ensures eventual consistency

## Conclusion

The partial update system provides significant performance improvements for rapid task completion scenarios while maintaining full backward compatibility and graceful degradation. The DRY implementation allows easy extension to other task cards with minimal additional code.
