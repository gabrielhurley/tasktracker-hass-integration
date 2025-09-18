import { TaskTrackerBaseCard } from './base-card.js';
import { TaskTrackerUtils } from '../tasktracker-utils.js';
import { TaskTrackerDateTime } from './datetime-utils.js';
import { TaskTrackerStyles } from './styles.js';
import { TaskDataManager } from './task-data-manager.js';

/**
 * TaskTrackerTasksBaseCard
 *
 * Base class for cards that display and interact with tasks.
 * Provides shared fetching of users, completion/snooze/update actions,
 * and helpers for rendering common task rows and metadata.
 */
export class TaskTrackerTasksBaseCard extends TaskTrackerBaseCard {
  constructor() {
    super();
    this._tasks = [];
    this._userContext = null;
    this._availableUsers = [];
    this._enhancedUsers = [];
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._taskDataManager = new TaskDataManager();
    this._lastRefreshTime = 0;
    this._recentCompletions = [];
    this._queuedRefresh = false;
    this._previousData = null;
  }

  async _fetchAvailableUsers() {
    try {
      this._availableUsers = await TaskTrackerUtils.getAvailableUsers(this._hass);
      this._enhancedUsers = await TaskTrackerUtils.getEnhancedUsers(this._hass);
    } catch (error) {
      console.warn('Failed to fetch available users:', error);
      this._availableUsers = [];
      this._enhancedUsers = [];
    }
  }

