# Partial Update System and Split Rendering Architecture for TaskTracker Cards

## Overview

This document describes the partial update system and split rendering architecture implemented to improve performance and maintainability in TaskTracker cards. The system provides:

1. **Split Rendering**: Separates static card structure (header) from dynamic content (tasks)
2. **Partial Updates**: Prevents full DOM re-renders during rapid task completions
3. **Dynamic Button Updates**: Updates header button states without re-rendering
4. **Reusable Patterns**: DRY implementation across all card types

## Key Features

### 1. Split Rendering Architecture
- **Structure Rendering**: Static card shell (header, buttons) rendered once with `_renderStructure()`
- **Content Rendering**: Dynamic content (tasks, loading states) updated with `_renderContent()`
- **Event Listener Persistence**: Header event listeners attached once and preserved across content updates
- **Idempotent Structure**: `_structureRendered` flag prevents duplicate structure rendering

### 2. Dynamic Header Button Updates
- **State-Aware Buttons**: Update button appearance without full header re-render
- **Reusable Pattern**: `_updateHeaderButton()` method for any header button updates
- **Immediate Feedback**: Button state changes instantly on user interaction
- **Multi-Property Updates**: Classes, attributes, icons, and titles in single call

### 3. Force Full Render Pattern
- **Filter Changes**: Skip partial updates when data filtering changes
- **Config Changes**: Force structure re-render when header-affecting config changes
- **Fallback Strategy**: Graceful degradation from partial to full updates
- **Performance Control**: Explicit control over update strategies

### 4. Rapid Completion Detection
- Tracks completion timestamps in a 5-second sliding window
- Enables "rapid completion mode" after 2+ completions within 5 seconds
- Queues full refreshes when in rapid mode to prevent excessive API calls
- **Unified code path**: Event listeners use the same `_fetchPlan()` method, ensuring consistent partial update behavior

### 5. Smart Change Detection
- Compares old vs new data to determine if partial updates are feasible
- Identifies removed, added, and updated tasks
- Falls back to full re-render for complex changes (structure changes, too many changes)

### 6. Targeted DOM Updates
- Removes completed task elements with fade-out animation
- Updates section states (empty messages) when all tasks in a section are completed
- Preserves scroll position and UI state during updates

### 7. DRY Implementation
- Base utilities in `TaskTrackerBaseCard` and `TaskTrackerTasksBaseCard` for reuse across all cards
- Shared fade-out animation styles in `TaskTrackerStyles`
- Extensible hooks for card-specific update logic
- Configuration-driven behavior with minimal subclass code

## Implementation Details

### Base Card Class (`TaskTrackerBaseCard`)

#### New Properties
```javascript
this._structureRendered = false; // Track if structure has been rendered
```

#### Key Methods
- `_renderStructure()` - Renders card structure once with idempotent guard
- `_attachHeaderEventListeners()` - Attaches header event listeners once
- `_updateHeaderButton(selector, updates)` - Updates button state without re-render
- `_shouldResetStructure(oldConfig, newConfig)` - Hook for config-driven structure resets
- `getCardStyles()` - Hook for subclass-specific CSS injection

