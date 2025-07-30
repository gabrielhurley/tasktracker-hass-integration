# Frontend Date and Time Handling Rules for TaskTracker

## Core Principles

### 1. Logical Day Boundaries vs Calendar Days (Frontend)

**Critical Rule**: The frontend MUST respect the same logical day boundaries as the backend.

- **Calendar Day**: Midnight to 11:59:59 PM (browser local time)
- **Logical Day**: `daily_reset_time` to `daily_reset_time` the next calendar day
- **User Context**: Contains `timezone`, `daily_reset_time`, and `current_logical_date` from API

**Example**: If user's `daily_reset_time` is 5:00 AM:
- Logical day runs from 5:00 AM today to 4:59:59 AM tomorrow
- A "Night" window (9:00 PM - 3:00 AM) is entirely within one logical day
- At 8:00 AM, the Night window from the current logical day is NOT overdue

### 2. Centralized DateTime Utilities

**Critical Rule**: All date/time calculations MUST use `TaskTrackerDateTime` utilities.

**Import and Usage**:
```javascript
import { TaskTrackerDateTime } from './tasktracker-datetime-utils.js';

// Check if window is overdue
const isOverdue = TaskTrackerDateTime.isWindowInPast(window, userContext);

// Get completion timestamp
const timestamp = TaskTrackerDateTime.getCompletionTimestamp(window, userContext);

// Format time for display
const timeRange = TaskTrackerDateTime.formatWindowTimeRange(window);
```

### 3. User Context Dependency

**Critical Rule**: All datetime operations require `userContext` from API response.

**Required Fields**:
```javascript
const userContext = {
  timezone: "America/Los_Angeles",           // User's timezone
  daily_reset_time: "05:00:00",            // When logical day resets
  current_logical_date: "2025-07-30",      // Current logical date
  daily_task_cutoff_time: "20:00:00"       // Evening task cutoff
};
```

## Implementation Guidelines

### 1. Window Overdue Logic

**DO NOT** use simple clock time comparisons:
```javascript
// WRONG - ignores logical day boundaries
const isOverdue = currentHours > windowEndHours;
```

**DO** use logical day aware utilities:
```javascript
// CORRECT - respects logical day boundaries
const isOverdue = TaskTrackerDateTime.isWindowInPast(window, userContext);
```

### 2. Task Completion Timestamps

**Window-Specific Completion** (Midpoint Timestamp Principle):
```javascript
// Get appropriate timestamp for window completion
const completionTimestamp = TaskTrackerDateTime.getCompletionTimestamp(window, userContext);

// null = use current time, string = use specific timestamp
await this._completeTask(taskData, notes, completionTimestamp);
```

**Generic Task Completion**:
```javascript
// For generic completion (no specific window)
await this._completeTask(taskData, notes); // Uses current time
```

### 3. Time Display Formatting

**Consistent Time Formatting**:
```javascript
// Format individual times
const formattedTime = TaskTrackerDateTime.formatTimeForDisplay("21:00"); // "9 PM"

// Format window ranges
const timeRange = TaskTrackerDateTime.formatWindowTimeRange(window); // "9 PM - 3 AM"
```

### 4. Overdue Status Calculation

**For API-provided overdue info** (self-care tasks):
```javascript
// Use API response directly
const isOverdue = task.is_overdue;
const daysOverdue = task.days_overdue;
```

