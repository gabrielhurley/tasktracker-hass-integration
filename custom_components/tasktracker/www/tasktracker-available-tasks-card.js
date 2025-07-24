import { TaskTrackerUtils } from './tasktracker-utils.js';

/**
 * TaskTracker Available Tasks Card
 *
 * A custom Lovelace card for displaying available tasks:
 * - Shows all available tasks in a list
 * - Modal popup for task details and completion
 * - Configurable filtering options
 * - Real-time API integration for task data
 */

class TaskTrackerAvailableTasksCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._tasks = [];
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
    const wasInitialized = this._hass !== null;
    this._hass = hass;

    // Always set up auto-refresh and event listeners when hass changes
    this._setupAutoRefresh();
    this._setupEventListeners();

    // Only fetch initial data on first hass assignment
    if (!wasInitialized && hass) {
      this._fetchAvailableTasks();
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

  _setupAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }

    this._refreshInterval = TaskTrackerUtils.setupAutoRefresh(() => {
      this._fetchAvailableTasks();
    }, this._config.refresh_interval);
  }

  _getCurrentUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
  }

  async _fetchAvailableUsers() {
    try {
      // Fetch both basic users (for backward compatibility) and enhanced users
      this._availableUsers = await TaskTrackerUtils.getAvailableUsers(this._hass);
      this._enhancedUsers = await TaskTrackerUtils.getEnhancedUsers(this._hass);
    } catch (error) {
      console.warn('Failed to fetch available users:', error);
      this._availableUsers = [];
      this._enhancedUsers = [];
    }
  }

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
      }

      // Always update tasks and re-render on initial load, only compare for subsequent refreshes
      if (this._initialLoad || !this._tasksEqual(this._tasks, newTasks)) {
        this._tasks = newTasks;
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
    const now = new Date();
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());

    const overdue = [];
    const due = [];
    const upcoming = [];

    tasks.forEach(task => {
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        const dueDateOnly = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());

        if (dueDateOnly < today) {
          overdue.push(task);
        } else if (dueDateOnly.getTime() === today.getTime()) {
          due.push(task);
        } else {
          upcoming.push(task);
        }
      } else {
        upcoming.push(task);
      }
    });

    return { overdue, due, upcoming };
  }

  _showTaskModal(task, taskIndex) {
    const modal = TaskTrackerUtils.createTaskModal(
      task,
      this._config,
      async (notes, completed_at = null) => {
        await this._completeTask(task, notes, completed_at);
      },
      async (updates) => {
        await this._saveTask(task, updates);
      },
      this._availableUsers,
      this._enhancedUsers
    );
    TaskTrackerUtils.showModal(modal);
  }

  async _completeTask(task, notes, completed_at = null) {
    // Fetch available users if not already loaded and we're in current user mode
    if (this._config.user_filter_mode === 'current' && this._availableUsers.length === 0) {
      await this._fetchAvailableUsers();
    }

    const username = TaskTrackerUtils.getUsernameForAction(this._config, this._hass, this._availableUsers);

    // For 'current' user mode, username will be null and that's expected
    // The backend will handle user mapping via call context
    if (username === null && this._config.user_filter_mode !== 'current' && this._config.user_filter_mode !== 'all') {
      TaskTrackerUtils.showError('No user configured for task completion');
      return;
    }

    try {
      const response = await TaskTrackerUtils.completeTask(this._hass, task.name, username, notes, completed_at);

      if (response && response.success) {
        TaskTrackerUtils.showSuccess(response.spoken_response || `Task "${task.name}" completed successfully`);
      } else {
        const errorMsg = (response && response.message) || 'Unknown error';
        TaskTrackerUtils.showError(`Failed to complete task: ${errorMsg}`);
      }

      // Refresh tasks after completion
      setTimeout(() => {
        this._fetchAvailableTasks();
      }, 100);

    } catch (error) {
      console.error('Failed to complete task:', error);
      TaskTrackerUtils.showError(`Failed to complete task: ${error.message}`);
    }
  }

  async _saveTask(task, updates) {
    try {
      const response = await TaskTrackerUtils.updateTask(this._hass, task.id, task.task_type, task.assigned_to, updates);

      if (response && response.success) {
        TaskTrackerUtils.showSuccess('Task updated successfully');
      } else {
        const errorMsg = (response && response.message) || 'Unknown error';
        TaskTrackerUtils.showError(`Failed to update task: ${errorMsg}`);
      }

      // Refresh tasks after update
      setTimeout(() => {
        this._fetchAvailableTasks();
      }, 100);

    } catch (error) {
      console.error('Failed to update task:', error);
      TaskTrackerUtils.showError(`Failed to update task: ${error.message}`);
    }
  }

  _formatPriority(priority) {
    return TaskTrackerUtils.formatPriority(priority);
  }

  _formatDate(dateString) {
    return TaskTrackerUtils.formatDate(dateString);
  }

  _formatDueDate(dueDateString) {
    return TaskTrackerUtils.formatDueDate(dueDateString);
  }

  _formatDuration(minutes) {
    return TaskTrackerUtils.formatDuration(minutes);
  }

  _render() {
    const username = this._getCurrentUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerUtils.getCommonCardStyles()}
      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Available Tasks</h3>
            <button class="refresh-btn" title="Refresh tasks">
              <ha-icon icon="mdi:refresh"></ha-icon>
            </button>
            ${this._refreshing ? '<div class="refreshing-indicator"></div>' : ''}
          </div>
        ` : ''}

        ${!hasValidUserConfig ? `
          <div class="no-user-warning">
            No user configured. Please set user in card configuration.
          </div>
        ` : this._renderContent()}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._fetchAvailableTasks());
    }

    if (hasValidUserConfig) {
      // Task item click handlers
      const taskItems = this.shadowRoot.querySelectorAll('.task-item');
      taskItems.forEach((item) => {
        item.addEventListener('click', () => {
          const taskData = JSON.parse(item.dataset.taskData);
          if (taskData) {
            this._showTaskModal(taskData);
          }
        });
      });

      // Complete button click handlers
      const completeButtons = this.shadowRoot.querySelectorAll('.complete-btn');
      completeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling to parent task item
          const taskData = JSON.parse(button.dataset.taskData);
          if (taskData) {
            this._completeTask(taskData, '');
          }
        });
      });
    }
  }

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
    const priority = this._formatPriority(task.priority);
    const dueDate = this._formatDueDate(task.due_date);
    const duration = this._formatDuration(task.duration_minutes);

    // Build metadata line with pipes
    const metadataParts = [];
    if (duration) metadataParts.push(duration);
    metadataParts.push(priority);
    metadataParts.push(dueDate);

    // Calculate overdue color
    const daysOverdue = TaskTrackerUtils.calculateDaysOverdue(task.due_date);
    const overdueColor = TaskTrackerUtils.getOverdueColor(daysOverdue);
    const borderStyle = overdueColor ? `border-left: 2px solid ${overdueColor} !important;` : '';

    return `
      <div class="task-item ${task.is_overdue ? 'needs-completion' : ''}" data-task-data='${JSON.stringify(task)}' style="${borderStyle}">
        <div class="task-content">
          <div class="task-name">${task.name}</div>
          <div class="task-metadata">${metadataParts.join(' | ')}</div>
        </div>
        ${this._config.show_completion_actions ? `
          <div class="task-actions">
            <button class="complete-btn" data-task-data='${JSON.stringify(task)}'>
              Complete
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  getCardSize() {
    return Math.min(4, Math.max(1, Math.ceil(this._tasks.length / 5)));
  }

  _setupEventListeners() {
    // Clean up any existing listener
    if (this._eventCleanup) {
      this._eventCleanup().catch(error => {
        // Suppress "not_found" errors which are common during dashboard editing
        if (error?.code !== 'not_found') {
          console.warn('Error cleaning up existing TaskTracker event listener:', error);
        }
      });
      this._eventCleanup = null;
    }

    // Set up listeners for both task completions and task creations
    const completionCleanup = TaskTrackerUtils.setupTaskCompletionListener(
      this._hass,
      (eventData) => {
        const shouldRefresh = this._shouldRefreshForUser(eventData.username);
        if (shouldRefresh) {
          setTimeout(() => {
            this._fetchAvailableTasks();
          }, 500);
        }
      }
    );

    const creationCleanup = TaskTrackerUtils.setupTaskCreationListener(
      this._hass,
      (eventData) => {
        const shouldRefresh = this._shouldRefreshForUser(eventData.assigned_to);
        if (shouldRefresh) {
          setTimeout(() => {
            this._fetchAvailableTasks();
          }, 500);
        }
      }
    );

    const updateCleanup = TaskTrackerUtils.setupTaskUpdateListener(
      this._hass,
      (eventData) => {
        // Refresh when any task is updated as it may change availability
        setTimeout(() => {
          this._fetchAvailableTasks();
        }, 500);
      }
    );

    const completionDeletionCleanup = TaskTrackerUtils.setupCompletionDeletionListener(
      this._hass,
      (eventData) => {
        // Refresh when any completion is deleted as it may affect task availability
        setTimeout(() => {
          this._fetchAvailableTasks();
        }, 500);
      }
    );

    // Combined cleanup function
    this._eventCleanup = async () => {
      await Promise.all([
        completionCleanup().catch(err => err.code !== 'not_found' && console.warn('Completion cleanup error:', err)),
        creationCleanup().catch(err => err.code !== 'not_found' && console.warn('Creation cleanup error:', err)),
        updateCleanup().catch(err => err.code !== 'not_found' && console.warn('Update cleanup error:', err)),
        completionDeletionCleanup().catch(err => err.code !== 'not_found' && console.warn('Completion deletion cleanup error:', err))
      ]);
    };
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

class TaskTrackerAvailableTasksCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._debounceTimers = {};
  }

  setConfig(config) {
    this._config = { ...TaskTrackerAvailableTasksCard.getStubConfig(), ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  configChanged(newConfig) {
    const event = new Event('config-changed', {
      bubbles: true,
      composed: true,
    });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }

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
      if (input.type === 'text') {
        input.addEventListener('input', this._valueChanged.bind(this));
      }
    });
  }

  _valueChanged(ev) {
    TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
  }

  _updateConfig(configKey, value) {
    // Update config
    this._config = {
      ...this._config,
      [configKey]: value
    };

    // If user_filter_mode changed, re-render to show/hide explicit user field
    if (configKey === 'user_filter_mode') {
      this._render();
    }

    this.configChanged(this._config);
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