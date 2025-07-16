import { TaskTrackerUtils } from './tasktracker-utils.js';

/**
 * TaskTracker Daily Plan Card
 *
 * Displays self-care tasks and tasks from the /api/daily-plan endpoint.
 */
class TaskTrackerDailyPlanCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._plan = null;
    this._loading = false;
    this._error = null;
    this._availableUsers = [];
    this._enhancedUsers = [];
    this._refreshInterval = null;
    this._eventCleanup = null;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-daily-plan-card-editor');
  }

  static getStubConfig() {
    return {
      available_minutes: 60,
      user_filter_mode: 'explicit',
      explicit_user: null,
      show_notification: true,
      show_header: true,
      show_completion_actions: true,
      show_completion_notes: true,
      refresh_interval: 600,
    };
  }

  setConfig(config) {
    this._config = {
      available_minutes: config.available_minutes || 60,
      user_filter_mode: config.user_filter_mode || 'explicit',
      explicit_user: config.explicit_user || null,
      show_notification: config.show_notification !== false,
      show_header: config.show_header !== false,
      show_completion_actions: config.show_completion_actions !== false,
      show_completion_notes: config.show_completion_notes !== false,
      refresh_interval: config.refresh_interval || 600,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    const firstRun = this._hass === null;
    this._hass = hass;

    if (firstRun) {
      this._fetchPlan();
      this._setupAutoRefresh();
      this._setupEventListeners();
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
      this._eventCleanup().catch(() => {});
    }
  }

  _setupAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }
    this._refreshInterval = TaskTrackerUtils.setupAutoRefresh(() => {
      this._fetchPlan();
    }, this._config.refresh_interval);
  }

  async _fetchAvailableUsers() {
    this._availableUsers = await TaskTrackerUtils.getAvailableUsers(this._hass);
    this._enhancedUsers = await TaskTrackerUtils.getEnhancedUsers(this._hass);
  }

  _getUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
  }

  async _fetchPlan() {
    this._loading = true;
    this._error = null;
    this._render();

    await this._fetchAvailableUsers();
    const username = this._getUsername();

    const serviceData = {
      available_minutes: this._config.available_minutes,
    };
    if (username) {
      serviceData.username = username;
    }

    try {
      const response = await this._hass.callService('tasktracker', 'get_daily_plan', serviceData, {}, true, true);
      if (response && response.response) {
        this._plan = response.response;
      } else {
        this._plan = null;
      }
    } catch (err) {
      console.error('Failed to fetch daily plan:', err);
      this._error = err.message;
      this._plan = null;
    }

    this._loading = false;
    this._render();
  }

  _setupEventListeners() {
    // Clean up any existing listener
    if (this._eventCleanup) {
      this._eventCleanup().catch(() => {});
    }

    // Listen for daily plan events to refresh
    const dailyPlanCleanup = TaskTrackerUtils.setupEventListener(this._hass, 'tasktracker_daily_plan', (event) => {
      const evUsername = event?.data?.username;
      const username = this._getUsername();
      if (!username || username === evUsername) {
        this._plan = event.data.plan;
        this._render();
      }
    });

    // Listen for task completion events to refresh the plan
    const completionCleanup = TaskTrackerUtils.setupTaskCompletionListener(this._hass, (eventData) => {
      const currentUsername = this._getUsername();
      if (!currentUsername || currentUsername === eventData.username) {
        setTimeout(() => {
          this._fetchPlan();
        }, 500);
      }
    });

    // Listen for mood update events to refresh the plan
    const moodUpdateCleanup = TaskTrackerUtils.setupEventListener(this._hass, 'mood_set', (event) => {
      const evUsername = event?.username;
      const username = this._getUsername();
      if (!username || username === evUsername) {
        setTimeout(() => {
          this._fetchPlan();
        }, 500);
      }
    });

    // Combined cleanup function
    this._eventCleanup = async () => {
      await Promise.all([
        dailyPlanCleanup().catch(() => {}),
        completionCleanup().catch(() => {}),
        moodUpdateCleanup().catch(() => {})
      ]);
    };
  }

  _showTaskModal(task, taskType) {
    const modal = TaskTrackerUtils.createTaskModal(
      task,
      this._config,
      async (notes) => {
        await this._completeTask(task, notes);
      },
      null, // No save functionality for daily plan tasks
      this._availableUsers,
      this._enhancedUsers
    );
    TaskTrackerUtils.showModal(modal);
  }

  _handleSetDailyState() {
    const username = this._getUsername();
    if (!username) {
      TaskTrackerUtils.showError('No user configured for daily state');
      return;
    }

    const modal = TaskTrackerUtils.createDailyStateModal(
      this._hass,
      username,
      {
        use_emoji_labels: true // Use emoji labels by default
      },
      (savedState) => {
        // Callback when state is saved - refresh the plan
        setTimeout(() => {
          this._fetchPlan();
        }, 500);
      }
    );

    TaskTrackerUtils.showModal(modal);
  }

  async _completeTask(task, notes) {
    const username = TaskTrackerUtils.getUsernameForAction(this._config, this._hass, this._availableUsers);

    // For 'current' user mode, username will be null and that's expected
    // The backend will handle user mapping via call context
    if (username === null && this._config.user_filter_mode !== 'current') {
      TaskTrackerUtils.showError('No user configured for task completion');
      return;
    }

    try {
      const response = await TaskTrackerUtils.completeTask(this._hass, task.name, username, notes);

      if (response && response.success) {
        TaskTrackerUtils.showSuccess(response.spoken_response || `Task "${task.name}" completed successfully`);
      } else {
        const errorMsg = (response && response.message) || 'Unknown error';
        TaskTrackerUtils.showError(`Failed to complete task: ${errorMsg}`);
      }

      // Refresh plan after completion
      setTimeout(() => {
        this._fetchPlan();
      }, 100);

    } catch (error) {
      console.error('Failed to complete task:', error);
      TaskTrackerUtils.showError(`Failed to complete task: ${error.message}`);
    }
  }

  _render() {
    if (!this.shadowRoot) return;

    const username = this._getUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerUtils.getCommonCardStyles()}
        .section-title {
          font-weight: 600;
          margin: 16px 0 8px 0;
          color: var(--primary-text-color);
        }
        .section-title:first-child {
          margin-top: 0;
        }
        .section-title.urgent {
          color: var(--error-color, #f44336);
          font-size: 1.1em;
        }
        .task-list {
          margin-bottom: 16px;
        }
        .task-list:last-child {
          margin-bottom: 0;
        }
        .debug {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          margin-top: 8px;
          padding: 8px;
          background: var(--secondary-background-color);
          border-radius: 4px;
        }
        .notification-focus {
          background: var(--card-background-color);
          color: var(--primary-text-color);
          padding: 12px;
          border-radius: 4px;
          margin-bottom: 16px;
          font-weight: 500;
          border: 1px solid rgba(76, 175, 80, 0.3);
        }

        /* Daily state prompt styles */
        .daily-state-prompt {
          margin-bottom: 16px;
        }

        .daily-state-button {
          background: var(--primary-color);
          color: var(--text-primary-color);
          border: none;
          border-radius: 6px;
          padding: 10px 16px;
          font-size: 0.95em;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s ease;
          width: 100%;
          text-align: center;
        }

        .daily-state-button:hover {
          opacity: 0.9;
        }

        .daily-state-help {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          font-style: italic;
          text-align: center;
          margin-top: 8px;
        }

        /* Urgent section styles */
        .urgent-section {
          margin-top: 16px;
        }

        .urgent-description {
          color: var(--secondary-text-color);
          font-size: 0.9em;
          margin-bottom: 12px;
          font-style: italic;
        }

        /* All caught up styles */
        .all-caught-up {
          text-align: center;
          padding: 8px;
          color: var(--secondary-text-color);
          font-size: 0.9em;
        }

        .no-urgent-tasks {
          text-align: center;
          padding: 20px;
          color: var(--secondary-text-color);
          font-style: italic;
        }
      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Daily Plan ${username ? `- ${TaskTrackerUtils.capitalize(username)}` : ''}</h3>
            <button class="refresh-btn" title="Refresh daily plan">
              <ha-icon icon="mdi:refresh"></ha-icon>
            </button>
          </div>
        ` : ''}

        ${this._renderContent()}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._fetchPlan());
    }

    // Daily state button handler
    const dailyStateButton = this.shadowRoot.querySelector('.daily-state-button');
    if (dailyStateButton) {
      dailyStateButton.addEventListener('click', () => this._handleSetDailyState());
    }

    if (hasValidUserConfig) {
      // Task item click handlers
      const taskItems = this.shadowRoot.querySelectorAll('.task-item');
      taskItems.forEach((item) => {
        item.addEventListener('click', () => {
          const taskData = JSON.parse(item.dataset.taskData);
          const taskType = item.dataset.taskType;
          if (taskData) {
            this._showTaskModal(taskData, taskType);
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
    if (this._loading) {
      return '<div class="loading">Loading daily plan...</div>';
    }

    if (this._error) {
      return `<div class="error">${this._error}</div>`;
    }

    if (!TaskTrackerUtils.hasValidUserConfig(this._config)) {
      return '<div class="no-user-warning">No user configured. Please set user in card configuration.</div>';
    }

    if (!this._plan) {
      return '<div class="no-tasks">No plan available.</div>';
    }

    const selfCare = this._plan?.data?.self_care || [];
    const tasks = this._plan?.data?.tasks || [];
    const notification = this._plan?.notification || {};
    const usingDefaults = this._plan?.data?.using_defaults || false;

    if (usingDefaults) {
      return this._renderReducedPlan(tasks, notification);
    }

    const selfCareHtml = selfCare.length > 0
      ? selfCare.map(task => this._renderTaskItem(task, 'self_care')).join('')
      : '<div class="no-tasks">None</div>';

    const tasksHtml = tasks.length > 0
      ? tasks.map(task => this._renderTaskItem(task, 'task')).join('')
      : '<div class="no-tasks">None</div>';

    const notificationBodyHtml = notification.body ? `
      <div class="notification-focus">
        ${notification.body}
      </div>
    ` : '';

    return `
      ${notificationBodyHtml}
      <div class="section-title">Self-Care (${this._config.available_minutes} min)</div>
      <div class="task-list">
        ${selfCareHtml}
      </div>
      <div class="section-title">Tasks</div>
      <div class="task-list">
        ${tasksHtml}
      </div>
    `;
  }

  _renderReducedPlan(tasks, notification) {
    const tasksHtml = tasks.length > 0
      ? tasks.map(task => this._renderTaskItem(task, 'task')).join('')
      : '<div class="no-urgent-tasks">No urgent tasks right now!</div>';

    return `
      <div class="daily-state-prompt">
        <button class="daily-state-button">Set Your Daily State</button>
        <div class="daily-state-help">A daily plan will be available once your state is set</div>
      </div>

      ${tasks.length > 0 ? `
        <div class="urgent-section">
          <div class="section-title urgent">⚠️ Urgent Tasks</div>
          <div class="urgent-description">These tasks need immediate attention:</div>
          <div class="task-list">
            ${tasksHtml}
          </div>
        </div>
      ` : `
        <div class="all-caught-up">
          No urgent tasks right now
        </div>
      `}
    `;
  }

  _renderTaskItem(task, taskType) {
    if (!task || !task.name) {
      return '<div class="no-tasks">Invalid task data</div>';
    }

    // Build metadata line with pipes
    const metadataParts = [];

    // Add duration if available
    if (task.duration_minutes) {
      metadataParts.push(TaskTrackerUtils.formatDuration(task.duration_minutes));
    }

    // Add priority if available
    if (task.priority) {
      metadataParts.push(TaskTrackerUtils.formatPriority(task.priority));
    }

    // Add due date if available with user context for smart formatting
    if (task.due_date || task.next_due) {
      const dueDate = task.due_date || task.next_due;
      const userContext = this._plan?.data?.user_context;
      metadataParts.push(TaskTrackerUtils.formatDueDate(dueDate, userContext, task));
    }

    // Calculate overdue color if due date is available
    const dueDate = task.due_date || task.next_due;
    const daysOverdue = dueDate ? TaskTrackerUtils.calculateDaysOverdue(dueDate) : 0;
    const overdueColor = TaskTrackerUtils.getOverdueColor(daysOverdue);
    const borderStyle = overdueColor ? `border-left: 2px solid ${overdueColor} !important;` : '';

    // Determine if task is overdue
    const isOverdue = dueDate && daysOverdue > 0;

    return `
      <div class="task-item ${isOverdue ? 'needs-completion' : ''}"
           data-task-data='${JSON.stringify(task)}'
           data-task-type="${taskType}"
           style="${borderStyle}">
        <div class="task-content">
          <div class="task-name">
            ${task.name}
            ${task.last_completion_notes ? '<div class="completion-indicator" title="Has completion notes"></div>' : ''}
          </div>
          ${metadataParts.length > 0 ? `
            <div class="task-metadata">${metadataParts.join(' | ')}</div>
          ` : ''}
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
    return 3;
  }
}