**For frontend calculation** (when API doesn't provide):
```javascript
// Calculate using logical day boundaries
const daysOverdue = TaskTrackerDateTime.calculateDaysOverdue(task.due_date, userContext);
const isOverdue = daysOverdue > 0;
```

## Integration Patterns

### 1. Card Data Fetching

Always extract and use `userContext` from API responses:
```javascript
async _fetchPlan() {
  const response = await this._hass.callService('tasktracker', 'get_daily_plan', serviceData);

  if (response && response.response) {
    this._plan = response.response;
    this._userContext = response.response.user_context; // Extract user context
  }
}
```

### 2. Window Rendering

Replace manual time logic with utilities:
```javascript
// Old way - WRONG
_isWindowInPast(window) {
  const now = new Date();
  const currentMinutes = now.getHours() * 60 + now.getMinutes();
  // ... complex manual logic that ignores logical days
}

// New way - CORRECT
_renderSelfCareTaskWithWindows(task) {
  const windowsHtml = task.windows.map((window, index) => {
    const isWindowOverdue = TaskTrackerDateTime.isWindowInPast(window, this._userContext);
    const timeRange = TaskTrackerDateTime.formatWindowTimeRange(window);
    // ... rest of rendering
  });
}
```

### 3. Completion Handler Updates

Use the new completion timestamp logic:
```javascript
// Window completion click handler
windowItem.addEventListener('click', (e) => {
  const window = taskData.windows[windowIndex];
  const completionTimestamp = TaskTrackerDateTime.getCompletionTimestamp(window, this._userContext);
  this._completeTask(taskData, '', completionTimestamp);
});
```

## Migration Checklist

### 1. Replace Manual Time Logic

**Find and Replace**:
- ✅ Manual `_isWindowInPast()` implementations
- ✅ Manual `_calculateWindowMidpoint()` implementations
- ✅ Manual `_formatWindowTime()` implementations
- ✅ Manual overdue calculations using calendar days
- ✅ Hardcoded midnight boundaries

**With**:
- ✅ `TaskTrackerDateTime.isWindowInPast()`
- ✅ `TaskTrackerDateTime.calculateWindowMidpoint()`
- ✅ `TaskTrackerDateTime.formatTimeForDisplay()`
- ✅ `TaskTrackerDateTime.calculateDaysOverdue()`
- ✅ Logical day boundary utilities

### 2. Update Import Statements

Add the datetime utilities import to all cards:
```javascript
import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerDateTime } from './tasktracker-datetime-utils.js'; // Add this
```

### 3. Extract User Context

Ensure all cards extract and store `userContext`:
```javascript
// In data fetching methods
this._userContext = response.response.user_context;

// Pass to datetime utilities
const isOverdue = TaskTrackerDateTime.isWindowInPast(window, this._userContext);
```

## Testing Guidelines

### 1. Logical Day Boundary Testing

Test scenarios across logical day boundaries:
```javascript
// Test data
const userContext = {
  timezone: "America/Los_Angeles",
  daily_reset_time: "05:00:00",
  current_logical_date: "2025-07-30"
};

const nightWindow = {
  start: "21:00",
  end: "03:00"
};

// At 8:25 AM - Night window should NOT be overdue
// At 4:00 AM next day - Night window should NOT be overdue
// At 6:00 AM next day - Night window should be overdue
```

### 2. Cross-Midnight Window Testing

Ensure midnight-crossing windows work correctly:
```javascript
const crossMidnightWindow = {
  start: "23:30",
  end: "01:30"
};

// Test midpoint calculation
// Test overdue detection
// Test current time detection
```

### 3. Debug Helpers

Use the debug utility for troubleshooting:
```javascript
TaskTrackerDateTime.debugWindowTiming('Brush Teeth Night', window, userContext);
```

## Common Pitfalls and Solutions

### 1. Ignoring User Context

**Problem**: Using browser time without considering logical day boundaries
**Solution**: Always pass `userContext` to datetime utilities

### 2. Manual Time Calculations

**Problem**: Implementing time logic manually in multiple places
**Solution**: Use centralized `TaskTrackerDateTime` utilities

### 3. Calendar Day Assumptions

**Problem**: Assuming days start/end at midnight
**Solution**: Use logical day boundaries from `daily_reset_time`

### 4. Inconsistent Time Formatting

**Problem**: Different time format implementations across cards
**Solution**: Use `TaskTrackerDateTime.formatTimeForDisplay()` consistently

### 5. Stale User Context

**Problem**: Using outdated user context data
**Solution**: Refresh user context on each API call

## File-by-File Migration Plan

### 1. Daily Plan Card (`tasktracker-daily-plan-card.js`)
- ✅ Replace `_isWindowInPast()` with `TaskTrackerDateTime.isWindowInPast()`
- ✅ Replace `_calculateWindowMidpoint()` with `TaskTrackerDateTime.calculateWindowMidpoint()`
- ✅ Replace `_formatWindowTime()` with `TaskTrackerDateTime.formatTimeForDisplay()`
- ✅ Update completion timestamp logic

### 2. Other Cards
- ✅ Recommended Tasks Card - updated datetime calculations
- ✅ Leftovers Card - updated datetime calculations and added user context
- ✅ Available Tasks Card - updated datetime calculations and added user context
- ✅ All cards now use centralized datetime utilities

### 3. Utils Integration
- ✅ Created centralized `TaskTrackerDateTime` utilities
- ✅ All cards now import and use new datetime utilities
- ✅ Deprecated old datetime methods in `tasktracker-utils.js`
- ✅ Removed duplicate datetime testing code
- ✅ Consistent datetime handling across all cards

## Consistency Requirements

1. **All window overdue checks** MUST use `TaskTrackerDateTime.isWindowInPast()`
2. **All completion timestamps** MUST use `TaskTrackerDateTime.getCompletionTimestamp()`
3. **All time formatting** MUST use `TaskTrackerDateTime.formatTimeForDisplay()`
4. **All overdue calculations** MUST respect logical day boundaries
5. **All cards** MUST extract and use `userContext` from API responses
6. **All manual datetime logic** MUST be replaced with centralized utilities
7. **New code** MUST NOT use deprecated methods in `TaskTrackerUtils` (marked with @deprecated)

## Future Considerations

### 1. Timezone Library Integration

Currently assumes browser timezone matches user timezone. Future enhancement:
```javascript
// Potential future integration with date-fns-tz or similar
import { zonedTimeToUtc, utcToZonedTime } from 'date-fns-tz';

static getCurrentTimeInUserTZ(userContext) {
  const context = this.parseUserContext(userContext);
  return utcToZonedTime(new Date(), context.timezone);
}
```

### 2. Caching and Performance

For frequent datetime calculations:
- Cache logical day start/end times
- Memoize expensive calculations
- Batch window status calculations

### 3. Real-time Updates

Handle logical day transitions:
- Listen for daily reset time events
- Update window statuses automatically
- Refresh cards at logical day boundaries

By following these rules, all frontend datetime handling will remain consistent with backend logical day calculations and provide accurate task timing information to users.