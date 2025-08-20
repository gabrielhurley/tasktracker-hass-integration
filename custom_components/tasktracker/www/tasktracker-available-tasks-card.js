import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';
import { TaskTrackerDateTime } from './utils/datetime-utils.js';
import { TaskTrackerTasksBaseCard } from './utils/task-cards-base.js';
import { TaskTrackerTaskEditor } from './utils/ui/task-editor.js';
import { TaskTrackerBaseEditor } from './utils/base-config-editor.js';

/**
 * TaskTracker Available Tasks Card
 *
 * A custom Lovelace card for displaying available tasks:
 * - Shows all available tasks in a list
 * - Modal popup for task details and completion
 * - Configurable filtering options
 * - Real-time API integration for task data
 */

class TaskTrackerAvailableTasksCard extends TaskTrackerTasksBaseCard {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this._tasks = [];
    this._userContext = null;
    this._availableUsers = [];
    this._enhancedUsers = []; // Track enhanced user mappings
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._default_upcoming_days = 1;
    this._default_refresh_interval = 300;
    this._default_max_tasks = 20;
    this._eventCleanup = null; // Store event listener cleanup function
  }

  static getConfigElement() {
    return document.createElement('tasktracker-available-tasks-card-editor');
  }

  // Hooks consumed by TaskTrackerTasksBaseCard
  onAfterComplete() { this._fetchAvailableTasks(); }
  onAfterUpdate() { this._fetchAvailableTasks(); }
  onAfterSnooze() { this._fetchAvailableTasks(); }

  static getStubConfig() {
    return {
      upcoming_days: this._default_upcoming_days,
      highlight_overdue: true,
      show_completion_actions: true,
      show_completion_notes: true,
      show_header: true,
      refresh_interval: this._default_refresh_interval,
      max_tasks: this._default_max_tasks,
      user_filter_mode: 'all', // 'all', 'current', 'explicit'
      explicit_user: null
    };
  }

  setConfig(config) {
    this._config = {
      upcoming_days: config.upcoming_days || this._default_upcoming_days,
      highlight_overdue: config.highlight_overdue !== false,
      show_completion_actions: config.show_completion_actions !== false,
      show_completion_notes: config.show_completion_notes !== false,
      show_header: config.show_header !== false,
      refresh_interval: config.refresh_interval || this._default_refresh_interval, // seconds
      max_tasks: config.max_tasks || this._default_max_tasks,
      user_filter_mode: config.user_filter_mode || 'all',
      explicit_user: config.explicit_user || null,
      // Legacy support for old 'user' config
      user: config.user || null,
      ...config
    };

    // Migrate legacy user config to new format
    if (this._config.user && !config.user_filter_mode) {
      this._config.user_filter_mode = 'explicit';
      this._config.explicit_user = this._config.user;
    }

    this._render();
  }

  set hass(hass) {
    super.hass = hass;
    if (this._hass && !this._initialLoad) {
      // noop
    }
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }
    if (this._eventCleanup) {
      // Handle async cleanup
      this._eventCleanup().catch(error => {
        // Suppress "not_found" errors which are common during dashboard editing
        if (error?.code !== 'not_found') {
          console.warn('Error cleaning up TaskTracker event listener:', error);
        }
      });
      this._eventCleanup = null;
    }
  }

  onHassFirstRun() { this._fetchAvailableTasks(); this._setupEventListeners(); }
  onAutoRefresh() { this._fetchAvailableTasks(); }
  onRefresh() { this._fetchAvailableTasks(); }

  _getCurrentUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
  }

  // _fetchAvailableUsers inherited from TaskTrackerTasksBaseCard

  async _fetchAvailableTasks() {
    await this._fetchAvailableUsers();

    // Only show full loading on initial load, use refreshing for subsequent calls
    if (this._initialLoad) {
      this._loading = true;
      this._refreshing = false;
    } else {
      this._loading = false;
      this._refreshing = true;
    }

    this._error = null;
    this._render();

    try {
      const params = {
        upcoming_days: this._config.upcoming_days
      };

      const username = this._getCurrentUsername();
      if (username) {
        params.assigned_to = username;
      }

      const response = await this._hass.callService('tasktracker', 'get_available_tasks', params, {}, true, true);

      let newTasks = [];
      if (response && response.response && response.response.data && response.response.data.items) {
        newTasks = response.response.data.items.slice(0, this._config.max_tasks);
        this._userContext = response.response.data.user_context || null;
      }

      // Always update tasks and re-render on initial load, only compare for subsequent refreshes
      if (this._initialLoad || !this._tasksEqual(this._tasks, newTasks)) {
        this._tasks = newTasks;
        this.clearTaskData(); // Clear task data when refreshing
        this._loading = false;
        this._refreshing = false;
        this._initialLoad = false;
        this._render();
      } else {
        // Data didn't change, just clear the refreshing state
        this._loading = false;
        this._refreshing = false;
        this._render();
      }
    } catch (error) {
      console.error('Failed to fetch available tasks:', error);
      this._error = `Failed to fetch available tasks: ${error.message}`;
      this._tasks = [];
      this._loading = false;
      this._refreshing = false;
      this._initialLoad = false;
      this._render();
    }
  }

  _tasksEqual(tasks1, tasks2) {
    return TaskTrackerUtils.arraysEqual(tasks1, tasks2, (t1, t2) => {
      return t1.name === t2.name &&
        t1.duration_minutes === t2.duration_minutes &&
        t1.priority === t2.priority &&
        t1.last_completed === t2.last_completed;
    });
  }

  _categorizeTasksByStatus(tasks) {
    const overdue = [];
    const due = [];
    const upcoming = [];

    tasks.forEach(task => {
      const dueDateISO = task.due_date;
      if (!dueDateISO) {
        upcoming.push(task);
        return;
      }

      // Prefer API-provided flags when present
      if (task.is_overdue !== undefined || task.days_overdue !== undefined) {
        const isOverdue = !!task.is_overdue || (task.days_overdue || 0) > 0;
        if (isOverdue) {
          overdue.push(task);
        } else {
          // Due today if not overdue and there is a due date
          due.push(task);
        }
        return;
      }

      // Fallback to logical-day aware calculation
      const daysOverdue = TaskTrackerDateTime.calculateDaysOverdue(dueDateISO, this._userContext);
      if (daysOverdue > 0) {
        overdue.push(task);
      } else if (daysOverdue === 0) {
        due.push(task);
      } else {
        upcoming.push(task);
      }
    });

    return { overdue, due, upcoming };
  }

  _showTaskModal(task, taskIndex) {
    // Show detail modal with edit button
    const modal = TaskTrackerUtils.createTaskModal(
      task,
      { ...(this._config || {}), userContext: this._userContext, user_context: this._userContext },
      async (notes, completed_at = null) => {
        await this._completeTask(task, notes, completed_at);
      },
      null, // No inline save functionality in detail view
      this._availableUsers,
      this._enhancedUsers,
      (taskToEdit) => {
        // Edit button callback - opens comprehensive editor
        TaskTrackerTaskEditor.openEditModal(
          taskToEdit,
          this._config,
          async (taskToUpdate, updates) => {
            await this._saveTask(taskToUpdate, updates);
          },
          this._availableUsers,
          this._enhancedUsers
        );
      },
      async (snoozeUntil) => {
        // Snooze button callback - updates task's due date
        await this._snoozeTask(task, snoozeUntil);
      },
      async () => {
        await this._deleteTask(task);
      }
    );
    TaskTrackerUtils.showModal(modal);
  }

  async _completeTask(task, notes, completed_at = null) { await super._completeTask(task, notes, completed_at); }

  async _snoozeTask(task, snoozeUntil) { await super._snoozeTask(task, snoozeUntil); }

  async _saveTask(task, updates) { await super._saveTask(task, updates); }

  _formatPriority(priority) {
    return TaskTrackerUtils.formatPriority(priority);
  }

  _formatDate(dateString) {
    return TaskTrackerUtils.formatDate(dateString);
  }

  _formatDueDate(dueDateString, task = null) {
    return TaskTrackerUtils.formatDueDate(dueDateString, this._userContext, task);
  }

  _formatDuration(minutes) {
    return TaskTrackerUtils.formatDuration(minutes);
  }

  _render() {
    const username = this._getCurrentUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerStyles.getCommonCardStyles()}
      </style>

      <div class="card">
        ${this._renderHeader()}

        ${!hasValidUserConfig ? `
          <div class="no-user-warning">
            No user configured. Please set user in card configuration.
          </div>
        ` : this._renderContent()}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this._fetchAvailableTasks());

    if (hasValidUserConfig) {
      // Setup task click handlers using the base class helper
      this.setupTaskClickHandlers(
        (task, taskType) => {
          this._showTaskModal(task);
        },
        (task, taskType) => {
          this._completeTask(task, '');
        }
      );
    }
  }

  // Base header integration
  getCardTitle() { return 'Available Tasks'; }
  getHeaderStatusHTML() { return this._refreshing ? '<div class="refreshing-indicator"></div>' : ''; }
  onAutoRefresh() { this._fetchAvailableTasks(); }
  onRefresh() { this._fetchAvailableTasks(); }

  _renderContent() {
    // Only show loading state on initial load
    if (this._loading && this._initialLoad) {
      return '<div class="loading">Loading tasks...</div>';
    }

    if (this._error) {
      return `<div class="error">${this._error}</div>`;
    }

    if (!this._tasks || this._tasks.length === 0) {
      return '<div class="no-tasks">No tasks available</div>';
    }

    let content = '';

    if (this._config.highlight_overdue) {
      const { overdue, due, upcoming } = this._categorizeTasksByStatus(this._tasks);
      if (overdue.length > 0) {
        content += `
          <div class="category category-overdue">
            <div class="category-title">Overdue</div>
            ${overdue.map((task, index) => this._renderTaskItem(task, this._tasks.indexOf(task))).join('')}
          </div>
        `;
      }

      if (due.length > 0) {
        content += `
          <div class="category category-due">
            <div class="category-title">Due</div>
            ${due.map((task, index) => this._renderTaskItem(task, this._tasks.indexOf(task))).join('')}
          </div>
        `;
      }

      if (upcoming.length > 0) {
        content += `
          <div class="category category-upcoming">
            <div class="category-title">Upcoming</div>
            ${upcoming.map((task, index) => this._renderTaskItem(task, this._tasks.indexOf(task))).join('')}
          </div>
        `;
      }
    } else {
      // Show all tasks without categorization
      content = this._tasks.sort((a, b) => b.priority_score - a.priority_score).map((task, index) => this._renderTaskItem(task, index)).join('');
    }

    return content;
  }

  _renderTaskItem(task, originalIndex) {
    return this.renderSimpleTaskRow(task, { showActions: this._config.show_completion_actions });
  }

  getCardSize() {
    return Math.min(4, Math.max(1, Math.ceil(this._tasks.length / 5)));
  }

  _setupEventListeners() {
    const cleanups = [];

    cleanups.push(
      TaskTrackerUtils.setupTaskCompletionListener(this._hass, (eventData) => {
        const shouldRefresh = this._shouldRefreshForUser(eventData.username);
        if (shouldRefresh) setTimeout(() => this._fetchAvailableTasks(), 500);
      })
    );
    cleanups.push(
      TaskTrackerUtils.setupTaskCreationListener(this._hass, (eventData) => {
        const shouldRefresh = this._shouldRefreshForUser(eventData.assigned_to);
        if (shouldRefresh) setTimeout(() => this._fetchAvailableTasks(), 500);
      })
    );
    cleanups.push(
      TaskTrackerUtils.setupTaskUpdateListener(this._hass, () => {
        setTimeout(() => this._fetchAvailableTasks(), 500);
      })
    );
    // Also refresh on deletions via the reused task_updated event
    // (already covered by setupTaskUpdateListener)
    cleanups.push(
      TaskTrackerUtils.setupCompletionDeletionListener(this._hass, () => {
        setTimeout(() => this._fetchAvailableTasks(), 500);
      })
    );

    this.setEventCleanups(cleanups);
  }

  _shouldRefreshForUser(completedByUsername) {
    const currentUsername = this._getCurrentUsername();

    // If we're showing all users, refresh for any completion
    if (this._config.user_filter_mode === 'all') {
      return true;
    }

    // If we're filtering by user, only refresh if it matches our filter
    if (currentUsername) {
      return completedByUsername === currentUsername;
    }

    // Default to refreshing
    return true;
  }
}

