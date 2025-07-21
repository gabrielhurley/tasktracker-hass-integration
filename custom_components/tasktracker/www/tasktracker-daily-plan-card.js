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
      user_filter_mode: 'explicit',
      explicit_user: null,
      show_header: true,
      show_completion_actions: true,
      show_completion_notes: true,
      show_window_times: true,
      window_display_mode: 'always',
      refresh_interval: 600,
    };
  }

  setConfig(config) {
    this._config = {
      user_filter_mode: config.user_filter_mode || 'explicit',
      explicit_user: config.explicit_user || null,
      show_header: config.show_header !== false,
      show_completion_actions: config.show_completion_actions !== false,
      show_completion_notes: config.show_completion_notes !== false,
      show_window_times: config.show_window_times !== false,
      window_display_mode: config.window_display_mode || 'always',
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

  _shouldShowWindows(windows) {
    switch (this._config.window_display_mode) {
      case 'never':
        return false;
      case 'multiple_only':
        return windows && windows.length > 1;
      case 'always':
      default:
        return true;
    }
  }

  async _fetchPlan() {
    this._loading = true;
    this._error = null;
    this._render();

    await this._fetchAvailableUsers();
    const username = this._getUsername();

    const serviceData = {};
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
      async (notes, completed_at = null) => {
        await this._completeTask(task, notes, completed_at);
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

  async _completeTask(task, notes, completed_at = null) {
    const username = TaskTrackerUtils.getUsernameForAction(this._config, this._hass, this._availableUsers);

    // For 'current' user mode, username will be null and that's expected
    // The backend will handle user mapping via call context
    if (username === null && this._config.user_filter_mode !== 'current') {
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
        .all-done-text {
          font-weight: normal;
          font-size: 0.9em;
          font-style: italic;
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
          color: var(--primary-text-color);
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

        /* Self-care window styles */
        .selfcare-windowed {
          border-radius: 6px;
        }

        .selfcare-windowed.all-complete {
          opacity: 0.8;
          background: rgba(76, 175, 80, 0.1);
        }

        .windows-container {
          margin-top: 8px;
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .window-item {
          display: flex;
          align-items: center;
          gap: 8px;
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 0.9em;
          transition: background-color 0.2s ease;
        }

        .window-item.completed {
          background: rgba(76, 175, 80, 0.15);
          color: var(--primary-text-color);
        }

        .window-item.incomplete {
          background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
          color: var(--primary-text-color);
          cursor: pointer;
        }

        .window-item.incomplete:hover {
          background: var(--divider-color, rgba(0, 0, 0, 0.1));
        }

        .window-item.incomplete:focus {
          outline: 2px solid var(--primary-color);
          outline-offset: 2px;
          background: var(--divider-color, rgba(0, 0, 0, 0.1));
        }

        /* Styling for incomplete windows based on task status */
        .selfcare-windowed.needs-completion.due-today .window-item.incomplete {
          background: rgba(var(--primary-color-rgb, 3, 169, 244), 0.1);
        }

        .selfcare-windowed.needs-completion.due-today .window-item.incomplete:hover {
          background: rgba(var(--primary-color-rgb, 3, 169, 244), 0.2);
        }

        .selfcare-windowed.needs-completion.due-today .window-item.incomplete:focus {
          background: rgba(var(--primary-color-rgb, 3, 169, 244), 0.2);
        }

        /* Overdue styling for incomplete windows */
        .selfcare-windowed.needs-completion.overdue .window-item.incomplete {
          background: rgba(255, 193, 7, 0.1);
        }

        .selfcare-windowed.needs-completion.overdue .window-item.incomplete:hover {
          background: rgba(255, 193, 7, 0.2);
        }

        .selfcare-windowed.needs-completion.overdue .window-item.incomplete:focus {
          background: rgba(255, 193, 7, 0.2);
        }

        /* Fallback for tasks that need completion (legacy support) */
        .selfcare-windowed.needs-completion .window-item.incomplete {
          background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
        }

        .selfcare-windowed.needs-completion .window-item.incomplete:hover {
          background: var(--divider-color, rgba(0, 0, 0, 0.1));
        }

        .selfcare-windowed.needs-completion .window-item.incomplete:focus {
          background: var(--divider-color, rgba(0, 0, 0, 0.1));
        }

        .window-check {
          color: var(--success-color, #4caf50);
          font-weight: bold;
          font-size: 1em;
        }

        .window-opportunity {
          color: var(--secondary-text-color);
          font-size: 1em;
          display: flex;
          align-items: center;
        }

        .window-opportunity ha-icon {
          --mdc-icon-size: 16px;
          color: inherit;
        }

        /* Due today styling for opportunity circle */
        .selfcare-windowed.needs-completion.due-today .window-opportunity {
          color: var(--primary-color);
        }

        /* Overdue styling for opportunity circle */
        .selfcare-windowed.needs-completion.overdue .window-opportunity {
          color: var(--error-color, #f44336);
        }

        .window-label {
          font-weight: 500;
          min-width: 60px;
        }

        .window-time {
          color: var(--secondary-text-color);
          font-size: 0.85em;
          margin-left: auto;
        }

        /* Self-care task without windows */
        .task-item[data-task-type="self_care"]:not(.selfcare-windowed) .task-metadata {
          font-style: italic;
        }

        /* Fix spacing for self-care windowed tasks */
        .selfcare-windowed .task-content {
          padding-right: 0;
        }

        .selfcare-windowed .task-actions {
          margin-top: 8px;
          margin-left: 0; /* Reset margin since we use border + padding now */
          border-left: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
          padding-left: 12px;
          margin-left: 12px;
        }

        /* Full-height complete button styling */
        .task-item {
          display: flex;
          align-items: stretch;
        }

        .task-content {
          flex: 1;
        }

        .task-actions {
          display: flex;
          align-items: stretch;
          border-left: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12));
          padding-left: 12px;
          margin-left: 12px;
        }

        .complete-btn {
          display: flex;
          align-items: center;
          justify-content: center;
          flex: 1;
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

      // Complete button click handlers (generic completion - uses current time)
      const completeButtons = this.shadowRoot.querySelectorAll('.complete-btn');
      completeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling to parent task item
          const taskData = JSON.parse(button.dataset.taskData);
          if (taskData) {
            // Generic completion - backend will determine window assignment based on current time
            this._completeTask(taskData, '');
          }
        });
      });

      // Window item click handlers (window-specific completion with midpoint timestamps)
      const incompleteWindows = this.shadowRoot.querySelectorAll('.window-item.incomplete');
      incompleteWindows.forEach(windowItem => {
        windowItem.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling to parent task item

          // Find the parent task item to get task data
          const taskItem = windowItem.closest('.task-item');
          if (taskItem && taskItem.dataset.taskData) {
            const taskData = JSON.parse(taskItem.dataset.taskData);
            if (taskData && taskData.windows) {
              // Extract window index from the element ID (format: window-taskId-index)
              const windowId = windowItem.id;
              const windowIndexMatch = windowId.match(/window-\d+-(\d+)$/);

              if (windowIndexMatch) {
                const windowIndex = parseInt(windowIndexMatch[1], 10);
                const window = taskData.windows[windowIndex];

                                if (window) {
                  // Calculate the appropriate completion timestamp based on the window
                  const completionTimestamp = this._calculateCompletionTimestamp(window);

                  // Debug logging
                  console.log(`Window completion: ${window.label || 'Window ' + (windowIndex + 1)} (${window.start}-${window.end})`);
                  console.log(`Current time in window: ${this._isCurrentTimeInWindow(window)}`);
                  console.log(`Completion timestamp: ${completionTimestamp || 'current time'}`);

                  // Complete the task with the calculated timestamp
                  this._completeTask(taskData, '', completionTimestamp);
                } else {
                  console.warn('Window not found at index:', windowIndex);
                  // Fallback to generic completion
                  this._completeTask(taskData, '');
                }
              } else {
                console.warn('Could not parse window index from ID:', windowId);
                // Fallback to generic completion
                this._completeTask(taskData, '');
              }
            }
          }
        });

        // Add keyboard support for accessibility
        windowItem.addEventListener('keydown', (e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            e.stopPropagation();
            windowItem.click();
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
      : null;

    const tasksHtml = tasks.length > 0
      ? tasks.map(task => this._renderTaskItem(task, 'task')).join('')
      : null;

    const notificationBodyHtml = notification.body ? `
      <div class="notification-focus">
        ${notification.body}
      </div>
    ` : '';

    // Self-care section - show congratulatory message if no tasks
    const selfCareSection = selfCare.length > 0 ? `
      <div class="section-title">Self-Care</div>
      <div class="task-list">
        ${selfCareHtml}
      </div>
    ` : `
      <div class="section-title">Self-Care <span class="all-done-text">(No tasks)</span></div>
    `;

    // Tasks section - match the self-care empty state pattern
    const tasksSection = tasks.length > 0 ? `
      <div class="section-title">Tasks</div>
      <div class="task-list">
        ${tasksHtml}
      </div>
    ` : `
      <div class="section-title">Tasks <span class="all-done-text">(No tasks)</span></div>
    `;

    return `
      ${notificationBodyHtml}
      ${selfCareSection}
      ${tasksSection}
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

    // Handle self-care tasks with windows differently
    if (taskType === 'self_care' && task.windows && task.windows.length > 0 && this._shouldShowWindows(task.windows)) {
      return this._renderSelfCareTaskWithWindows(task);
    }

    // Build metadata line with pipes for regular tasks and self-care without windows
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

        // Calculate overdue color and status
    // For self-care tasks, use API-provided overdue info; for regular tasks, calculate from due date
    let isOverdue, isDue, daysOverdue, overdueColor, borderStyle;

    if (taskType === 'self_care' && (task.is_overdue !== undefined || task.days_overdue !== undefined)) {
      // Self-care tasks: use API response
      isOverdue = task.is_overdue || false;
      daysOverdue = task.days_overdue || 0;
      isDue = daysOverdue === 0 && (task.due_date || task.next_due); // Due today
      const overdueSeverity = task.overdue_severity || 1;

      if (isOverdue) {
        overdueColor = TaskTrackerUtils.getOverdueColor(daysOverdue, overdueSeverity);
        borderStyle = overdueColor ? `border-left: 2px solid ${overdueColor} !important;` : '';
      } else if (isDue) {
        // Due but not overdue - use blue styling
        borderStyle = 'border-left: 2px solid var(--primary-color) !important;';
      } else {
        borderStyle = '';
      }
    } else {
      // Regular tasks: calculate from due date
      const dueDate = task.due_date || task.next_due;
      daysOverdue = dueDate ? TaskTrackerUtils.calculateDaysOverdue(dueDate) : 0;
      isOverdue = dueDate && daysOverdue > 0;
      isDue = dueDate && daysOverdue === 0; // Due today
      const overdueSeverity = task.overdue_severity || 1;

      if (isOverdue) {
        overdueColor = TaskTrackerUtils.getOverdueColor(daysOverdue, overdueSeverity);
        borderStyle = overdueColor ? `border-left: 2px solid ${overdueColor} !important;` : '';
      } else if (isDue) {
        // Due but not overdue - use blue styling
        borderStyle = 'border-left: 2px solid var(--primary-color) !important;';
      } else {
        borderStyle = '';
      }
    }

    const taskClasses = [
      'task-item',
      isOverdue || isDue ? 'needs-completion' : '',
      isOverdue ? 'overdue' : '',
      isDue && !isOverdue ? 'due-today' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="${taskClasses}"
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

  _renderSelfCareTaskWithWindows(task) {
    const completedWindows = task.windows.filter(w => w.completed).length;
    const totalWindows = task.windows.length;
    const allComplete = completedWindows === totalWindows;

        // Use the overdue information from the API response
    const isOverdue = task.is_overdue || false;
    const daysOverdue = task.days_overdue || 0;
    const isDue = daysOverdue === 0 && (task.due_date || task.next_due); // Due today
    const overdueSeverity = task.overdue_severity || 1;

    let borderStyle = '';
    if (isOverdue) {
      const overdueColor = TaskTrackerUtils.getOverdueColor(daysOverdue, overdueSeverity);
      borderStyle = overdueColor ? `border-left: 2px solid ${overdueColor} !important;` : '';
    } else if (isDue) {
      // Due but not overdue - use blue styling
      borderStyle = 'border-left: 2px solid var(--primary-color) !important;';
    }

    // Build metadata
    const metadataParts = [];
    if (task.duration_minutes) {
      metadataParts.push(TaskTrackerUtils.formatDuration(task.duration_minutes));
    }
    if (task.priority) {
      metadataParts.push(TaskTrackerUtils.formatPriority(task.priority));
    }

    // Progress indicator
    const progressText = `${completedWindows}/${totalWindows} windows complete`;
    metadataParts.push(progressText);

    // Window status indicators
    const windowsHtml = task.windows.map((window, index) => {
      const timeRange = this._formatWindowTimeRange(window);
      const windowId = `window-${task.id}-${index}`;

      if (window.completed) {
        return `
          <div class="window-item completed"
               role="status"
               aria-label="Window ${window.label} completed"
               id="${windowId}">
            <span class="window-check" aria-hidden="true">✓</span>
            <span class="window-label">${window.label || 'Window ' + (index + 1)}</span>
            ${this._config.show_window_times ? `<span class="window-time">${timeRange}</span>` : ''}
          </div>
        `;
      } else {
        return `
          <div class="window-item incomplete"
               role="button"
               tabindex="0"
               aria-label="Window ${window.label} available for completion"
               id="${windowId}">
            <span class="window-opportunity" aria-hidden="true">
              <ha-icon icon="mdi:circle-outline"></ha-icon>
            </span>
            <span class="window-label">${window.label || 'Window ' + (index + 1)}</span>
            ${this._config.show_window_times ? `<span class="window-time">${timeRange}</span>` : ''}
          </div>
        `;
      }
    }).join('');
    const statusClasses = [
      'task-item',
      'selfcare-windowed',
      allComplete ? 'all-complete' : 'has-opportunities',
      isOverdue || isDue ? 'needs-completion' : '',
      isOverdue ? 'overdue' : '',
      isDue && !isOverdue ? 'due-today' : ''
    ].filter(Boolean).join(' ');

    return `
      <div class="${statusClasses}"
           data-task-data='${JSON.stringify(task)}'
           data-task-type="self_care"
           style="${borderStyle}">
        <div class="task-content">
          <div class="task-name">
            ${task.name}
            ${task.last_completion_notes ? '<div class="completion-indicator" title="Has completion notes"></div>' : ''}
          </div>
          ${metadataParts.length > 0 ? `
            <div class="task-metadata">${metadataParts.join(' | ')}</div>
          ` : ''}
          <div class="windows-container">
            ${windowsHtml}
          </div>
        </div>
        ${this._config.show_completion_actions && !allComplete ? `
          <div class="task-actions">
            <button class="complete-btn" data-task-data='${JSON.stringify(task)}'>
              Complete
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  _formatWindowTime(timeStr) {
    // Convert 24-hour time string to 12-hour format for display
    try {
      const [hours, minutes] = timeStr.split(':').map(num => parseInt(num, 10));
      if (isNaN(hours) || isNaN(minutes)) {
        return timeStr; // Return original if parsing fails
      }
      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

      // Only show minutes if they're not zero
      if (minutes === 0) {
        return `${displayHours} ${period}`;
      } else {
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }
    } catch (e) {
      console.warn('Failed to format window time:', timeStr, e);
      return timeStr;
    }
  }

    _formatWindowTimeRange(window) {
    const startTime = this._formatWindowTime(window.start);
    const endTime = this._formatWindowTime(window.end);
    return `${startTime} - ${endTime}`;
  }

  _calculateWindowMidpoint(window) {
    // Parse start and end times (format: "HH:MM")
    const [startHours, startMinutes] = window.start.split(':').map(num => parseInt(num, 10));
    const [endHours, endMinutes] = window.end.split(':').map(num => parseInt(num, 10));

    // Convert to minutes since midnight
    let startTotalMinutes = startHours * 60 + startMinutes;
    let endTotalMinutes = endHours * 60 + endMinutes;

    // Handle windows that cross midnight (end time is smaller than start time)
    if (endTotalMinutes < startTotalMinutes) {
      endTotalMinutes += 24 * 60; // Add 24 hours worth of minutes
    }

    // Calculate midpoint
    const midpointMinutes = Math.floor((startTotalMinutes + endTotalMinutes) / 2);

    // Convert back to hours and minutes, handling overflow past midnight
    const finalMinutes = midpointMinutes % (24 * 60);
    const hours = Math.floor(finalMinutes / 60);
    const minutes = finalMinutes % 60;

    return {
      hours: hours,
      minutes: minutes,
      timeString: `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`
    };
  }

  _isCurrentTimeInWindow(window) {
    const now = new Date();
    const currentHours = now.getHours();
    const currentMinutes = now.getMinutes();
    const currentTotalMinutes = currentHours * 60 + currentMinutes;

    const [startHours, startMinutes] = window.start.split(':').map(num => parseInt(num, 10));
    const [endHours, endMinutes] = window.end.split(':').map(num => parseInt(num, 10));

    let startTotalMinutes = startHours * 60 + startMinutes;
    let endTotalMinutes = endHours * 60 + endMinutes;

    // Handle windows that cross midnight
    if (endTotalMinutes < startTotalMinutes) {
      // Window crosses midnight
      return currentTotalMinutes >= startTotalMinutes || currentTotalMinutes <= endTotalMinutes;
    } else {
      // Normal window within same day
      return currentTotalMinutes >= startTotalMinutes && currentTotalMinutes <= endTotalMinutes;
    }
  }

  _calculateCompletionTimestamp(window) {
    if (this._isCurrentTimeInWindow(window)) {
      // Current time is within the window - use current timestamp
      return null; // null means use current time in the API
    } else {
      // Current time is outside the window - use window midpoint
      const midpoint = this._calculateWindowMidpoint(window);
      const now = new Date();

      // Create a new date with today's date but the midpoint time
      const completionDate = new Date(now);
      completionDate.setHours(midpoint.hours, midpoint.minutes, 0, 0);

      // If the midpoint would be in the future (for windows that cross midnight),
      // we might need to adjust the date
      if (completionDate > now && window.start > window.end) {
        // This is a midnight-crossing window and midpoint is tomorrow
        // Check if we should use yesterday's date instead
        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        yesterday.setHours(midpoint.hours, midpoint.minutes, 0, 0);

        // Use yesterday if it makes more sense based on current time
        if (now.getHours() < 12) { // Assume morning means we want yesterday's night window
          return yesterday.toISOString();
        }
      }

      return completionDate.toISOString();
    }
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
          'Show Window Times',
          'Display time ranges for self-care task windows',
          TaskTrackerUtils.createCheckboxInput(this._config.show_window_times, 'show_window_times')
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Window Display Mode',
          'When to show time windows on self-care tasks',
          TaskTrackerUtils.createSelectInput(this._config.window_display_mode, 'window_display_mode', [
            { value: 'never', label: 'Never' },
            { value: 'multiple_only', label: 'Multiple Windows Only' },
            { value: 'always', label: 'Always' }
          ])
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