// Config editor
class TaskTrackerDailyPlanCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...TaskTrackerDailyPlanCard.getStubConfig(), ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _valueChanged(ev) {
    TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
  }

  _updateConfig(configKey, value) {
    this._config = {
      ...this._config,
      [configKey]: value
    };

    // If user_filter_mode changed, re-render to show/hide explicit user field
    if (configKey === 'user_filter_mode') {
      this._render();
    }

    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
  }

  _render() {
    if (!this.shadowRoot) return;

    this.shadowRoot.innerHTML = `
      <style>${TaskTrackerUtils.getCommonConfigStyles()}</style>
      <div class="card-config">
        <div class="section-title">Display Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'Available Minutes',
          'Number of minutes available for self-care tasks',
          TaskTrackerUtils.createNumberInput(this._config.available_minutes, 'available_minutes', 5, 300, 5)
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Show Header',
          'Display card header with title and refresh button',
          TaskTrackerUtils.createCheckboxInput(this._config.show_header, 'show_header')
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Show Completion Actions',
          'Display completion buttons next to tasks',
          TaskTrackerUtils.createCheckboxInput(this._config.show_completion_actions, 'show_completion_actions')
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Show Completion Notes',
          'Display completion notes field in task modal',
          TaskTrackerUtils.createCheckboxInput(this._config.show_completion_notes, 'show_completion_notes')
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Show Notification',
          'Display debug notification information',
          TaskTrackerUtils.createCheckboxInput(this._config.show_notification, 'show_notification')
        )}

        <div class="section-title">User Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'User Filter Mode',
          'How to determine the user for daily plan',
          TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
            { value: 'current', label: 'Current User' },
            { value: 'explicit', label: 'Specific User' }
          ])
        )}

        ${this._config.user_filter_mode === 'explicit' ? TaskTrackerUtils.createConfigRow(
          'Username',
          'Specific username for daily plan',
          TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
        ) : ''}

        <div class="section-title">Behavior Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'Refresh Interval (seconds)',
          'How often to automatically refresh plan data',
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
}

if (!customElements.get('tasktracker-daily-plan-card')) {
  customElements.define('tasktracker-daily-plan-card', TaskTrackerDailyPlanCard);
}
if (!customElements.get('tasktracker-daily-plan-card-editor')) {
  customElements.define('tasktracker-daily-plan-card-editor', TaskTrackerDailyPlanCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === 'tasktracker-daily-plan-card')) {
  window.customCards.push({
    type: 'tasktracker-daily-plan-card',
    name: 'TaskTracker Daily Plan',
    description: 'Displays the daily plan for the user',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}