class TaskTrackerAvailableTasksCardEditor extends TaskTrackerBaseEditor {
  constructor() {
    super();
    this._debounceTimers = {};
  }

  getDefaultConfig() { return { ...TaskTrackerAvailableTasksCard.getStubConfig() }; }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerUtils.getCommonConfigStyles()}
      </style>

      <div class="card-config">
        <div class="section-title">Display Settings</div>

        ${TaskTrackerUtils.createConfigRow(
      'Maximum Tasks',
      'Maximum number of tasks to display',
      TaskTrackerUtils.createNumberInput(this._config.max_tasks, 'max_tasks', 1, 50)
    )}

        ${TaskTrackerUtils.createConfigRow(
      'Show Completion Notes',
      'Display completion notes field in modal',
      TaskTrackerUtils.createCheckboxInput(this._config.show_completion_notes, 'show_completion_notes')
    )}

        ${TaskTrackerUtils.createConfigRow(
      'Show Header',
      'Display card header with title and refresh button',
      TaskTrackerUtils.createCheckboxInput(this._config.show_header, 'show_header')
    )}

        <div class="section-title">User Settings</div>

        ${TaskTrackerUtils.createConfigRow(
      'User Filter Mode',
      'How to determine the user for tasks',
      TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
        { value: 'all', label: 'All Users' },
        { value: 'current', label: 'Current User' },
        { value: 'explicit', label: 'Specific User' }
      ])
    )}

        ${this._config.user_filter_mode === 'explicit' ? TaskTrackerUtils.createConfigRow(
      'Username',
      'Specific username for task management',
      TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
    ) : ''}

        <div class="section-title">Behavior Settings</div>

        ${TaskTrackerUtils.createConfigRow(
      'Refresh Interval (seconds)',
      'How often to automatically refresh task data',
      TaskTrackerUtils.createNumberInput(this._config.refresh_interval, 'refresh_interval', 10, 3600, 10)
    )}
      </div>
    `;

    // Add event listeners
    this.shadowRoot.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', this._valueChanged.bind(this));
      if (input.type === 'text' || input.type === 'number') {
        input.addEventListener('input', this._valueChanged.bind(this));
      }
    });
  }

  _updateConfig(configKey, value) {
    super._updateConfig(configKey, value);
    if (configKey === 'user_filter_mode') this._render();
  }
}

if (!customElements.get('tasktracker-available-tasks-card')) {
  customElements.define('tasktracker-available-tasks-card', TaskTrackerAvailableTasksCard);
}
if (!customElements.get('tasktracker-available-tasks-card-editor')) {
  customElements.define('tasktracker-available-tasks-card-editor', TaskTrackerAvailableTasksCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === 'tasktracker-available-tasks-card')) {
  window.customCards.push({
    type: 'tasktracker-available-tasks-card',
    name: 'TaskTracker Available Tasks',
    description: 'Display available and overdue tasks with completion actions',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}