import { TaskTrackerUtils } from './tasktracker-utils.js';

/**
 * TaskTracker Recommended Tasks Card
 *
 * A custom Lovelace card for displaying recommended tasks:
 * - Time slider for available minutes
 * - List of recommended tasks based on time
 * - Modal popup for task details and completion
 * - Real-time API integration for task recommendations
 */

class TaskTrackerRecommendedTasksCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._tasks = [];
    this._availableMinutes = 60;
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._default_minutes = 60;
    this._default_refresh_interval = 300;
    this._default_max_tasks = 3;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-recommended-tasks-card-editor');
  }

  static getStubConfig() {
    return {
      user: null,
      default_minutes: this._default_minutes,
      show_completion_notes: true,
      show_header: true,
      refresh_interval: this._default_refresh_interval,
      max_tasks: this._default_max_tasks,
      user_filter_mode: 'explicit', // 'current', 'explicit'
      explicit_user: null
    };
  }

  setConfig(config) {
    this._config = {
      user: config.user || null, // Legacy support
      default_minutes: config.default_minutes || this._default_minutes,
      show_completion_notes: config.show_completion_notes !== false,
      show_header: config.show_header !== false,
      refresh_interval: config.refresh_interval || this._default_refresh_interval, // seconds
      max_tasks: config.max_tasks || this._default_max_tasks,
      user_filter_mode: config.user_filter_mode || 'explicit',
      explicit_user: config.explicit_user || null,
      ...config
    };

    // Migrate legacy user config to new format
    if (this._config.user && !config.user_filter_mode) {
      this._config.user_filter_mode = 'explicit';
      this._config.explicit_user = this._config.user;
    }

    this._availableMinutes = this._config.default_minutes;
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._setupAutoRefresh();
    this._fetchRecommendedTasks();
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
      this._fetchRecommendedTasks();
    }, this._config.refresh_interval);
  }

  _getCurrentUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass);
  }

  async _fetchRecommendedTasks() {
    const username = this._getCurrentUsername();
    if (!username) {
      this._error = "No user configured. Please set user in card configuration.";
      this._tasks = [];
      this._loading = false;
      this._refreshing = false;
      this._initialLoad = false;
      this._render();
      return;
    }

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
      const response = await this._hass.callService('tasktracker', 'get_recommended_tasks', {
        assigned_to: username,
        available_minutes: this._availableMinutes
      }, {}, true, true);

      let newTasks = [];
      if (response && response.response) {
        newTasks = (response.response.recommended_tasks || []).slice(0, this._config.max_tasks);
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
      console.error('Failed to fetch recommended tasks:', error);
      this._error = `Failed to fetch recommended tasks: ${error.message}`;
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

  _showTaskModal(task, taskIndex) {
    const modal = TaskTrackerUtils.createTaskModal(task, this._config, async (notes) => {
      await this._completeTask(task, notes);
    });
    TaskTrackerUtils.showModal(modal);
  }

  async _completeTask(task, notes) {
    const username = this._getCurrentUsername();
    if (!username) {
      TaskTrackerUtils.showError('No user configured for task completion');
      return;
    }

    try {
      const response = await TaskTrackerUtils.completeTask(this._hass, task.name, username, notes);

      if (response && response.response) {
        TaskTrackerUtils.showSuccess(`Task "${task.name}" completed successfully`);
      } else {
        TaskTrackerUtils.showError(`Failed to complete task: ${response.error || 'Unknown error'}`);
      }

      // Refresh tasks after completion
      setTimeout(() => {
        this._fetchRecommendedTasks();
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

  _render() {
    const username = this._getCurrentUsername();

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerUtils.getCommonCardStyles()}

        .time-control {
          margin-bottom: 16px;
        }

        .time-label {
          display: block;
          margin-bottom: 8px;
          color: var(--primary-text-color);
          font-weight: 500;
          font-size: 0.9em;
        }

        .time-slider-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .time-slider {
          flex: 1;
          height: 4px;
          background: var(--divider-color);
          border-radius: 2px;
          outline: none;
          -webkit-appearance: none;
        }

        .time-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: var(--primary-color);
          border-radius: 50%;
          cursor: pointer;
        }

        .time-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: var(--primary-color);
          border-radius: 50%;
          border: none;
          cursor: pointer;
        }

        .time-value {
          color: var(--primary-text-color);
          font-weight: 500;
          min-width: 60px;
          text-align: right;
          font-size: 0.9em;
        }
      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Tasks for ${TaskTrackerUtils.capitalize(username)}</h3>
            <button class="refresh-btn" title="Refresh tasks">
              <ha-icon icon="mdi:refresh"></ha-icon>
            </button>
            ${this._refreshing ? '<div class="refreshing-indicator"></div>' : ''}
          </div>
        ` : ''}

        ${!username ? `
          <div class="no-user-warning">
            No user configured. Please set user in card configuration.
          </div>
        ` : `
          <div class="time-control">
            <label class="time-label">Available Time</label>
            <div class="time-slider-container">
              <input
                type="range"
                class="time-slider"
                min="5"
                max="180"
                step="5"
                value="${this._availableMinutes}"
              />
              <span class="time-value">${this._availableMinutes} min</span>
            </div>
          </div>

          ${this._renderContent()}
        `}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._fetchRecommendedTasks());
    }

    if (username) {
      const slider = this.shadowRoot.querySelector('.time-slider');
      const timeValue = this.shadowRoot.querySelector('.time-value');

      if (slider) {
        slider.addEventListener('input', (e) => {
          this._availableMinutes = parseInt(e.target.value);
          timeValue.textContent = `${this._availableMinutes} min`;
        });

        slider.addEventListener('change', () => {
          this._fetchRecommendedTasks();
        });
      }

      // Task item click handlers
      const taskItems = this.shadowRoot.querySelectorAll('.task-item');
      taskItems.forEach((item, index) => {
        item.addEventListener('click', () => {
          if (this._tasks[index]) {
            this._showTaskModal(this._tasks[index], index);
          }
        });
      });
    }
  }

  _renderContent() {
    // Only show loading state on initial load
    if (this._loading && this._initialLoad) {
      return '<div class="loading">Loading recommended tasks...</div>';
    }

    if (this._error) {
      return `<div class="error">${this._error}</div>`;
    }

    if (!this._tasks || this._tasks.length === 0) {
      return '<div class="no-tasks">No recommended tasks for the selected time period</div>';
    }

    return this._tasks.map((task, index) => this._renderTaskItem(task, index)).join('');
  }

  _renderTaskItem(task, originalIndex) {
    const priority = this._formatPriority(task.priority);
    const duration = `${task.duration_minutes}m`;

    // Build metadata line with pipes
    const metadataParts = [];
    metadataParts.push(duration);
    metadataParts.push(priority);
    if (task.due_date) {
      metadataParts.push(`${this._formatDueDate(task.due_date)}`);
    }

    return `
      <div class="task-item ${task.is_overdue ? 'needs-completion' : ''}">
        <div class="task-content">
          <div class="task-name">
            ${task.name}
            ${task.last_completion_notes ? '<div class="completion-indicator" title="Has completion notes"></div>' : ''}
          </div>
          <div class="task-metadata">${metadataParts.join(' | ')}</div>
        </div>
      </div>
    `;
  }

  getCardSize() {
    return Math.min(4, Math.max(2, Math.ceil(this._tasks.length / 3) + 1));
  }
}

class TaskTrackerRecommendedTasksCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._debounceTimers = {}; // Store debounce timers for different fields
  }

  setConfig(config) {
    this._config = { ...TaskTrackerRecommendedTasksCard.getStubConfig(), ...config };
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
      'Default Minutes',
      'Default time slider value in minutes',
      TaskTrackerUtils.createNumberInput(this._config.default_minutes, 'default_minutes', 5, 180, 5)
    )}

        ${TaskTrackerUtils.createConfigRow(
      'Maximum Tasks',
      'Maximum number of tasks to display',
      TaskTrackerUtils.createNumberInput(this._config.max_tasks, 'max_tasks', 1, 10)
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
      'How to determine the user for recommendations',
      TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
        { value: 'current', label: 'Current User' },
        { value: 'explicit', label: 'Specific User' }
      ])
    )}

        ${this._config.user_filter_mode === 'explicit' ? TaskTrackerUtils.createConfigRow(
      'Username',
      'Specific username for task recommendations',
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

if (!customElements.get('tasktracker-recommended-tasks-card')) {
  customElements.define('tasktracker-recommended-tasks-card', TaskTrackerRecommendedTasksCard);
}
if (!customElements.get('tasktracker-recommended-tasks-card-editor')) {
  customElements.define('tasktracker-recommended-tasks-card-editor', TaskTrackerRecommendedTasksCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === 'tasktracker-recommended-tasks-card')) {
  window.customCards.push({
    type: 'tasktracker-recommended-tasks-card',
    name: 'TaskTracker Recommended Tasks',
    description: 'Display recommended tasks with time filtering and completion',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}