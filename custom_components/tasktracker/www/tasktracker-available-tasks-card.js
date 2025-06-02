import { TaskTrackerUtils } from './tasktracker-utils.js';

/**
 * TaskTracker Available Tasks Card
 *
 * A custom Lovelace card for displaying available tasks:
 * - Shows all available tasks in a list
 * - Modal popup for task details and completion
 * - Configurable filtering and sorting options
 * - Real-time API integration for task data
 */

class TaskTrackerAvailableTasksCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._tasks = [];
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._default_upcoming_days = 1;
    this._default_refresh_interval = 300;
    this._default_max_tasks = 20;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-available-tasks-card-editor');
  }

  static getStubConfig() {
    return {
      upcoming_days: this._default_upcoming_days,
      highlight_overdue: true,
      show_completion_actions: true,
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
    this._hass = hass;
    this._setupAutoRefresh();
    this._fetchAvailableTasks();
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
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
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass);
  }

  async _fetchAvailableTasks() {
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
    const overdue = [];
    const upcoming = [];

    tasks.forEach(task => {
      if (task.due_date) {
        const dueDate = new Date(task.due_date);
        if (dueDate < now) {
          overdue.push(task);
        } else {
          upcoming.push(task);
        }
      } else {
        upcoming.push(task);
      }
    });

    return { overdue, upcoming };
  }

  _showTaskModal(task, taskIndex) {
    const modal = TaskTrackerUtils.createTaskModal(task, this._config, async (notes) => {
      await this._completeTask(task, notes);
    });
    TaskTrackerUtils.showModal(modal);
  }

  async _completeTask(task, notes) {
    const username = TaskTrackerUtils.getUsernameForAction(this._config, this._hass);

    if (!username) {
      if (this._config.user_filter_mode === 'all') {
        TaskTrackerUtils.showError('Cannot complete task: No user available for completion');
      } else {
        TaskTrackerUtils.showError('No user configured for task completion');
      }
      return;
    }

    try {
      const response = await TaskTrackerUtils.completeTask(this._hass, task.name, username, notes);

      if (response && response.response && response.response.success) {
        TaskTrackerUtils.showSuccess(response.response.spoken_response || `Task "${task.name}" completed successfully`);
      } else {
        const errorMsg = (response && response.response && response.response.message) || 'Unknown error';
        TaskTrackerUtils.showError(`Failed to complete task: ${errorMsg}`);
      }

      // Refresh tasks after completion
      setTimeout(() => {
        this._fetchAvailableTasks();
      }, 1000);

    } catch (error) {
      console.error('Failed to complete task:', error);
      TaskTrackerUtils.showError(`Failed to complete task: ${error.message}`);
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
        <div class="header">
          <h3 class="title">Available Tasks</h3>
          <button class="refresh-btn" title="Refresh tasks">
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>
          ${this._refreshing ? '<div class="refreshing-indicator"></div>' : ''}
        </div>

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
      taskItems.forEach((item, index) => {
        item.addEventListener('click', () => {
          if (this._tasks[index]) {
            this._showTaskModal(this._tasks[index], index);
          }
        });
      });

      // Complete button click handlers
      const completeButtons = this.shadowRoot.querySelectorAll('.complete-btn');
      completeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling to parent task item
          const taskIndex = parseInt(button.dataset.taskIndex, 10);
          if (this._tasks[taskIndex]) {
            this._completeTask(this._tasks[taskIndex], '');
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
      const { overdue, upcoming } = this._categorizeTasksByStatus(this._tasks);
      if (overdue.length > 0) {
        content += `
          <div class="category category-overdue">
            <div class="category-title">Overdue</div>
            ${overdue.map((task, index) => this._renderTaskItem(task, this._tasks.indexOf(task))).join('')}
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
      content = this._tasks.map((task, index) => this._renderTaskItem(task, index)).join('');
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

    return `
      <div class="task-item ${task.is_overdue ? 'needs-completion' : ''}">
        <div class="task-content">
          <div class="task-name">${task.name}</div>
          <div class="task-metadata">${metadataParts.join(' | ')}</div>
        </div>
        ${this._config.show_completion_actions ? `
          <div class="task-actions">
            <button class="complete-btn" data-task-index="${originalIndex}">
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