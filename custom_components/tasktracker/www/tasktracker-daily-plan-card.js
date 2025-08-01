import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerDateTime } from './tasktracker-datetime-utils.js';
import { TaskTrackerTaskEditor } from './tasktracker-task-editor.js';

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
    this._dailyState = null;
    this._userContext = null;
    this._loading = false;
    this._error = null;
    this._availableUsers = [];
    this._enhancedUsers = [];
    this._refreshInterval = null;
    this._eventCleanup = null;
    this._showRecommendedOnly = true; // Default to showing recommended tasks only
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
      show_recommendation_score: false,
      low_recommendation_score_threshold: 0.25,
      window_display_mode: 'always',
      refresh_interval: 600,
      default_filter_recommended: true,
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
      show_recommendation_score: config.show_recommendation_score || false,
      low_recommendation_score_threshold: config.low_recommendation_score_threshold || 0.25,
      window_display_mode: config.window_display_mode || 'always',
      refresh_interval: config.refresh_interval || 600,
      default_filter_recommended: config.default_filter_recommended !== false,
      ...config,
    };
    // Set initial toggle state from config
    this._showRecommendedOnly = this._config.default_filter_recommended;
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
    // Add the select_recommended parameter based on toggle state
    serviceData.select_recommended = this._showRecommendedOnly;

    try {
      // Fetch both plan and daily state in parallel
      const [planResponse] = await Promise.all([
        this._hass.callService('tasktracker', 'get_daily_plan', serviceData, {}, true, true),
        this._fetchDailyState()
      ]);

      if (planResponse && planResponse.response) {
        this._plan = planResponse.response;
        this._userContext = planResponse.response.user_context;
      } else {
        this._plan = null;
        this._userContext = null;
      }
    } catch (err) {
      console.error('Failed to fetch daily plan:', err);
      this._error = err.message;
      this._plan = null;
    }

    this._loading = false;
    this._render();
  }

  async _fetchDailyState() {
    const username = this._getUsername();
    if (!username) {
      this._dailyState = null;
      return;
    }

    try {
      const serviceData = { username };
      const response = await this._hass.callService('tasktracker', 'get_daily_state', serviceData, {}, true, true);
      if (response && response.response) {
        this._dailyState = response.response;
      } else {
        this._dailyState = null;
      }
    } catch (err) {
      console.error('Failed to fetch daily state:', err);
      this._dailyState = null;
    }
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

    // Listen for daily state events to refresh the plan
    const dailyStateCleanup = TaskTrackerUtils.setupEventListener(this._hass, 'tasktracker_daily_state_set', (event) => {
      const evUsername = event?.data?.username;
      const username = this._getUsername();
      if (!username || username === evUsername) {
        // Update the daily state and re-render
        this._dailyState = {
          success: true,
          data: event.data.state
        };
        this._render();
      }
    });

    // Combined cleanup function
    this._eventCleanup = async () => {
      await Promise.all([
        dailyPlanCleanup().catch(() => {}),
        completionCleanup().catch(() => {}),
        moodUpdateCleanup().catch(() => {}),
        dailyStateCleanup().catch(() => {})
      ]);
    };
  }

  _showTaskModal(task, taskType) {
    // Show detail modal with edit button
    const modal = TaskTrackerUtils.createTaskModal(
      task,
      this._config,
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
      }
    );
    TaskTrackerUtils.showModal(modal);
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

      // Refresh the daily plan after update
      setTimeout(() => {
        this._fetchPlan();
      }, 100);

    } catch (error) {
      console.error('Failed to update task:', error);
      TaskTrackerUtils.showError(`Failed to update task: ${error.message}`);
    }
  }

  _renderDailyStateDisplay() {
    if (!this._dailyState || !this._dailyState.data) {
      return '';
    }

    const state = this._dailyState.data;

    // Map state values to display labels
    const stateValues = [
      { label: 'Energy', value: state.energy, key: 'energy' },
      { label: 'Motivation', value: state.motivation, key: 'motivation' },
      { label: 'Focus', value: state.focus, key: 'focus' },
      { label: 'Pain', value: state.pain, key: 'pain' },
      { label: 'Mood', value: state.mood, key: 'mood' },
      { label: 'Free Time', value: state.free_time, key: 'free_time' }
    ].filter(item => item.value !== null && item.value !== undefined);

    const valuesHtml = stateValues.map(item => `
      <div class="state-value">
        <span class="state-label">${item.label}:</span>
        <span class="state-number">${item.value}</span>
      </div>
    `).join('');

    return `
      <div class="daily-state-container">
        <div class="daily-state-display">
          <div class="daily-state-values">
            ${valuesHtml}
          </div>
          <button class="daily-state-edit-btn" title="Edit daily state">
            Edit
          </button>
        </div>
      </div>
    `;
  }

  _toggleRecommendationFilter() {
    this._showRecommendedOnly = !this._showRecommendedOnly;
    this._fetchPlan(); // Fetch new plan with updated filter
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
        // Callback when state is saved - refresh both plan and daily state
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

        /* Daily state display styles */

        .daily-state-container {
          border-top: 1px solid var(--divider-color);
          padding-top: 16px;
        }

        .daily-state-display {
          background: var(--secondary-background-color, rgba(0, 0, 0, 0.05));
          border-radius: 6px;
          padding: 12px;
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 12px;
        }

        .daily-state-values {
          display: flex;
          flex-wrap: wrap;
          gap: 8px;
          flex: 1;
        }

        .state-value {
          display: flex;
          align-items: center;
          gap: 4px;
          font-size: 0.85em;
          color: var(--primary-text-color);
        }

        .state-label {
          color: var(--secondary-text-color);
          font-weight: 500;
        }

        .state-number {
          font-weight: 600;
          color: var(--light-primary-color);
        }

        .daily-state-edit-btn {
          background: var(--secondary-background-color);
          color: var(--secondary-text-color);
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          padding: 6px 12px;
          font-size: 0.8em;
          font-weight: 500;
          cursor: pointer;
          transition: opacity 0.2s ease;
          flex-shrink: 0;
        }

        .daily-state-edit-btn:hover {
          opacity: 0.9;
          color: var(--primary-text-color);
          background: var(--secondary-background-color);
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

        .window-item.inferred-complete {
          background: rgba(76, 175, 80, 0.08);
          color: var(--primary-text-color);
          border-left: 2px solid rgba(76, 175, 80, 0.3);
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
          background: rgba(3, 169, 244, 0.1);
        }

        .selfcare-windowed.needs-completion.due-today .window-item.incomplete:hover {
          background: rgba(3, 169, 244, 0.2);
        }

        .selfcare-windowed.needs-completion.due-today .window-item.incomplete:focus {
          background: rgba(3, 169, 244, 0.2);
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

        /* Individual window overdue styling */
        .selfcare-windowed.needs-completion .window-item.incomplete.overdue {
          background: rgba(255, 193, 7, 0.1);
        }

        .selfcare-windowed.needs-completion .window-item.incomplete.overdue:hover {
          background: rgba(255, 193, 7, 0.2);
        }

        .selfcare-windowed.needs-completion .window-item.incomplete.overdue:focus {
          background: rgba(255, 193, 7, 0.2);
        }

        /* Individual window overdue opportunity icon styling */
        .selfcare-windowed.needs-completion .window-item.incomplete.overdue .window-opportunity {
          color: var(--error-color, #f44336);
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

        .window-check.inferred {
          color: rgba(76, 175, 80, 0.7);
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

        /* Low recommendation score fade effect */
        .task-item.low-recommendation {
          opacity: 0.6;
          transition: opacity 0.2s ease;
        }

        .task-item.low-recommendation:hover {
          opacity: 0.8;
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

        /* Filter toggle styles */
        .filter-toggle-btn {
          background: none;
          border: none;
          color: var(--primary-text-color);
          cursor: pointer;
          padding: 8px;
          border-radius: 4px;
          transition: background-color 0.2s ease, color 0.2s ease;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .filter-toggle-btn:hover {
          background: var(--secondary-background-color);
        }

        .filter-toggle-btn.filtered {
          background: var(--secondary-background-color);
        }

        .filter-toggle-btn ha-icon {
          --mdc-icon-size: 20px;
        }

        .header-actions {
          display: flex;
          align-items: center;
          gap: 4px;
        }
      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Daily Plan ${username ? `- ${TaskTrackerUtils.capitalize(username)}` : ''}</h3>
            <div class="header-actions">
              <button class="filter-toggle-btn ${this._showRecommendedOnly ? 'filtered' : ''}"
                      title="${this._showRecommendedOnly ? 'Showing recommended tasks only - click to show all tasks' : 'Showing all tasks - click to show recommended only'}">
                <ha-icon icon="${this._showRecommendedOnly ? 'mdi:filter-check' : 'mdi:filter-off'}"></ha-icon>
              </button>
              <button class="refresh-btn" title="Refresh daily plan">
                <ha-icon icon="mdi:refresh"></ha-icon>
              </button>
            </div>
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

    // Filter toggle button handler
    const filterToggleBtn = this.shadowRoot.querySelector('.filter-toggle-btn');
    if (filterToggleBtn) {
      filterToggleBtn.addEventListener('click', () => this._toggleRecommendationFilter());
    }

    // Daily state button handler
    const dailyStateButton = this.shadowRoot.querySelector('.daily-state-button');
    if (dailyStateButton) {
      dailyStateButton.addEventListener('click', () => this._handleSetDailyState());
    }

    // Daily state edit button handler
    const dailyStateEditButton = this.shadowRoot.querySelector('.daily-state-edit-btn');
    if (dailyStateEditButton) {
      dailyStateEditButton.addEventListener('click', () => this._handleSetDailyState());
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
                  const completionTimestamp = TaskTrackerDateTime.getCompletionTimestamp(window, this._userContext);

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
    const spokenResponse = this._plan?.spoken_response || {};
    const usingDefaults = this._plan?.data?.using_defaults || false;

    if (usingDefaults) {
      return this._renderReducedPlan(tasks, spokenResponse);
    }

    const selfCareHtml = selfCare.length > 0
      ? selfCare.map(task => this._renderTaskItem(task, 'self_care')).join('')
      : null;

    const tasksHtml = tasks.length > 0
      ? tasks.map(task => this._renderTaskItem(task, 'task')).join('')
      : null;

    const notificationBodyHtml = spokenResponse ? `
      <div class="notification-focus">
        ${spokenResponse}
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
      ${this._renderDailyStateDisplay()}
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

    // Add recommendation score if available and configured to show
    if (this._config.show_recommendation_score &&
        task.recommendation_score !== undefined &&
        task.recommendation_score !== null) {
      metadataParts.push(`Score: ${task.recommendation_score}`);
    }

        // Add occurrence progress for self-care tasks (only when multiple occurrences required)
    if (taskType === 'self_care' &&
        task.required_occurrences !== undefined &&
        task.outstanding_occurrences !== undefined &&
        task.required_occurrences > 1) {
      const completedOccurrences = task.required_occurrences - task.outstanding_occurrences;
      const progressText = `${completedOccurrences}/${task.required_occurrences} occurrences complete`;
      metadataParts.push(progressText);
    }

    // Add due date if available with user context for smart formatting
    if (task.due_date || task.next_due) {
      const dueDate = task.due_date || task.next_due;
      metadataParts.push(TaskTrackerUtils.formatDueDate(dueDate, this._userContext, task));
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
      // Regular tasks: calculate from due date using user context
      const dueDate = task.due_date || task.next_due;
      daysOverdue = dueDate ? TaskTrackerDateTime.calculateDaysOverdue(dueDate, this._userContext) : 0;
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

    // Check for low recommendation score to apply fade effect
    const hasLowScore = task.recommendation_score !== undefined &&
                       task.recommendation_score !== null &&
                       task.recommendation_score < this._config.low_recommendation_score_threshold;

    const taskClasses = [
      'task-item',
      isOverdue || isDue ? 'needs-completion' : '',
      isOverdue ? 'overdue' : '',
      isDue && !isOverdue ? 'due-today' : '',
      hasLowScore ? 'low-recommendation' : ''
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

    // Calculate progress based on outstanding occurrences rather than windows
    const requiredOccurrences = task.required_occurrences || totalWindows;
    const outstandingOccurrences = task.outstanding_occurrences || 0;
    const completedOccurrences = requiredOccurrences - outstandingOccurrences;
    const allOccurrencesComplete = outstandingOccurrences === 0;

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

    // Add recommendation score if available and configured to show
    if (this._config.show_recommendation_score &&
        task.recommendation_score !== undefined &&
        task.recommendation_score !== null) {
      metadataParts.push(`Score: ${task.recommendation_score}`);
    }

    // Progress indicator based on occurrences, not windows
    const progressText = `${completedOccurrences}/${requiredOccurrences} occurrences complete`;
    metadataParts.push(progressText);

    // Calculate unmapped completions and determine which windows to mark as inferred
    const unmappedCompletions = completedOccurrences - completedWindows;
    const inferredWindows = new Set();

    if (unmappedCompletions > 0) {
      // Find past windows and mark the earliest ones as inferred complete
      const pastWindows = task.windows
        .map((window, index) => ({ window, index }))
        .filter(({ window }) => !window.completed && TaskTrackerDateTime.isWindowInPast(window, this._userContext))
        .sort((a, b) => {
          // Sort by window start time
          const timeA = a.window.start.split(':').map(n => parseInt(n, 10));
          const timeB = b.window.start.split(':').map(n => parseInt(n, 10));
          return (timeA[0] * 60 + timeA[1]) - (timeB[0] * 60 + timeB[1]);
        });

      // Mark the earliest past windows as inferred complete
      for (let i = 0; i < Math.min(unmappedCompletions, pastWindows.length); i++) {
        inferredWindows.add(pastWindows[i].index);
      }
    }

    // Window status indicators
    const windowsHtml = task.windows.map((window, index) => {
      const timeRange = TaskTrackerDateTime.formatWindowTimeRange(window);
      const windowId = `window-${task.id}-${index}`;
      const isInferredComplete = inferredWindows.has(index);

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
      } else if (isInferredComplete) {
        return `
          <div class="window-item inferred-complete"
               role="status"
               aria-label="Window ${window.label} likely completed (inferred)"
               id="${windowId}">
            <span class="window-check inferred" aria-hidden="true" title="Completion inferred from unmapped activity">✓?</span>
            <span class="window-label">${window.label || 'Window ' + (index + 1)}</span>
            ${this._config.show_window_times ? `<span class="window-time">${timeRange}</span>` : ''}
          </div>
        `;
      } else {
        // Check if this individual window is overdue
        const isWindowOverdue = TaskTrackerDateTime.isWindowInPast(window, this._userContext);
        const windowClasses = ['window-item', 'incomplete'];
        if (isWindowOverdue) {
          windowClasses.push('overdue');
        }

        return `
          <div class="${windowClasses.join(' ')}"
               role="button"
               tabindex="0"
               aria-label="Window ${window.label} ${isWindowOverdue ? 'overdue' : 'available for completion'}"
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
    // Check for low recommendation score to apply fade effect
    const hasLowScore = task.recommendation_score !== undefined &&
                       task.recommendation_score !== null &&
                       task.recommendation_score < this._config.low_recommendation_score_threshold;

    const statusClasses = [
      'task-item',
      'selfcare-windowed',
      allOccurrencesComplete ? 'all-complete' : 'has-opportunities',
      isOverdue || isDue ? 'needs-completion' : '',
      isOverdue ? 'overdue' : '',
      isDue && !isOverdue ? 'due-today' : '',
      hasLowScore ? 'low-recommendation' : ''
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
        ${this._config.show_completion_actions && !allOccurrencesComplete ? `
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
    const isInitialRender = !this.shadowRoot.hasChildNodes();
    this._config = { ...TaskTrackerDailyPlanCard.getStubConfig(), ...config };

    if (isInitialRender) {
      this._render();
    } else {
      // Update field values without re-rendering
      this._updateFieldValues();
    }
  }

  set hass(hass) {
    this._hass = hass;
  }

  _valueChanged(ev) {
    TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
  }

  _updateFieldValues() {
    // Update field values without re-rendering
    this.shadowRoot.querySelectorAll('input, select').forEach(input => {
      const configKey = input.dataset.configKey;
      if (configKey && this._config[configKey] !== undefined) {
        if (input.type === 'checkbox') {
          input.checked = this._config[configKey];
        } else {
          input.value = this._config[configKey] || '';
        }
      }
    });

    // Handle user_filter_mode visibility
    const explicitUserRow = this.shadowRoot.querySelector('.explicit-user-row');
    if (explicitUserRow) {
      explicitUserRow.style.display = this._config.user_filter_mode === 'explicit' ? 'block' : 'none';
    }
  }

  _updateConfig(configKey, value) {
    this._config = {
      ...this._config,
      [configKey]: value
    };

    // If user_filter_mode changed, show/hide explicit user field
    if (configKey === 'user_filter_mode') {
      const explicitUserRow = this.shadowRoot.querySelector('.explicit-user-row');
      if (explicitUserRow) {
        explicitUserRow.style.display = value === 'explicit' ? 'block' : 'none';
      }
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
          'Show Recommendation Score',
          'Display the recommendation score in task metadata',
          TaskTrackerUtils.createCheckboxInput(this._config.show_recommendation_score, 'show_recommendation_score')
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Low Recommendation Score Threshold',
          'Tasks with scores below this value will appear faded',
          TaskTrackerUtils.createNumberInput(this._config.low_recommendation_score_threshold, 'low_recommendation_score_threshold', 0, 1, 0.01)
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

        <div class="explicit-user-row" style="display: ${this._config.user_filter_mode === 'explicit' ? 'block' : 'none'}">
          ${TaskTrackerUtils.createConfigRow(
            'Username',
            'Specific username for daily plan',
            TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
          )}
        </div>

        <div class="section-title">Behavior Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'Refresh Interval (seconds)',
          'How often to automatically refresh plan data',
          TaskTrackerUtils.createNumberInput(this._config.refresh_interval, 'refresh_interval', 10, 3600, 10)
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Default Filter Recommended',
          'Show only recommended tasks by default when card loads',
          TaskTrackerUtils.createCheckboxInput(this._config.default_filter_recommended, 'default_filter_recommended')
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