import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';
import { TaskTrackerDateTime } from './utils/datetime-utils.js';
import { TaskTrackerTasksBaseCard } from './utils/task-cards-base.js';
import { TaskTrackerTaskEditor } from './utils/ui/task-editor.js';
import { TaskTrackerBaseEditor } from './utils/base-config-editor.js';

/**
 * TaskTracker Recommended Tasks Card
 *
 * A custom Lovelace card for displaying recommended tasks:
 * - Time slider for available minutes
 * - List of recommended tasks based on time
 * - Modal popup for task details and completion
 * - Real-time API integration for task recommendations
 */

class TaskTrackerRecommendedTasksCard extends TaskTrackerTasksBaseCard {
  constructor() {
    super();
    this._config = {};
    this._hass = null;
    this._tasks = [];
    this._userContext = null;
    this._availableUsers = [];
    this._enhancedUsers = []; // Track enhanced user mappings
    this._availableMinutes = 30;
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._default_minutes = 60;
    this._default_refresh_interval = 300;
    this._default_max_tasks = 3;
    this._eventCleanup = null; // Store event listener cleanup function
  }

  static getConfigElement() {
    return document.createElement('tasktracker-recommended-tasks-card-editor');
  }

  // Hooks consumed by TaskTrackerTasksBaseCard
  onAfterComplete() { this._fetchRecommendedTasks(); }
  onAfterUpdate() { this._fetchRecommendedTasks(); }
  onAfterSnooze() { this._fetchRecommendedTasks(); }

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
    super.hass = hass;
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

  onHassFirstRun() { this._fetchRecommendedTasks(); this._setupEventListeners(); }

  _getCurrentUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
  }

  // _fetchAvailableUsers inherited from TaskTrackerTasksBaseCard

  async _fetchRecommendedTasks() {
    await this._fetchAvailableUsers();

    const username = this._getCurrentUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    if (!hasValidUserConfig) {
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
      const serviceData = {
        available_minutes: this._availableMinutes
      };

      // Only include username if provided
      // If null, let backend handle user mapping via call context
      if (username) {
        serviceData.username = username;
      }

      const response = await this._hass.callService('tasktracker', 'get_recommended_tasks', serviceData, {}, true, true);

      let newTasks = [];
      if (response && response.response && response.response.data && response.response.data.items) {
        newTasks = response.response.data.items.slice(0, this._config.max_tasks);
        // Capture user context from API response for timezone-aware formatting
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

  async _completeTask(task, notes, completed_at = null, buttonElement = null) { await super._completeTask(task, notes, completed_at, buttonElement); }

  async _saveTask(task, updates) {
    await super._saveTask(task, updates);
  }

  async _snoozeTask(task, snoozeUntil) {
    await super._snoozeTask(task, snoozeUntil);
  }

  _formatPriority(priority) {
    return TaskTrackerUtils.formatPriority(priority);
  }

  _formatDate(dateString) {
    return TaskTrackerUtils.formatDate(dateString);
  }

  _formatDueDate(dueDateString, task = null) {
    return TaskTrackerUtils.formatDueDate(dueDateString, this._userContext, task);
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
        ` : `
          <div class="tt-ds-slider-row tt-mb-16">
            <div class="tt-ds-slider-label">Available Time</div>
            <div class="tt-ds-slider-container">
              <input
                type="range"
                class="tt-ds-range time-slider"
                min="5"
                max="180"
                step="5"
                value="${this._availableMinutes}"
              />
            </div>
            <div class="tt-ds-slider-value">${this._availableMinutes} min</div>
          </div>

          ${this._renderContent()}
        `}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this._fetchRecommendedTasks());

    if (hasValidUserConfig) {
    const slider = this.shadowRoot.querySelector('.tt-ds-range');
    const timeValue = this.shadowRoot.querySelector('.tt-ds-slider-value');

      if (slider) {
        slider.addEventListener('input', (e) => {
          this._availableMinutes = parseInt(e.target.value);
          timeValue.textContent = `${this._availableMinutes} min`;
        });

        slider.addEventListener('change', () => {
          this._fetchRecommendedTasks();
        });
      }

      // Setup task click handlers using the base class helper
      this.setupTaskClickHandlers(
        (task, taskType) => {
          this._showTaskModal(task);
        },
        (task, taskType, button) => {
          this._completeTask(task, '', null, button);
        }
      );
    }
  }

  // Base header integration
  getCardTitle() {
    const username = this._getCurrentUsername();
    return `Tasks for ${username ? TaskTrackerUtils.capitalize(username) : 'Current User'}`;
  }
  getHeaderStatusHTML() {
    return this._refreshing ? '<div class="refreshing-indicator"></div>' : '';
  }
  onAutoRefresh() { this._fetchRecommendedTasks(); }
  onRefresh() { this._fetchRecommendedTasks(); }

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
    return this.renderSimpleTaskRow(task, { showActions: false });
  }

  getCardSize() {
    return Math.min(4, Math.max(2, Math.ceil(this._tasks.length / 3) + 1));
  }

  _setupEventListeners() {
    const cleanups = [];

    cleanups.push(
      TaskTrackerUtils.setupTaskCompletionListener(this._hass, (eventData) => {
        const currentUsername = this._getCurrentUsername();
        if (currentUsername && eventData.username === currentUsername) {
          setTimeout(() => this._fetchRecommendedTasks(), 500);
        }
      })
    );

    cleanups.push(
      TaskTrackerUtils.setupTaskCreationListener(this._hass, (eventData) => {
        const currentUsername = this._getCurrentUsername();
        if (currentUsername && eventData.assigned_users && eventData.assigned_users.includes(currentUsername)) {
          setTimeout(() => this._fetchRecommendedTasks(), 500);
        }
      })
    );

    cleanups.push(
      TaskTrackerUtils.setupTaskUpdateListener(this._hass, () => {
        setTimeout(() => this._fetchRecommendedTasks(), 500);
      })
    );
    // Deletions also come through the same update event

    cleanups.push(
      TaskTrackerUtils.setupCompletionDeletionListener(this._hass, () => {
        setTimeout(() => this._fetchRecommendedTasks(), 500);
      })
    );

    this.setEventCleanups(cleanups);
  }
}

class TaskTrackerRecommendedTasksCardEditor extends TaskTrackerBaseEditor {
  constructor() {
    super();
    this._debounceTimers = {}; // Store debounce timers for different fields
  }

  getDefaultConfig() { return { ...TaskTrackerRecommendedTasksCard.getStubConfig() }; }

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