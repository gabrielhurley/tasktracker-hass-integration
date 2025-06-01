/**
 * TaskTracker Available Tasks Card
 *
 * A custom Lovelace card for displaying available tasks:
 * - Shows overdue and upcoming tasks
 * - Visual emphasis for overdue items
 * - Quick completion actions
 * - Real-time API integration for task availability
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

    this._refreshInterval = setInterval(() => {
      this._fetchAvailableTasks();
    }, this._config.refresh_interval * 1000);
  }

  _getCurrentUsername() {
    switch (this._config.user_filter_mode) {
      case 'explicit':
        return this._config.explicit_user;

      case 'current':
        // Try to detect current user
        if (this._hass.user && this._hass.user.name) {
          // Basic mapping - in real implementation this would use the integration's user mapping
          return this._hass.user.name.toLowerCase();
        }
        return null;

      case 'all':
      default:
        return null; // No username filter
    }
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
        params.username = username;
      }

      const response = await this._hass.callService('tasktracker', 'get_available_tasks', params, {}, true, true);

      let newTasks = [];
      if (response && response.response) {
        newTasks = (response.response.available_tasks || []).slice(0, this._config.max_tasks);
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
    if (tasks1.length !== tasks2.length) return false;

    for (let i = 0; i < tasks1.length; i++) {
      const t1 = tasks1[i];
      const t2 = tasks2[i];

      if (t1.name !== t2.name ||
        t1.due_date !== t2.due_date ||
        t1.priority !== t2.priority ||
        t1.duration_minutes !== t2.duration_minutes) {
        return false;
      }
    }

    return true;
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

  async _completeTask(task) {
    try {
      const response = await this._hass.callService('tasktracker', 'complete_task_by_name', {
        name: task.name,
        notes: `Completed via available tasks card`
      }, {}, true, true);

      if (response && response.response) {
        this._showSuccess(`Task "${task.name}" completed successfully`);
      } else {
        this._showError(`Failed to complete task: ${response.error || 'Unknown error'}`);
      }

      // Refresh tasks after completion
      setTimeout(() => {
        this._fetchAvailableTasks();
      }, 1000);

    } catch (error) {
      console.error('Failed to complete task:', error);
      this._showError(`Failed to complete task: ${error.message}`);
    }
  }

  _formatDueDate(dueDateString) {
    try {
      const dueDate = new Date(dueDateString);
      const now = new Date();
      const diffMs = dueDate - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (diffMs < 0) {
        // Overdue
        const overdueDays = Math.abs(diffDays);
        if (overdueDays === 0) {
          return 'Today';
        } else if (overdueDays === 1) {
          return '1 day ago';
        } else {
          return `${overdueDays} days ago`;
        }
      } else if (diffDays === 0) {
        // Due today
        return diffHours > 0 ? `${diffHours}h` : 'Now';
      } else if (diffDays === 1) {
        return 'Tomorrow';
      } else {
        return `${diffDays} days`;
      }
    } catch {
      return 'Unknown';
    }
  }

  _formatDuration(minutes) {
    if (!minutes) return '';

    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  }

  _formatPriority(priority) {
    const priorityStringMap = {
      'High': 1,
      'Medium': 2,
      'Low': 3
    }

    const priorityMap = {
      3: { text: 'Low', class: 'priority-low' },
      2: { text: 'Medium', class: 'priority-medium' },
      1: { text: 'High', class: 'priority-high' },
    };

    if (priority in priorityStringMap) {
      return priorityMap[priorityStringMap[priority]];
    } else {
      return priorityMap[priority] || { text: 'Unknown', class: 'priority-unknown' };
    }
  }

  _showSuccess(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--primary-color);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      font-size: 0.9em;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  _showError(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--secondary-text-color);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      font-size: 0.9em;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 5000);
  }

  _render() {
    const { overdue, upcoming } = this._config.highlight_overdue
      ? this._categorizeTasksByStatus(this._tasks)
      : { overdue: [], upcoming: this._tasks };

    this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .card {
          background: var(--card-background-color);
          border-radius: 4px;
          padding: 16px;
          box-shadow: var(--ha-card-box-shadow);
          font-family: var(--primary-font-family);
          border: 1px solid var(--divider-color);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--divider-color);
          position: relative;
        }

        .title {
          font-size: 1.1em;
          font-weight: 500;
          color: var(--primary-text-color);
          margin: 0;
        }

        .refresh-btn {
          background: none;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          padding: 6px;
          cursor: pointer;
          color: var(--secondary-text-color);
        }

        .refresh-btn:hover {
          background: var(--secondary-background-color);
        }

        .loading, .error, .no-tasks {
          text-align: center;
          padding: 24px 0;
          color: var(--secondary-text-color);
          font-size: 0.9em;
        }

        .error {
          color: var(--primary-text-color);
          background: var(--secondary-background-color);
          padding: 12px;
          border-radius: 4px;
          border: 1px solid var(--divider-color);
        }

        .no-tasks {
          color: var(--secondary-text-color);
        }

        .category {
          margin-bottom: 16px;
        }

        .category:last-child {
          margin-bottom: 0;
        }

        .category-title {
          font-size: 0.9em;
          font-weight: 600;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--divider-color);
          color: var(--primary-text-color);
          letter-spacing: 0.5px;
        }

        .task-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 4px;
          background: var(--secondary-background-color);
          border-radius: 4px;
          border-left: 2px solid var(--divider-color);
        }

        .task-item:hover {
          background: var(--divider-color);
        }

        .task-item:last-child {
          margin-bottom: 0;
        }

        .task-item.overdue {
          border-left-color: var(--primary-color);
        }

        .task-content {
          flex: 1;
          min-width: 0;
        }

        .task-name {
          font-weight: 500;
          color: var(--primary-text-color);
          font-size: 0.95em;
          margin-bottom: 2px;
          word-wrap: break-word;
        }

        .task-metadata {
          font-size: 0.8em;
          color: var(--secondary-text-color);
        }

        .task-actions {
          display: flex;
          gap: 8px;
          margin-left: 12px;
        }

        .complete-btn {
          background: transparent;
          color: var(--secondary-text-color);
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 0.8em;
          cursor: pointer;
          min-width: 44px;
          min-height: 32px;
        }

        .complete-btn:hover {
          background: var(--secondary-background-color);
          border-color: var(--primary-text-color);
        }

        .refreshing-indicator {
          position: absolute;
          top: 0;
          right: 0;
          width: 2px;
          height: 100%;
          background: var(--primary-color);
          opacity: 0.6;
          animation: pulse 1s infinite;
        }

        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      </style>

      <div class="card">
        <div class="header">
          <h3 class="title">Available Tasks</h3>
          <button class="refresh-btn" title="Refresh tasks">
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>
          ${this._refreshing ? '<div class="refreshing-indicator"></div>' : ''}
        </div>

        ${this._renderContent(overdue, upcoming)}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._fetchAvailableTasks());
    }

    // Complete button event listeners
    const completeBtns = this.shadowRoot.querySelectorAll('.complete-btn');
    completeBtns.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const taskIndex = parseInt(btn.dataset.taskIndex);
        const task = this._tasks[taskIndex];
        if (task) {
          this._completeTask(task);
        }
      });
    });
  }

  _renderContent(overdue, upcoming) {
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
      if (overdue.length > 0) {
        content += `
          <div class="category category-overdue">
            <div class="category-title">Overdue</div>
            ${overdue.map((task, index) => this._renderTaskItem(task, this._tasks.indexOf(task), true)).join('')}
          </div>
        `;
      }

      if (upcoming.length > 0) {
        content += `
          <div class="category category-upcoming">
            <div class="category-title">Upcoming</div>
            ${upcoming.map((task, index) => this._renderTaskItem(task, this._tasks.indexOf(task), false)).join('')}
          </div>
        `;
      }
    } else {
      // Show all tasks without categorization
      content = this._tasks.map((task, index) => this._renderTaskItem(task, index, false)).join('');
    }

    return content;
  }

  _renderTaskItem(task, originalIndex, isOverdue) {
    const priority = this._formatPriority(task.priority);
    const dueDate = this._formatDueDate(task.due_date);
    const duration = this._formatDuration(task.duration_minutes);

    // Build metadata line with pipes
    const metadataParts = [];
    metadataParts.push(priority.text);
    if (duration) metadataParts.push(duration);
    metadataParts.push(dueDate);

    return `
      <div class="task-item ${isOverdue ? 'overdue' : 'upcoming'}">
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
    this._debounceTimers = {}; // Store debounce timers for different fields
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
        .card-config {
          display: flex;
          flex-direction: column;
          gap: 16px;
          padding: 16px;
        }

        .config-row {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 16px;
        }

        .config-row label {
          flex: 1;
          font-weight: 500;
          color: var(--primary-text-color);
        }

        .config-row input, .config-row select {
          flex: 0 0 auto;
          min-width: 120px;
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-family: inherit;
        }

        .config-row input[type="checkbox"] {
          min-width: auto;
          width: 20px;
          height: 20px;
        }

        .config-row input[type="number"] {
          width: 80px;
        }

        .config-description {
          font-size: 0.85em;
          color: var(--secondary-text-color);
          margin-top: 4px;
          font-style: italic;
        }

        .section-title {
          font-size: 1.1em;
          font-weight: 600;
          color: var(--primary-text-color);
          margin-top: 16px;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--divider-color);
        }

        .section-title:first-child {
          margin-top: 0;
        }
      </style>

      <div class="card-config">
        <div class="section-title">Display Settings</div>

        <div class="config-row">
          <label>
            Upcoming Days
            <div class="config-description">Number of days ahead to show upcoming tasks</div>
          </label>
          <input
            type="number"
            min="1"
            max="30"
            value="${this._config.upcoming_days}"
            data-config-key="upcoming_days"
          />
        </div>

        <div class="config-row">
          <label>
            Maximum Tasks
            <div class="config-description">Maximum number of tasks to display</div>
          </label>
          <input
            type="number"
            min="5"
            max="100"
            value="${this._config.max_tasks}"
            data-config-key="max_tasks"
          />
        </div>

        <div class="config-row">
          <label>
            Separate Overdue Tasks
            <div class="config-description">Separate and emphasize overdue tasks</div>
          </label>
          <input
            type="checkbox"
            ${this._config.highlight_overdue ? 'checked' : ''}
            data-config-key="highlight_overdue"
          />
        </div>

        <div class="config-row">
          <label>
            Show Completion Actions
            <div class="config-description">Display quick completion buttons for tasks</div>
          </label>
          <input
            type="checkbox"
            ${this._config.show_completion_actions ? 'checked' : ''}
            data-config-key="show_completion_actions"
          />
        </div>

        <div class="section-title">Behavior Settings</div>

        <div class="config-row">
          <label>
            Refresh Interval (seconds)
            <div class="config-description">How often to automatically refresh task data</div>
          </label>
          <input
            type="number"
            min="10"
            max="3600"
            step="10"
            value="${this._config.refresh_interval}"
            data-config-key="refresh_interval"
          />
        </div>

        <div class="config-row">
          <label>
            User Filter Mode
            <div class="config-description">How to filter tasks by user</div>
          </label>
          <select data-config-key="user_filter_mode">
            <option value="all" ${this._config.user_filter_mode === 'all' ? 'selected' : ''}>All Users</option>
            <option value="current" ${this._config.user_filter_mode === 'current' ? 'selected' : ''}>Current User</option>
            <option value="explicit" ${this._config.user_filter_mode === 'explicit' ? 'selected' : ''}>Specific User</option>
          </select>
        </div>

        ${this._config.user_filter_mode === 'explicit' ? `
        <div class="config-row">
          <label>
            Username
            <div class="config-description">Specific username to filter tasks for</div>
          </label>
          <input
            type="text"
            value="${this._config.explicit_user || ''}"
            data-config-key="explicit_user"
            placeholder="Enter username"
          />
        </div>
        ` : ''}
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
    if (!this._config || !this._hass) {
      return;
    }

    const target = ev.target;
    const configKey = target.dataset.configKey;

    if (!configKey) {
      return;
    }

    let value;
    if (target.type === 'checkbox') {
      value = target.checked;
    } else if (target.type === 'number') {
      value = parseInt(target.value, 10);
    } else {
      value = target.value || null;
    }

    // Handle empty string for optional fields
    if ((configKey === 'explicit_user' || configKey === 'user') && value === '') {
      value = null;
    }

    // For text inputs, debounce the config update to avoid frequent API calls
    if (target.type === 'text') {
      // Clear any existing timer for this field
      if (this._debounceTimers[configKey]) {
        clearTimeout(this._debounceTimers[configKey]);
      }

      // Set a new timer to update config after user stops typing
      this._debounceTimers[configKey] = setTimeout(() => {
        this._updateConfig(configKey, value);
        delete this._debounceTimers[configKey];
      }, 500); // Wait 500ms after user stops typing
    } else {
      // For non-text inputs (checkboxes, selects, numbers), update immediately
      this._updateConfig(configKey, value);
    }
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