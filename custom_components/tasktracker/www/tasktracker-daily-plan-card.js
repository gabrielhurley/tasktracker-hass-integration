import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';
import { TaskTrackerDateTime } from './utils/datetime-utils.js';
import { TaskTrackerTasksBaseCard } from './utils/task-cards-base.js';
import { TaskTrackerTaskEditor } from './utils/ui/task-editor.js';
import { TaskTrackerBaseEditor } from './utils/base-config-editor.js';

/**
 * TaskTracker Daily Plan Card
 *
 * Displays self-care tasks and tasks from the /api/daily-plan endpoint.
 */
class TaskTrackerDailyPlanCard extends TaskTrackerTasksBaseCard {
  constructor() {
    super();
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
    this._taskDataMap = new Map(); // Store task data in memory instead of DOM
  }

  static getConfigElement() {
    return document.createElement('tasktracker-daily-plan-card-editor');
  }

  // Hooks consumed by TaskTrackerTasksBaseCard
  onAfterComplete() { this._fetchPlan(); }
  onAfterUpdate() { this._fetchPlan(); }
  onAfterSnooze() { this._fetchPlan(); }

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
    super.hass = hass;
  }
  // Base first-run hook
  onHassFirstRun() {
    this._fetchPlan();
    this._setupEventListeners();
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

  // Uses base helper now

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

    // Validate current user configuration before making API calls
    const userValidation = TaskTrackerUtils.validateCurrentUser(this._config, this._hass, this._enhancedUsers);

    if (!userValidation.canMakeRequests) {
      this._error = userValidation.error;
      this._plan = null;
      this._loading = false;
      this._render();
      return;
    }

    const serviceData = {};
    if (userValidation.username) {
      serviceData.username = userValidation.username;
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
        this._populateTaskDataMap();
      } else {
        this._plan = null;
        this._userContext = null;
        this._taskDataMap.clear();
      }
    } catch (err) {
      console.error('Failed to fetch daily plan:', err);
      this._error = err.message;
      this._plan = null;
      this._taskDataMap.clear();
    }

    this._loading = false;
    this._render();
  }

  async _fetchDailyState() {
    // Validate current user configuration before making API calls
    const userValidation = TaskTrackerUtils.validateCurrentUser(this._config, this._hass, this._enhancedUsers);

    if (!userValidation.canMakeRequests || !userValidation.username) {
      this._dailyState = null;
      return;
    }

    try {
      const serviceData = { username: userValidation.username };
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

  _populateTaskDataMap() {
    this._taskDataMap.clear();

    if (!this._plan || !this._plan.data) {
      return;
    }

    // Store self-care tasks
    const selfCare = this._plan.data.self_care || [];
    selfCare.forEach(task => {
      this._taskDataMap.set(`self_care_${task.id}`, { task, taskType: 'self_care' });
    });

    // Store regular tasks
    const tasks = this._plan.data.tasks || [];
    tasks.forEach(task => {
      this._taskDataMap.set(`task_${task.id}`, { task, taskType: 'task' });
    });
  }

  _getTaskData(taskKey) {
    return this._taskDataMap.get(taskKey);
  }

  _setupEventListeners() {
    // Clean up any existing listener
    if (this._eventCleanup) {
      this._eventCleanup().catch(() => {});
    }

    // Listen for daily plan events to refresh
    const dailyPlanCleanup = TaskTrackerUtils.setupEventListener(this._hass, 'daily_plan', (eventData) => {
      const evUsername = eventData?.username;
      const username = this._getUsername();
      if (!username || username === evUsername) {
        setTimeout(() => {
          this._fetchPlan();
        }, 500);
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

    // Listen for generic task updates (includes deletions via reused event)
    const taskUpdateCleanup = TaskTrackerUtils.setupTaskUpdateListener(this._hass, () => {
      setTimeout(() => {
        this._fetchPlan();
      }, 500);
    });

    // Listen for daily state events to refresh the plan
    const dailyStateCleanup = TaskTrackerUtils.setupEventListener(this._hass, 'daily_state_set', (eventData) => {
      const evUsername = eventData?.username;
      const username = this._getUsername();
      if (!username || username === evUsername) {
        // Update the daily state and re-render
        this._dailyState = {
          success: true,
          data: eventData.state
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
        dailyStateCleanup().catch(() => {}),
        taskUpdateCleanup().catch(() => {})
      ]);
    };
  }

  _showTaskModal(task, taskType) {
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

  async _saveTask(task, updates) { await super._saveTask(task, updates); }

  async _snoozeTask(task, snoozeUntil) { await super._snoozeTask(task, snoozeUntil); }

  _renderDailyStateDisplay() {
    if (!this._dailyState || !this._dailyState.data) {
      return '';
    }

    const state = this._dailyState.data;

    // Map state values to display labels
    const stateValues = [
      { label: 'Energy', value: state.energy, key: 'energy' },
      { label: 'Focus', value: state.focus, key: 'focus' },
      { label: 'Motivation', value: state.motivation, key: 'motivation' },
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
          <button class="btn daily-state-edit-btn" title="Edit daily state">
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

  async _completeTask(task, notes, completed_at = null) { await super._completeTask(task, notes, completed_at); }

  _render() {
    if (!this.shadowRoot) return;

    const username = this._getUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerStyles.getCommonCardStyles()}
        ${TaskTrackerStyles.getDailyPlanCardStyles()}
      </style>

      <div class="card">
        ${this._renderHeader()}

        ${this._renderContent()}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this._fetchPlan());

    // Filter toggle button handler
    const filterToggleBtn = this.shadowRoot.querySelector('.filter-toggle-btn');
    if (filterToggleBtn) filterToggleBtn.addEventListener('click', () => this._toggleRecommendationFilter());

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
          const taskKey = item.dataset.taskKey;
          const taskData = this._getTaskData(taskKey);
          if (taskData) {
            this._showTaskModal(taskData.task, taskData.taskType);
          }
        });
      });

      // Complete button click handlers (generic completion - uses current time)
      const completeButtons = this.shadowRoot.querySelectorAll('.complete-btn');
      completeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling to parent task item
          const taskKey = button.dataset.taskKey;
          const taskData = this._getTaskData(taskKey);
          if (taskData) {
            // Generic completion - backend will determine window assignment based on current time
            this._completeTask(taskData.task, '');
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
          if (taskItem && taskItem.dataset.taskKey) {
            const taskKey = taskItem.dataset.taskKey;
            const taskData = this._getTaskData(taskKey);
            if (taskData && taskData.task.windows) {
              // Extract window index from the element ID (format: window-taskId-index)
              const windowId = windowItem.id;
              const windowIndexMatch = windowId.match(/window-\d+-(\d+)$/);

              if (windowIndexMatch) {
                const windowIndex = parseInt(windowIndexMatch[1], 10);
                const window = taskData.task.windows[windowIndex];

                if (window) {
                  // Calculate the appropriate completion timestamp based on the window
                  const completionTimestamp = TaskTrackerDateTime.getCompletionTimestamp(window, this._userContext);

                  // Complete the task with the calculated timestamp
                  this._completeTask(taskData.task, '', completionTimestamp);
                } else {
                  console.warn('Window not found at index:', windowIndex);
                  // Fallback to generic completion
                  this._completeTask(taskData.task, '');
                }
              } else {
                console.warn('Could not parse window index from ID:', windowId);
                // Fallback to generic completion
                this._completeTask(taskData.task, '');
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

  // Base header integration
  getCardTitle() {
    const username = this._getUsername();
    return `Daily Plan ${username ? `- ${TaskTrackerUtils.capitalize(username)}` : ''}`;
  }
  getHeaderActions() {
    return `
      <button class="filter-toggle-btn ${this._showRecommendedOnly ? 'filtered' : ''}"
              title="${this._showRecommendedOnly ? 'Showing recommended tasks only - click to show all tasks' : 'Showing all tasks - click to show recommended only'}">
        <ha-icon icon="${this._showRecommendedOnly ? 'mdi:filter-check' : 'mdi:filter-off'}"></ha-icon>
      </button>
    `;
  }
  onAutoRefresh() { this._fetchPlan(); }
  onRefresh() { this._fetchPlan(); }

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
    const usingDefaults = this._plan?.data?.using_defaults || false;

    if (usingDefaults) {
      return this._renderReducedPlan(tasks);
    }

    const selfCareHtml = selfCare.length > 0
      ? selfCare.map(task => this._renderTaskItem(task, 'self_care')).join('')
      : null;

    const tasksHtml = tasks.length > 0
      ? tasks.map(task => this._renderTaskItem(task, 'task')).join('')
      : null;

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
      ${selfCareSection}
      ${tasksSection}
      ${this._renderDailyStateDisplay()}
    `;
  }

  _renderReducedPlan(tasks) {
    const tasksHtml = tasks.length > 0
      ? tasks.map(task => this._renderTaskItem(task, 'task')).join('')
      : '<div class="no-urgent-tasks">No urgent tasks right now!</div>';

    return `
      <div class="daily-state-prompt">
        <button class="daily-state-button btn btn--primary btn--block">Set Your Daily State</button>
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

    // Calculate overdue color and status using helper method
    let borderInfo;
    if (taskType === 'self_care') {
      // Self-care tasks: use helper method with self_care type
      borderInfo = TaskTrackerUtils.getTaskBorderStyle(task, 'self_care', 0);
    } else {
      // Regular tasks: calculate daysOverdue first, then use helper method
      const dueDate = task.due_date || task.next_due;
      const daysOverdue = dueDate ? TaskTrackerDateTime.calculateDaysOverdue(dueDate, this._userContext) : 0;
      borderInfo = TaskTrackerUtils.getTaskBorderStyle(task, 'task', daysOverdue);
    }

    // Check for low recommendation score to apply fade effect
    const hasLowScore = task.recommendation_score !== undefined &&
                       task.recommendation_score !== null &&
                       task.recommendation_score < this._config.low_recommendation_score_threshold;

    const taskClasses = [
      'task-item',
      borderInfo.cssClasses.needsCompletion ? 'needs-completion' : '',
      borderInfo.cssClasses.overdue ? 'overdue' : '',
      borderInfo.cssClasses.dueToday ? 'due-today' : '',
      hasLowScore ? 'low-recommendation' : ''
    ].filter(Boolean).join(' ');

    const borderClass = borderInfo.borderClass || '';
    const taskKey = `${taskType}_${task.id}`;
    return `
      <div class="${[taskClasses, borderClass].filter(Boolean).join(' ')}"
           data-task-key="${taskKey}"
           >
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
            <button class="complete-btn" data-task-key="${taskKey}">
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

    // Use the overdue information from the API response via helper method
    const borderInfo = TaskTrackerUtils.getTaskBorderStyle(task, 'self_care', 0);

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
      borderInfo.cssClasses.needsCompletion ? 'needs-completion' : '',
      borderInfo.cssClasses.overdue ? 'overdue' : '',
      borderInfo.cssClasses.dueToday ? 'due-today' : '',
      hasLowScore ? 'low-recommendation' : ''
    ].filter(Boolean).join(' ');

    const borderClass2 = borderInfo.borderClass || '';
    const taskKey = `self_care_${task.id}`;
    return `
      <div class="${[statusClasses, borderClass2].filter(Boolean).join(' ')}"
           data-task-key="${taskKey}"
           >
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
            <button class="complete-btn" data-task-key="${taskKey}">
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
class TaskTrackerDailyPlanCardEditor extends TaskTrackerBaseEditor {
  constructor() {
    super();
  }

  getDefaultConfig() {
    return { ...TaskTrackerDailyPlanCard.getStubConfig() };
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

        <div class="explicit-user-row ${this._config.user_filter_mode === 'explicit' ? '' : 'hidden'}">
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

  _updateConfig(configKey, value) {
    super._updateConfig(configKey, value);
    if (configKey === 'user_filter_mode') {
      this._render();
    }
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