#### Split Rendering Template
```javascript
_renderStructure() {
  if (!this._structureRendered) {
    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerStyles.getCommonCardStyles()}
        ${this.getCardStyles ? this.getCardStyles() : ''}
      </style>
      <div class="card">
        ${this._renderHeader()}
        <div class="content-container">
          ${this._renderContent()}
        </div>
      </div>
    `;
    this._attachHeaderEventListeners();
    this._structureRendered = true;
  }
}
```

#### Dynamic Button Updates
```javascript
_updateHeaderButton('.filter-toggle-btn', {
  classes: [{ className: 'filtered', add: this._showRecommendedOnly }],
  icon: this._showRecommendedOnly ? 'mdi:filter-check' : 'mdi:filter-off',
  title: 'Updated button title'
});
```

### Task Cards Base Class (`TaskTrackerTasksBaseCard`)

#### Enhanced Properties
```javascript
this._lastRefreshTime = 0;
this._recentCompletions = [];
this._queuedRefresh = false;
this._previousData = null;
this._taskDataMap = new Map(); // Moved from individual cards
```

#### Key Methods
- `_isInRapidCompletionMode()` - Detects rapid completion scenarios
- `_canDoPartialUpdate(oldData, newData)` - Determines update feasibility
- `_identifyChanges(oldData, newData)` - Finds specific changes between datasets
- `_applyPartialUpdates(changes)` - Applies targeted DOM updates
- `_removeTaskElements(removedTasks)` - Removes tasks with animation
- `_fetchWithPartialUpdateSupport(options, fetchCallback, updateCallback)` - Reusable fetch pattern

### Daily Plan Card Implementation

#### Simplified Structure with Base Class Integration
```javascript
class TaskTrackerDailyPlanCard extends TaskTrackerTasksBaseCard {
  constructor() {
    super(); // Gets _structureRendered, _taskDataMap, etc.
    this._showRecommendedOnly = true;
  }

  // Configuration-driven structure resets
  _shouldResetStructure(oldConfig, newConfig) {
    return oldConfig && (
      oldConfig.show_header !== newConfig.show_header ||
      oldConfig.explicit_user !== newConfig.explicit_user ||
      oldConfig.user_filter_mode !== newConfig.user_filter_mode
    );
  }

  // Card-specific styles
  getCardStyles() {
    return TaskTrackerStyles.getDailyPlanCardStyles();
  }

  // Filter toggle with immediate visual feedback
  _toggleRecommendationFilter() {
    this._showRecommendedOnly = !this._showRecommendedOnly;
    this._updateFilterButtonAppearance(); // Instant visual update
    this._fetchPlan({ forceFullRender: true }); // Force full render for filter changes
  }