  _getCurrentUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers, this._enhancedUsers);
  }

  async _completeTask(task, notes, completed_at = null) {
    // Track completion for rapid completion detection
    this._trackCompletion();

    // Fetch users if not available
    if (!this._enhancedUsers || this._enhancedUsers.length === 0) {
      await this._fetchAvailableUsers();
    }

    // Validate current user configuration before making API calls
    const userValidation = TaskTrackerUtils.validateCurrentUser(this._config, this._hass, this._enhancedUsers);

    if (!userValidation.canMakeRequests) {
      TaskTrackerUtils.showError(userValidation.error);
      return;
    }

    try {
      const response = await TaskTrackerUtils.completeTask(this._hass, task.name, userValidation.username, notes, completed_at);
      if (response && response.success) {
        TaskTrackerUtils.showSuccess(response.spoken_response || `Task "${task.name}" completed successfully`);
      } else {
        const errorMsg = (response && response.message) || 'Unknown error';
        TaskTrackerUtils.showError(`Failed to complete task: ${errorMsg}`);
      }
      // Allow subclass to refresh data after completion
      if (typeof this.onAfterComplete === 'function') {
        setTimeout(() => this.onAfterComplete(), 100);
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      TaskTrackerUtils.showError(`Failed to complete task: ${error.message}`);
    }
  }

  async _snoozeTask(task, snoozeUntil) {
    // Fetch users if not available
    if (!this._enhancedUsers || this._enhancedUsers.length === 0) {
      await this._fetchAvailableUsers();
    }

    // Validate current user configuration before making API calls
    const userValidation = TaskTrackerUtils.validateCurrentUser(this._config, this._hass, this._enhancedUsers);

    if (!userValidation.canMakeRequests) {
      TaskTrackerUtils.showError(userValidation.error);
      return;
    }

    await TaskTrackerUtils.snoozeTask(this._hass, task, snoozeUntil, userValidation.username, () => {
      if (typeof this.onAfterSnooze === 'function') this.onAfterSnooze();
    });
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
      if (typeof this.onAfterUpdate === 'function') {
        setTimeout(() => this.onAfterUpdate(), 100);
      }
    } catch (error) {
      console.error('Failed to update task:', error);
      TaskTrackerUtils.showError(`Failed to update task: ${error.message}`);
    }
  }

  async _deleteTask(task) {
    try {
      // Fetch users if not available
      if (!this._enhancedUsers || this._enhancedUsers.length === 0) {
        await this._fetchAvailableUsers();
      }

      // Validate current user configuration before making API calls
      const userValidation = TaskTrackerUtils.validateCurrentUser(this._config, this._hass, this._enhancedUsers);

      if (!userValidation.canMakeRequests) {
        TaskTrackerUtils.showError(userValidation.error);
        return;
      }

      const taskId = task.id || task.task_id;
      const taskType = task.task_type;
      await TaskTrackerUtils.deleteTask(this._hass, taskId, taskType, userValidation.username || null);
      if (typeof this.onAfterUpdate === 'function') {
        setTimeout(() => this.onAfterUpdate(), 100);
      }
    } catch (error) {
      // Toasts are handled in the action util
    }
  }

  buildTaskMetadata(task, { includeRecommendationScore = false } = {}) {
    const parts = [];
    if (task.duration_minutes) parts.push(TaskTrackerUtils.formatDuration(task.duration_minutes));
    if (task.priority) parts.push(TaskTrackerUtils.formatPriority(task.priority));
    if (includeRecommendationScore && task.recommendation_score !== undefined && task.recommendation_score !== null) {
      parts.push(`Score: ${task.recommendation_score}`);
    }
    if (task.due_date || task.next_due) {
      const dueDate = task.due_date || task.next_due;
      parts.push(TaskTrackerUtils.formatDueDate(dueDate, this._userContext, task));
    }
    return parts;
  }

  getTaskCssAndBorder(task, taskType = 'task') {
    let borderInfo;
    if (taskType === 'self_care') {
      borderInfo = TaskTrackerUtils.getTaskBorderStyle(task, 'self_care', 0);
    } else {
      const dueDate = task.due_date || task.next_due;
      const daysOverdue = dueDate ? TaskTrackerDateTime.calculateDaysOverdue(dueDate, this._userContext) : 0;
      borderInfo = TaskTrackerUtils.getTaskBorderStyle(task, 'task', daysOverdue);
    }
    const taskClasses = [
      'task-item',
      borderInfo.cssClasses.needsCompletion ? 'needs-completion' : '',
      borderInfo.cssClasses.overdue ? 'overdue' : '',
      borderInfo.cssClasses.dueToday ? 'due-today' : ''
    ].filter(Boolean).join(' ');
    const borderClass = borderInfo.borderClass || '';
    const borderStyle = borderInfo.borderStyle || '';
    return { borderInfo, taskClasses, borderClass, borderStyle };
  }

  renderSimpleTaskRow(task, { showActions = false, taskType = 'task' } = {}) {
    const metadataParts = this.buildTaskMetadata(task);
    const { taskClasses, borderClass, borderStyle } = this.getTaskCssAndBorder(task, taskType);
    const taskKey = this._taskDataManager.storeTaskData(task, taskType);
    return `
      <div class="${[taskClasses, borderClass].filter(Boolean).join(' ')}" ${borderStyle ? `style="${borderStyle}"` : ''} data-task-key="${taskKey}">
        <div class="task-content">
          <div class="task-name">
            ${task.name}
            ${task.last_completion_notes ? '<div class="completion-indicator" title="Has completion notes"></div>' : ''}
          </div>
          ${metadataParts.length > 0 ? `<div class="task-metadata">${metadataParts.join(' | ')}</div>` : ''}
        </div>
        ${showActions ? `
          <div class="task-actions">
            <button class="complete-btn" data-task-key="${taskKey}">
              Complete
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Clear the task data manager (called when data is refreshed)
   */
  clearTaskData() {
    this._taskDataManager.clear();
  }

  /**
   * Get task data by key
   * @param {string} taskKey - The task key from data-task-key attribute
   * @returns {Object|null} - Object with {task, taskType} or null if not found
   */
  getTaskData(taskKey) {
    return this._taskDataManager.getTaskData(taskKey);
  }

  /**
   * Setup standard task item click handlers
   * @param {Function} onTaskClick - Callback for task item clicks (task, taskType) => void
   * @param {Function} onCompleteClick - Optional callback for complete button clicks (task, taskType) => void
   */
  setupTaskClickHandlers(onTaskClick, onCompleteClick = null) {
    // Task item click handlers
    const taskItems = this.shadowRoot.querySelectorAll('.task-item');
    taskItems.forEach((item) => {
      item.addEventListener('click', () => {
        const taskKey = item.dataset.taskKey;
        const taskData = this.getTaskData(taskKey);
        if (taskData && onTaskClick) {
          onTaskClick(taskData.task, taskData.taskType);
        }
      });
    });

    // Complete button click handlers (if provided)
    if (onCompleteClick) {
      const completeButtons = this.shadowRoot.querySelectorAll('.complete-btn');
      completeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling to parent task item
          const taskKey = button.dataset.taskKey;
          const taskData = this.getTaskData(taskKey);
          if (taskData) {
            onCompleteClick(taskData.task, taskData.taskType);
          }
        });
      });
    }
  }

  /**
   * Check if we're in rapid completion mode to prevent excessive refreshes
   */
  _isInRapidCompletionMode() {
    const now = Date.now();
    this._recentCompletions = this._recentCompletions.filter(time => now - time < 5000); // 5 second window
    return this._recentCompletions.length >= 2;
  }

  /**
   * Track a completion for rapid completion detection
   */
  _trackCompletion() {
    this._recentCompletions.push(Date.now());
  }

  /**
   * Check if two task arrays are equal for change detection
   */
  _taskArraysEqual(tasks1, tasks2) {
    if (!tasks1 && !tasks2) return true;
    if (!tasks1 || !tasks2) return false;
    if (tasks1.length !== tasks2.length) return false;

    const getTaskKey = (task) => `${task.id}_${task.completed || false}_${task.outstanding_occurrences || 0}`;

    const keys1 = tasks1.map(getTaskKey).sort();
    const keys2 = tasks2.map(getTaskKey).sort();

    return keys1.every((key, index) => key === keys2[index]);
  }

  /**
   * Check if user context has changed significantly
   */
  _userContextEqual(ctx1, ctx2) {
    if (!ctx1 && !ctx2) return true;
    if (!ctx1 || !ctx2) return false;

    const relevantFields = ['timezone', 'daily_reset_time', 'current_logical_date'];
    return relevantFields.every(field => ctx1[field] === ctx2[field]);
  }

  /**
   * Detect if we can do a partial update vs full re-render
   */
  _canDoPartialUpdate(oldData, newData) {
    // Can't do partial updates if either data is missing
    if (!oldData || !newData) {
      return false;
    }

    // Check for structural changes that require full re-render
    const structuralChanges = [
      // Mode change (normal plan ↔ reduced/defaults plan)
      oldData.using_defaults !== newData.using_defaults,

      // User context changes
      !this._userContextEqual(oldData.user_context, newData.user_context),

      // Section structure changes (presence of sections)
      this._hasSectionStructureChanged(oldData, newData)
    ];

    if (structuralChanges.some(Boolean)) {
      return false;
    }

    // Check for complex changes
    const complexChanges = [
      // Too many changes at once
      this._hasTooManyChanges(oldData, newData)
    ];

    return !complexChanges.some(Boolean);
  }

  /**
   * Check if section structure has changed
   */
  _hasSectionStructureChanged(oldData, newData) {
    const oldHasSelfCare = (oldData.self_care || []).length > 0;
    const newHasSelfCare = (newData.self_care || []).length > 0;
    const oldHasTasks = (oldData.tasks || []).length > 0;
    const newHasTasks = (newData.tasks || []).length > 0;

    return oldHasSelfCare !== newHasSelfCare || oldHasTasks !== newHasTasks;
  }

  /**
   * Check if there are too many changes for efficient partial update
   */
  _hasTooManyChanges(oldData, newData) {
    const oldSelfCare = oldData.self_care || [];
    const newSelfCare = newData.self_care || [];
    const oldTasks = oldData.tasks || [];
    const newTasks = newData.tasks || [];

    // Count total changes
    let changeCount = 0;

    changeCount += Math.abs(oldSelfCare.length - newSelfCare.length);
    changeCount += Math.abs(oldTasks.length - newTasks.length);

    // Threshold for falling back to full re-render
    return changeCount > 3;
  }

  /**
   * Identify changes between old and new data for partial updates
   */
  _identifyChanges(oldData, newData) {
    const changes = {
      removedSelfCareTasks: [],
      removedTasks: [],
      addedSelfCareTasks: [],
      addedTasks: [],
      updatedSelfCareTasks: [],
      updatedTasks: []
    };

    const oldSelfCare = oldData.self_care || [];
    const newSelfCare = newData.self_care || [];
    const oldTasks = oldData.tasks || [];
    const newTasks = newData.tasks || [];

    // Create ID sets for quick lookup
    const oldSelfCareIds = new Set(oldSelfCare.map(t => t.id));
    const newSelfCareIds = new Set(newSelfCare.map(t => t.id));
    const oldTaskIds = new Set(oldTasks.map(t => t.id));
    const newTaskIds = new Set(newTasks.map(t => t.id));

    // Find removed tasks (most important for rapid completion)
    changes.removedSelfCareTasks = oldSelfCare.filter(task => !newSelfCareIds.has(task.id));
    changes.removedTasks = oldTasks.filter(task => !newTaskIds.has(task.id));

    // Find added tasks
    changes.addedSelfCareTasks = newSelfCare.filter(task => !oldSelfCareIds.has(task.id));
    changes.addedTasks = newTasks.filter(task => !oldTaskIds.has(task.id));

    // Find updated tasks (same ID but different content)
    const oldSelfCareMap = new Map(oldSelfCare.map(t => [t.id, t]));
    const oldTaskMap = new Map(oldTasks.map(t => [t.id, t]));

    changes.updatedSelfCareTasks = newSelfCare.filter(newTask => {
      const oldTask = oldSelfCareMap.get(newTask.id);
      return oldTask && !this._tasksEqual(oldTask, newTask);
    });

    changes.updatedTasks = newTasks.filter(newTask => {
      const oldTask = oldTaskMap.get(newTask.id);
      return oldTask && !this._tasksEqual(oldTask, newTask);
    });

    return changes;
  }

  /**
   * Compare two individual tasks for equality
   */
  _tasksEqual(task1, task2) {
    if (!task1 || !task2) return false;

    const relevantFields = [
      'id', 'name', 'completed', 'outstanding_occurrences',
      'required_occurrences', 'recommendation_score', 'windows'
    ];

    for (const field of relevantFields) {
      if (field === 'windows') {
        if (!this._windowsEqual(task1.windows, task2.windows)) return false;
      } else if (task1[field] !== task2[field]) {
        return false;
      }
    }

    return true;
  }

  /**
   * Compare window arrays for equality
   */
  _windowsEqual(windows1, windows2) {
    if (!windows1 && !windows2) return true;
    if (!windows1 || !windows2) return false;
    if (windows1.length !== windows2.length) return false;

    return windows1.every((w1, index) => {
      const w2 = windows2[index];
      return w1.completed === w2.completed && w1.label === w2.label;
    });
  }

  /**
   * Apply partial updates to the DOM
   */
  _applyPartialUpdates(changes) {
    // Remove completed tasks (most important case)
    this._removeTaskElements([...changes.removedSelfCareTasks, ...changes.removedTasks]);

    // Update section counts and empty states
    this._updateSectionStates();

    // Add new tasks (less common during normal usage)
    if (changes.addedSelfCareTasks.length > 0 || changes.addedTasks.length > 0) {
      // For now, fall back to full re-render for additions
      // This is less critical than handling removals efficiently
      return false;
    }

    // Update existing tasks (handle window completions, score changes, etc.)
    this._updateTaskElements([...changes.updatedSelfCareTasks, ...changes.updatedTasks]);

    return true;
  }

  /**
   * Remove task elements from DOM
   */
  _removeTaskElements(removedTasks) {
    removedTasks.forEach(task => {
      const taskType = task.task_type === 'SelfCareTask' ? 'self_care' : 'task';
      const taskKey = `${taskType}_${task.id}`;
      const element = this.shadowRoot.querySelector(`[data-task-key="${taskKey}"]`);

      if (element) {
        // Add fade-out animation
        element.classList.add('fade-out');

        // Remove after animation
        setTimeout(() => {
          if (element.parentNode) {
            element.remove();
          }
          // Remove from data manager
          this._taskDataManager.removeKey(taskKey);
        }, 300);
      }
    });
  }

  /**
   * Update section states (empty messages, counts)
   */
  _updateSectionStates() {
    // This is a hook for subclasses to implement section-specific updates
    // Each card type will have different section structure
  }

  /**
   * Update existing task elements
   */
  _updateTaskElements(updatedTasks) {
    // This is a hook for subclasses to implement task-specific updates
    // Different task types may need different update logic
  }
}

export default TaskTrackerTasksBaseCard;
