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
}

export default TaskTrackerTasksBaseCard;