  // Reusable button update pattern
  _updateFilterButtonAppearance() {
    this._updateHeaderButton('.filter-toggle-btn', {
      classes: [{ className: 'filtered', add: this._showRecommendedOnly }],
      icon: this._showRecommendedOnly ? 'mdi:filter-check' : 'mdi:filter-off',
      title: this._showRecommendedOnly
        ? 'Showing recommended tasks only - click to show all tasks'
        : 'Showing all tasks - click to show recommended only'
    });
  }
}
```

#### Enhanced `_fetchPlan()` Method with Force Full Render
```javascript
async _fetchPlan(options = {}) {
  // ... rapid completion detection ...

  // Try partial update if we have previous data and not forcing full render
  if (this._previousData && newPlan && this._plan && !options.forceFullRender) {
    if (this._canDoPartialUpdate(oldDataWithContext, newDataWithContext)) {
      const changes = this._identifyChanges(this._previousData, newPlan.data);
      if (this._applyPartialUpdates(changes)) {
        // Success - update internal state without full re-render
        return;
      }
    }
  }

  // Fall back to full update
  this._renderContent();
}
```

#### Card-Specific Update Methods
- `_updateSectionStates()` - Updates section empty states for daily plan structure
- `_updateTaskElements()` - Handles task element updates with event listener reattachment
- `_attachElementEventListeners()` - Reattaches events to updated elements
- `_attachHeaderEventListeners()` - Extends base class to add card-specific header buttons

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

## Update Scenarios and Patterns

### ✅ Split Rendering (Structure + Content)
1. **Header State Changes** - Button appearance updated via `_updateHeaderButton()`
2. **Filter Toggle** - Instant visual feedback + forced full content render
3. **Config Changes** - Automatic structure re-render when needed
4. **Event Listener Persistence** - Header listeners survive content updates

### ✅ Partial Updates (Content Only)
1. **Task Completion** - Tasks removed from list
2. **Self-Care Window Completion** - Window states updated
3. **Progress Updates** - Occurrence counts, scores updated
4. **Border Status Changes** - Due/overdue status updates
5. **Daily State Changes** - State display values updated

### ✅ Force Full Render (When Needed)
1. **Filter Changes** - `{ forceFullRender: true }` bypasses partial updates
2. **Data Structure Changes** - Automatic fallback when partial updates fail
3. **User-Initiated Refresh** - Manual refresh button always does full update

### ❌ Not Supported (Full Re-render Required)
1. **Plan Mode Switch** - Normal ↔ reduced plan
2. **Section Structure Changes** - Sections appearing/disappearing
3. **Window Structure Changes** - Number of windows changed
4. **User Context Changes** - Timezone, reset time changes
5. **Too Many Changes** - More than 3 changes at once
6. **Task Additions** - New tasks added (currently falls back)

## Performance Benefits

### Before (Full Re-render Every Time)
- Every button click triggered full shadowRoot.innerHTML rebuild
- Event listeners destroyed and recreated on each update
- 500ms+ delay between completion and UI update
- Lost scroll position, focus state
- Heavy DOM manipulation on each change
- Filter button appearance never updated

### After (Split Rendering + Partial Updates)
- **Structure rendered once**: Header and buttons persist across updates
- **Event listeners preserved**: No need to reattach header event listeners
- **Instant button feedback**: Filter button state updates immediately
- **Rapid completions optimized**: Skip intermediate refreshes, queue final update
- **Selective content updates**: Only content area rebuilds when needed
- **Preserved UI state**: Scroll position, focus state maintained
- **Minimal DOM manipulation**: Targeted updates for simple changes

## Flow Examples

### Filter Toggle Flow (Split Rendering + Force Full Render)
```javascript
// 1. User clicks filter button → Event listener fires immediately
// 2. _toggleRecommendationFilter() called
// 3. State updated: this._showRecommendedOnly = !this._showRecommendedOnly
// 4. _updateFilterButtonAppearance() → Instant visual feedback (icon/class changes)
// 5. _fetchPlan({ forceFullRender: true }) → Skip partial update detection
// 6. API call with new filter parameter
// 7. _renderContent() → Full content area rebuild with filtered data
// 8. Header and button state preserved throughout
```

### Task Completion Flow (Partial Updates)
```javascript
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

### Card Initialization Flow (Split Rendering)
```javascript
// 1. setConfig() called → Base class handles structure reset logic
// 2. _shouldResetStructure() hook called → Card-specific header change detection
// 3. _renderStructure() called → Idempotent structure rendering
// 4. Header HTML generated with current state (filter button, title, etc.)
// 5. _attachHeaderEventListeners() → Event listeners attached once
// 6. connectedCallback() → _renderStructure() called again (skipped due to guard)
// 7. hass setter → onHassFirstRun() → _fetchPlan() → _renderContent()
// 8. Content area populated, header remains untouched
```

## Migration Guide for Other Cards

### To Adopt Split Rendering
1. **Extend Base Classes**: Use `TaskTrackerBaseCard` or `TaskTrackerTasksBaseCard`
2. **Implement Hooks**: Override `getCardStyles()`, `_shouldResetStructure()`, `getHeaderActions()`
3. **Split Methods**: Replace `_render()` with `_renderContent()` (structure handled by base)
4. **Button Updates**: Use `_updateHeaderButton()` for dynamic button state changes
5. **Event Listeners**: Override `_attachHeaderEventListeners()` and call `super.` first

