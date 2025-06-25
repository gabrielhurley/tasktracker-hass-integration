# TaskTracker Home Assistant Custom Cards Documentation

## Overview

The TaskTracker integration provides a set of custom Lovelace cards for managing tasks and leftovers within Home Assistant. These cards follow consistent patterns for data management, user interaction, modal editing, and configuration.

## Card Architecture Patterns

### 1. Core Structure Pattern

All cards follow a consistent structure:

```javascript
class TaskTrackerSomeCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._data = [];
    this._loading = false;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._eventCleanup = null;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-some-card-editor');
  }

  static getStubConfig() {
    return {
      // Default configuration values
    };
  }
}
```

### 2. Lifecycle Management

**Home Assistant Integration:**
- `set hass(hass)` - Handles Home Assistant instance updates
- `setConfig(config)` - Processes card configuration
- `connectedCallback()` - Element attachment to DOM
- `disconnectedCallback()` - Cleanup when element is removed

**Data Loading:**
- Initial load vs refresh states differentiated
- Error handling with user-friendly messages
- Auto-refresh functionality with configurable intervals

### 3. User Management Pattern

Cards implement consistent user filtering with three modes:

```javascript
_getCurrentUsername() {
  return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
}
```

**User Filter Modes:**
- `'all'` - Show data for all users
- `'current'` - Show data for the current Home Assistant user
- `'explicit'` - Show data for a specifically configured username

## Modal Component Patterns

### 1. Standard Task Modal

The primary modal pattern uses `TaskTrackerUtils.createTaskModal()` for task interaction:

```javascript
_showTaskModal(task, taskIndex) {
  const modal = TaskTrackerUtils.createTaskModal(
    task,                    // Task object with all properties
    this._config,           // Card configuration
    async (notes) => {      // Completion callback
      await this._completeTask(task, notes);
    },
    async (updates) => {    // Save callback (optional for edit mode)
      await this._saveTask(task, updates);
    },
    this._availableUsers,   // Available users for assignment
    this._enhancedUsers     // Enhanced user mappings (display names)
  );
  TaskTrackerUtils.showModal(modal);
}
```

### 2. Modal Features

**Task Information Display:**
- Task name, duration, priority, due date
- Assignment information
- Notes and completion history
- Editable fields for authorized users

**Interactive Elements:**
- Completion notes textarea (optional via config)
- Edit fields for duration, priority, due date, assignment
- Save button (only shown when `onSave` callback provided)
- Complete button
- Cancel/close buttons

**User Experience:**
- Backdrop click to close
- Escape key support
- Smooth fade transitions
- Responsive design

### 3. Modal Implementation Details

The modal is created as a full-screen overlay:

```javascript
static createTaskModal(task, config, onComplete, onSave = null, availableUsers = [], enhancedUsers = null) {
  const modal = document.createElement('div');
  modal.className = 'task-modal';
  modal.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    background: rgba(0, 0, 0, 0.5);
    z-index: 10000;
    display: flex;
    align-items: center;
    justify-content: center;
  `;
}
```

**Content Structure:**
- Header with task name and close button
- Task details grid (duration, priority, due date, assignment)
- Notes section for task and completion notes
- Action buttons footer

### 4. Modal Event Handling

**Completion Flow:**
1. User clicks task item or complete button
2. Modal opens with task details
3. User adds optional completion notes
4. Completion callback triggered
5. Backend API called via `TaskTrackerUtils.completeTask()`
6. Success/error feedback shown
7. Data refreshed automatically

**Edit Flow (when enabled):**
1. User modifies editable fields in modal
2. Save button enabled when changes detected
3. Updates collected and validated
4. Save callback triggered with changes
5. Backend API called via `TaskTrackerUtils.updateTask()`
6. Feedback provided and data refreshed

## Event System Patterns

### 1. Cross-Card Communication

Cards use Home Assistant's event bus for real-time updates:

```javascript
_setupEventListeners() {
  const taskCleanup = TaskTrackerUtils.setupTaskCompletionListener(
    this._hass,
    (eventData) => {
      const shouldRefresh = this._shouldRefreshForUser(eventData.username);
      if (shouldRefresh) {
        setTimeout(() => {
          this._fetchData();
        }, 500);
      }
    }
  );

  this._eventCleanup = taskCleanup;
}
```

**Event Types:**
- `task_completed` - When tasks are completed
- `leftover_disposed` - When leftovers are disposed
- `task_updated` - When task properties are modified
- `task_created` - When new tasks are created

### 2. Event Cleanup

Proper cleanup prevents memory leaks during dashboard editing:

```javascript
disconnectedCallback() {
  if (this._eventCleanup) {
    this._eventCleanup().catch(error => {
      if (error?.code !== 'not_found') {
        console.warn('Error cleaning up event listener:', error);
      }
    });
  }
}
```

## Configuration Patterns

### 1. Card Editor Structure

Each card has a companion editor class:

```javascript
class TaskTrackerSomeCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._debounceTimers = {};
  }

  configChanged(newConfig) {
    const event = new Event('config-changed', {
      bubbles: true,
      composed: true,
    });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }
}
```

### 2. Configuration Utilities

Consistent configuration UI creation via utility functions:

```javascript
${TaskTrackerUtils.createConfigRow(
  'Show Notes',
  'Display completion notes where available',
  TaskTrackerUtils.createCheckboxInput(this._config.show_notes, 'show_notes')
)}
```

**Available Input Types:**
- `createNumberInput()` - Numeric values with min/max validation
- `createTextInput()` - Text fields with placeholders
- `createCheckboxInput()` - Boolean toggles
- `createSelectInput()` - Dropdown selections

### 3. Debounced Updates

Text inputs use debouncing to prevent excessive configuration updates:

```javascript
_valueChanged(ev) {
  TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
}
```

## Common Utility Patterns

### 1. Data Formatting

Consistent formatting across all cards:

```javascript
// Date/time formatting
TaskTrackerUtils.formatDateTime(dateString)    // "2h ago", "Yesterday"
TaskTrackerUtils.formatDueDate(dueDateString)  // "2 days", "Tomorrow"
TaskTrackerUtils.formatDuration(minutes)       // "1h 30m", "45m"

// Priority formatting
TaskTrackerUtils.formatPriority(priority)      // "High", "Medium", "Low"

// User display names
TaskTrackerUtils.getUserDisplayName(username, enhancedUsers)
```

### 2. API Integration

Standardized service calls through utility functions:

```javascript
// Task operations
await TaskTrackerUtils.completeTask(hass, taskName, username, notes);
await TaskTrackerUtils.updateTask(hass, taskId, taskType, assignedTo, updates);

// Leftover operations
await TaskTrackerUtils.disposeLeftover(hass, leftoverName, username, notes);

// Data fetching
await TaskTrackerUtils.getAvailableUsers(hass);
await TaskTrackerUtils.getEnhancedUsers(hass);
```

### 3. Visual Feedback

Consistent user feedback patterns:

```javascript
// Success notifications
TaskTrackerUtils.showSuccess('Task completed successfully');

// Error notifications
TaskTrackerUtils.showError('Failed to complete task: ' + error.message);
```

## Styling Patterns

### 1. Common Styles

Shared CSS through `TaskTrackerUtils.getCommonCardStyles()`:

- Consistent card layout and spacing
- Home Assistant theme integration
- Responsive design patterns
- Loading/error state styling
- Interactive element hover effects

### 2. Status Indicators

Visual cues for different states:

```css
.task-item.needs-completion { border-left: 2px solid var(--primary-color); }
.task-item.completed { border-left: 2px solid var(--success-color); }
.leftover-item.expired { border-left: 2px solid var(--error-color); }
```

## Available Cards

1. **TaskTracker Available Tasks Card** - Shows pending tasks with completion actions
2. **TaskTracker Complete Task Card** - Form-based task completion interface
3. **TaskTracker Recent Tasks Card** - History of completed tasks
4. **TaskTracker Recommended Tasks Card** - AI-suggested task prioritization
5. **TaskTracker Leftovers Card** - Food leftover management with expiration tracking
6. **TaskTracker Time Spent Card** - Time tracking and reporting

Each card follows these established patterns while providing specialized functionality for different aspects of task and leftover management.