### Example Migration
```javascript
// Before (full re-render)
class OldCard extends HTMLElement {
  _render() {
    this.shadowRoot.innerHTML = `
      <div class="card">
        <div class="header">...</div>
        <div class="content">...</div>
      </div>
    `;
    // Event listeners destroyed and recreated every time
    this._attachAllEventListeners();
  }
}

// After (split rendering)
class NewCard extends TaskTrackerBaseCard {
  getCardStyles() { return 'card-specific CSS'; }

  _renderContent() {
    // Only content area updates
    return '<div class="content">...</div>';
  }

  _attachHeaderEventListeners() {
    super._attachHeaderEventListeners(); // Base refresh button
    // Add card-specific header listeners
  }

  _shouldResetStructure(oldConfig, newConfig) {
    return oldConfig?.someHeaderProperty !== newConfig?.someHeaderProperty;
  }
}
```

## Future Enhancements

### Potential Improvements
1. **Task Addition Support** - Handle new tasks in partial updates
2. **Window-Level Updates** - More granular self-care task updates
3. **Optimistic Updates** - Show changes before server confirmation
4. **Virtual DOM** - Full virtual DOM implementation for complex scenarios
5. **Other Cards Migration** - Apply split rendering to recommended, available, leftovers cards
6. **Enhanced Button Updates** - Support for more complex header state synchronization

### Configuration Options
- Rapid completion threshold (currently 2 completions in 5 seconds)
- Change count threshold (currently 3 changes)
- Animation duration (currently 300ms)
- Queue delay (currently 1 second)
- Structure re-render triggers (configurable via `_shouldResetStructure`)

## Maintainability

### Code Organization
- ✅ **Split Architecture**: Base functionality in `TaskTrackerBaseCard` and `TaskTrackerTasksBaseCard` for reuse
- ✅ **DRY Principles**: Shared utilities prevent code duplication
- ✅ **Clear Separation**: Structure rendering, content rendering, and button updates are distinct
- ✅ **Hook Pattern**: Extensible hooks (`getCardStyles()`, `_shouldResetStructure()`) for card-specific behavior
- ✅ **Comprehensive Documentation**: Inline documentation and flow examples
- ✅ **Backward Compatibility**: Legacy `_render()` method still supported

### Code Reduction
- ✅ **Daily Plan Card**: Removed ~30 lines of duplicate structure rendering code
- ✅ **Task Data Management**: Moved `_taskDataMap` to base class (reusable)
- ✅ **Event Listener Management**: Centralized header event listener patterns
- ✅ **Button State Updates**: Reusable `_updateHeaderButton()` replaces custom implementations

### Testing
- ✅ All existing tests continue to pass
- ✅ No breaking changes to existing APIs
- ✅ Logic validated with mock data scenarios
- ✅ Split rendering maintains existing card functionality

### Error Handling
- ✅ **Graceful Fallback**: Full re-render on partial update failure
- ✅ **Idempotent Guards**: `_structureRendered` prevents duplicate structure rendering
- ✅ **Robust Change Detection**: Prevents false positives
- ✅ **Queued Refresh**: Ensures eventual consistency in rapid completion scenarios
- ✅ **Force Full Render**: Explicit override for complex changes (filters, config)

## Conclusion

The enhanced system now provides:

1. **Split Rendering Architecture**: Separates static structure from dynamic content, eliminating event listener destruction and enabling instant UI feedback
2. **Partial Update System**: Optimizes rapid task completion scenarios with targeted DOM updates and smooth animations
3. **DRY Implementation**: Reusable patterns in base classes reduce code duplication and improve maintainability
4. **Force Full Render Control**: Explicit control over update strategies for complex changes like filtering

Key achievements:
- ✅ **Fixed toggle button issues**: Event listeners persist, button state updates instantly
- ✅ **Performance optimization**: Reduced DOM manipulation and preserved UI state
- ✅ **Code maintainability**: ~30 lines removed from daily plan card, patterns reusable across all cards
- ✅ **Backward compatibility**: Existing cards continue to work without changes
- ✅ **Extensible design**: Clear migration path for other cards to adopt split rendering

The architecture provides a solid foundation for future performance improvements while maintaining the flexibility and maintainability of the TaskTracker card system.
