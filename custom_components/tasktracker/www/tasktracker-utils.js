/**
 * TaskTracker Shared Utilities
 *
 * Common functions and utilities shared across all TaskTracker cards
 */

export class TaskTrackerUtils {

  // User management utilities
  static async getAvailableUsers(hass) {
    try {
      const response = await hass.callService('tasktracker', 'get_available_users', {}, {}, true, true);
      if (response && response.response && response.response.data && response.response.data.users) {
        return response.response.data.users;
      }
    } catch (error) {
      console.warn('Failed to fetch available users:', error);
    }
    // Fallback to empty array if service fails
    return [];
  }

  // Enhanced user management utilities
  static async getEnhancedUsers(hass) {
    try {
      const response = await hass.callService('tasktracker', 'get_available_users', {}, {}, true, true);
      if (response && response.response && response.response.data) {
        // Return enhanced users if available, otherwise fallback to basic users
        if (response.response.data.enhanced_users) {
          return response.response.data.enhanced_users;
        } else if (response.response.data.users) {
          // Create basic enhanced user objects from usernames
          return response.response.data.users.map(username => ({
            username: username,
            display_name: username,
            ha_user_id: null
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to fetch enhanced users:', error);
    }
    // Fallback to empty array if service fails
    return [];
  }

  static getUserDisplayName(username, enhancedUsers) {
    if (!enhancedUsers || !Array.isArray(enhancedUsers)) {
      return username;
    }

    const userMapping = enhancedUsers.find(user => user.username === username);
    return userMapping ? userMapping.display_name : username;
  }

  static getUsernameFromDisplayName(displayName, enhancedUsers) {
    if (!enhancedUsers || !Array.isArray(enhancedUsers)) {
      return displayName;
    }

    const userMapping = enhancedUsers.find(user => user.display_name === displayName);
    return userMapping ? userMapping.username : displayName;
  }

  static getCurrentUsername(config, hass, availableUsers = null) {
    switch (config.user_filter_mode) {
      case 'explicit':
        return config.explicit_user;

      case 'current':
        // Try to map the current HA user to a TaskTracker username
        if (hass && hass.user && hass.user.name && availableUsers) {
          const currentUserName = hass.user.name.toLowerCase();

          // First try exact lowercase match
          if (availableUsers.includes(currentUserName)) {
            return currentUserName;
          }

          // Try case-insensitive match
          const matchedUser = availableUsers.find(user =>
            user.toLowerCase() === currentUserName
          );
          if (matchedUser) {
            return matchedUser;
          }

          // Try to match by first name if full name doesn't work
          const firstName = hass.user.name.split(' ')[0].toLowerCase();
          if (availableUsers.includes(firstName)) {
            return firstName;
          }

          // Try case-insensitive first name match
          const matchedFirstName = availableUsers.find(user =>
            user.toLowerCase() === firstName
          );
          if (matchedFirstName) {
            return matchedFirstName;
          }
        }

        // If no availableUsers provided or no match found, return null
        // Backend will handle user mapping via call context as fallback
        return null;

      case 'all':
      default:
        return null; // No username filter
    }
  }

  static hasValidUserConfig(config) {
    return config.user_filter_mode &&
      (config.user_filter_mode === 'all' ||
        config.user_filter_mode === 'current' ||
        (config.user_filter_mode === 'explicit' && config.explicit_user));
  }

  static getUsernameForAction(config, hass, availableUsers = null) {
    let username = TaskTrackerUtils.getCurrentUsername(config, hass, availableUsers);

    // If we're in "all users" mode and no username is configured,
    // return null to let the backend handle user mapping via call context
    if (config.user_filter_mode === 'all' && !username) {
      return null;
    }

    return username;
  }

  // Toast notification utilities
  static showSuccess(message) {
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

  static showError(message) {
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

  // Date and time formatting utilities
  static formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  }

  static formatDueDate(dueDateString) {
    try {
      const dueDate = new Date(dueDateString);
      const now = new Date();
      const diffMs = dueDate - now;

      // Use calendar day difference instead of 24-hour periods
      // This accounts for timezone boundaries properly
      const dueDateLocal = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.floor((dueDateLocal - nowLocal) / (1000 * 60 * 60 * 24));

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

  static formatDateTime(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;

      // Use calendar day difference instead of 24-hour periods
      // This accounts for timezone boundaries properly
      const dateLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.floor((nowLocal - dateLocal) / (1000 * 60 * 60 * 24));

      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      // Return relative time for recent completions
      if (diffDays === 0) {
        if (diffHours === 0) {
          if (diffMinutes < 1) {
            return 'Just now';
          }
          return `${diffMinutes}m ago`;
        }
        return `${diffHours}h ago`;
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else {
        return `${diffDays} days ago`;
      }
    } catch {
      return dateString;
    }
  }

  static formatDuration(minutes) {
    if (!minutes) return 'Unknown';

    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  }

  // Priority formatting
  static formatPriority(priority) {
    const priorityStringMap = {
      'High': 1,
      'Medium': 2,
      'Low': 3
    };

    const priorityMap = {
      3: 'Low',
      2: 'Medium',
      1: 'High',
      4: 'Very Low',
      5: 'Minimal'
    };

    if (priority in priorityStringMap) {
      return priorityMap[priorityStringMap[priority]];
    } else {
      return priorityMap[priority] || `Priority ${priority}`;
    }
  }

  // Priority normalization - converts string priorities to integer values
  static normalizePriority(priority) {
    const priorityStringMap = {
      'High': 1,
      'Medium': 2,
      'Low': 3,
      'Very Low': 4,
      'Minimal': 5
    };

    if (typeof priority === 'string' && priority in priorityStringMap) {
      return priorityStringMap[priority];
    }

    // If it's already a number, return as-is
    if (typeof priority === 'number') {
      return priority;
    }

    // Fallback to null if we can't determine the priority
    return null;
  }

  // Task and leftover completion methods
  static async completeTask(hass, taskName, username, notes) {
    try {
      const params = {
        name: taskName
      };

      // Only include completed_by if username is provided
      // If null, let backend handle user mapping via call context
      if (username) {
        params.completed_by = username;
      }

      if (notes) {
        params.notes = notes;
      }

      const response = await hass.callService('tasktracker', 'complete_task_by_name', params, {}, true, true);

      if (response && response.response && response.response.success) {
        TaskTrackerUtils.showSuccess(response.response.spoken_response || 'Task completed successfully');
        return response.response;
      } else {
        throw new Error('Failed to complete task');
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      TaskTrackerUtils.showError('Failed to complete task: ' + error.message);
      throw error;
    }
  }

  // Completion editing methods
  static async deleteCompletion(hass, completionId) {
    try {
      const params = {
        completion_id: completionId
      };

      const response = await hass.callService('tasktracker', 'delete_completion', params, {}, true, true);

      if (response && response.response && response.response.success) {
        TaskTrackerUtils.showSuccess(response.response.spoken_response || 'Completion deleted successfully');
        return response.response;
      } else {
        throw new Error('Failed to delete completion');
      }
    } catch (error) {
      console.error('Failed to delete completion:', error);
      TaskTrackerUtils.showError('Failed to delete completion: ' + error.message);
      throw error;
    }
  }

  static async updateCompletion(hass, completionId, updates) {
    try {
      const params = {
        completion_id: completionId,
        ...updates
      };

      const response = await hass.callService('tasktracker', 'update_completion', params, {}, true, true);

      if (response && response.response && response.response.success) {
        TaskTrackerUtils.showSuccess(response.response.spoken_response || 'Completion updated successfully');
        return response.response;
      } else {
        throw new Error('Failed to update completion');
      }
    } catch (error) {
      console.error('Failed to update completion:', error);
      TaskTrackerUtils.showError('Failed to update completion: ' + error.message);
      throw error;
    }
  }

  // Task update utility
  static async updateTask(hass, taskId, taskType, assignedTo, updates) {
    const serviceData = {
      task_id: taskId,
      task_type: taskType,
      assigned_to: assignedTo,
      ...updates
    };

    const response = await hass.callService('tasktracker', 'update_task', serviceData, {}, true, true);

    // Fire a custom event to notify other cards
    if (response && response.response && response.response.success) {
      await TaskTrackerUtils.fireTaskEvent(hass, 'task_updated', {
        task_id: taskId,
        updates: updates,
        update_data: response.response.data
      });
    }

    return response.response;
  }

  // Leftover disposal utility
  static async disposeLeftover(hass, leftoverName, username, notes) {
    const serviceData = {
      name: leftoverName,
      event_type: 'leftover_disposed'
    };

    // Only include assigned_to if username is provided
    // If null, let backend handle user mapping via call context
    if (username) {
      serviceData.assigned_to = username;
    }

    if (notes) {
      serviceData.notes = notes;
    }

    const response = await hass.callService('tasktracker', 'complete_task_by_name', serviceData, {}, true, true);

    // Fire a custom event to notify other cards
    if (response && response.response && response.response.success) {
      await TaskTrackerUtils.fireTaskEvent(hass, 'leftover_disposed', {
        leftover_name: leftoverName,
        username: username,
        notes: notes,
        disposal_data: response.response.data
      });
    }

    return response.response;
  }

  // Event listening utility for cross-card communication
  static setupTaskCompletionListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'task_completed', callback);
  }

  // Event listening utility for leftover disposal events
  static setupLeftoverDisposalListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'leftover_disposed', callback);
  }

  // Event listening utility for task creation events
  static setupTaskCreationListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'task_created', callback);
  }

  // Event listening utility for leftover creation events
  static setupLeftoverCreationListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'leftover_created', callback);
  }

  // Event listening utility for task update events
  static setupTaskUpdateListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'task_updated', callback);
  }

  // Event listening utility for completion deletion events
  static setupCompletionDeletionListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'completion_deleted', callback);
  }

  // Generic event listening utility for cross-card communication
  static setupEventListener(hass, eventType, callback) {
    // Use Home Assistant's event bus to listen for custom events
    // subscribeEvents returns a promise that resolves to an unsubscribe function
    let unsubscribePromise = hass.connection.subscribeEvents(
      (event) => {
        callback(event.data);
      },
      `tasktracker_${eventType}`
    );

    // Track if this subscription has been cleaned up
    let isCleanedUp = false;

    // Return cleanup function that handles the promise properly
    return async () => {
      if (isCleanedUp) {
        return; // Already cleaned up, avoid duplicate cleanup
      }

      try {
        const unsubscribe = await unsubscribePromise;
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (error) {
        // Only warn for unexpected errors, not "not_found" which is common during re-renders
        if (error.code !== 'not_found') {
          console.warn('Error cleaning up TaskTracker event listener:', error);
        }
      } finally {
        isCleanedUp = true;
      }
    };
  }

  // Generic event firing utility for other task actions
  static async fireTaskEvent(hass, eventType, data) {
    try {
      // Use Home Assistant's REST API to fire custom events
      const eventUrl = `/api/events/tasktracker_${eventType}`;
      await hass.callApi('POST', eventUrl.substring(5), data); // Remove '/api/' prefix as callApi adds it
    } catch (error) {
      console.warn('Failed to fire TaskTracker event:', error);
    }
  }

  // Utility functions for task editing
  static formatDateTimeForInput(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Format as YYYY-MM-DDTHH:MM for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  }

  static getPriorityOptions() {
    return [
      { value: 1, label: 'High' },
      { value: 2, label: 'Medium' },
      { value: 3, label: 'Low' }
    ];
  }

  static getFrequencyDaysOptions() {
    return [
      { value: 1, label: 'Daily (1 day)' },
      { value: 3, label: 'Twice Weekly (3 days)' },
      { value: 7, label: 'Weekly (7 days)' },
      { value: 14, label: 'Biweekly (14 days)' },
      { value: 30, label: 'Monthly (30 days)' },
      { value: 90, label: 'Quarterly (90 days)' },
      { value: 365, label: 'Yearly (365 days)' }
    ];
  }

  // Modal creation utilities
  static createStyledButton(text, type = 'default', onClick = null) {
    const button = document.createElement('button');
    button.textContent = text;

    if (type === 'error') {
      button.style.cssText = `
        padding: 6px 12px;
        border: 1px solid var(--error-color, #f44336);
        border-radius: 4px;
        background: transparent;
        color: var(--error-color, #f44336);
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8em;
      `;

      // Error button hover effect
      button.addEventListener('mouseenter', () => {
        button.style.background = 'var(--error-color, #f44336)';
        button.style.color = 'white';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = 'transparent';
        button.style.color = 'var(--error-color, #f44336)';
      });
    } else {
      // Default button styling
      button.style.cssText = `
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: var(--secondary-text-color);
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8em;
      `;

      // Default button hover effect
      button.addEventListener('mouseenter', () => {
        button.style.background = 'var(--divider-color)';
        button.style.color = 'var(--primary-text-color)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = 'transparent';
        button.style.color = 'var(--secondary-text-color)';
      });
    }

    if (onClick) {
      button.addEventListener('click', onClick);
    }

    return button;
  }

  static createTaskModal(task, config, onComplete, onSave = null, availableUsers = [], enhancedUsers = null) {
    const modal = document.createElement('div');
    modal.className = 'task-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: var(--card-background-color);
      border-radius: 8px;
      padding: 24px;
      width: 90%;
      max-width: 500px;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font-family: var(--primary-font-family);
    `;

    const taskName = task.name || task.task_name;
    const taskDuration = task.duration_minutes || task.task_duration_minutes || 0;
    const taskPriority = task.priority || task.task_priority_value || 2;
    const taskFrequencyDays = task.frequency_days || task.task_frequency_days;
    const assignedTo = task.assigned_to;
    const dueDate = task.next_due || task.due_date;

    // Format due date for datetime-local input
    const formattedDueDate = dueDate ? TaskTrackerUtils.formatDateTimeForInput(dueDate) : '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    `;

    const title = document.createElement('h3');
    title.textContent = taskName;
    title.style.cssText = `
      margin: 0;
      color: var(--primary-text-color);
      font-size: 1.5em;
      font-weight: 500;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--secondary-text-color);
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    header.appendChild(title);
    header.appendChild(closeButton);

    // Task details grid
    const detailsGrid = document.createElement('div');
    detailsGrid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    `;

    // Duration field (editable if onSave is provided)
    const durationField = document.createElement('div');
    durationField.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    const durationLabel = document.createElement('label');
    durationLabel.textContent = 'Duration';
    durationLabel.style.cssText = `
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    let durationControl;
    if (onSave) {
      durationControl = document.createElement('input');
      durationControl.type = 'number';
      durationControl.value = taskDuration;
      durationControl.min = '1';
      durationControl.style.cssText = `
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      `;
    } else {
      durationControl = document.createElement('span');
      durationControl.textContent = TaskTrackerUtils.formatDuration(taskDuration);
      durationControl.style.cssText = `
        padding: 8px;
        color: var(--primary-text-color);
        font-size: 14px;
      `;
    }

    durationField.appendChild(durationLabel);
    durationField.appendChild(durationControl);

    // Priority field (editable if onSave is provided)
    const priorityField = document.createElement('div');
    priorityField.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    const priorityLabel = document.createElement('label');
    priorityLabel.textContent = 'Priority';
    priorityLabel.style.cssText = `
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    let priorityControl;
    if (onSave) {
      priorityControl = document.createElement('select');
      priorityControl.style.cssText = `
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      `;
      TaskTrackerUtils.getPriorityOptions().forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        optionElement.selected = option.value === taskPriority;
        priorityControl.appendChild(optionElement);
      });
    } else {
      priorityControl = document.createElement('span');
      priorityControl.textContent = TaskTrackerUtils.formatPriority(taskPriority);
      priorityControl.style.cssText = `
        padding: 8px;
        color: var(--primary-text-color);
        font-size: 14px;
      `;
    }

    priorityField.appendChild(priorityLabel);
    priorityField.appendChild(priorityControl);

    detailsGrid.appendChild(durationField);
    detailsGrid.appendChild(priorityField);

    // Due date field (editable if onSave is provided and task is recurring)
    if (taskFrequencyDays) {
      const dueDateField = document.createElement('div');
      dueDateField.style.cssText = 'display: flex; flex-direction: column; gap: 4px; grid-column: 1 / -1;';
      const dueDateLabel = document.createElement('label');
      dueDateLabel.textContent = 'Due Date';
      dueDateLabel.style.cssText = `
        font-size: 0.85em;
        color: var(--secondary-text-color);
        font-weight: 500;
      `;

      let dueDateControl;
      if (onSave) {
        dueDateControl = document.createElement('input');
        dueDateControl.type = 'datetime-local';
        dueDateControl.value = formattedDueDate;
        dueDateControl.style.cssText = `
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
        `;
      } else {
        dueDateControl = document.createElement('span');
        dueDateControl.textContent = dueDate ? TaskTrackerUtils.formatDateTime(dueDate) : 'Not set';
        dueDateControl.style.cssText = `
          padding: 8px;
          color: var(--primary-text-color);
          font-size: 14px;
        `;
      }

      dueDateField.appendChild(dueDateLabel);
      dueDateField.appendChild(dueDateControl);
      detailsGrid.appendChild(dueDateField);
    }

    // Assignment field (editable if onSave is provided and users available)
    if (onSave && availableUsers && availableUsers.length > 0) {
      const assignmentField = document.createElement('div');
      assignmentField.style.cssText = 'display: flex; flex-direction: column; gap: 4px; grid-column: 1 / -1;';
      const assignmentLabel = document.createElement('label');
      assignmentLabel.textContent = 'Assigned To';
      assignmentLabel.style.cssText = `
        font-size: 0.85em;
        color: var(--secondary-text-color);
        font-weight: 500;
      `;

      const assignmentControl = document.createElement('select');
      assignmentControl.style.cssText = `
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      `;

      availableUsers.forEach(username => {
        const optionElement = document.createElement('option');
        optionElement.value = username;
        optionElement.textContent = TaskTrackerUtils.getUserDisplayName(username, enhancedUsers);
        optionElement.selected = username === assignedTo;
        assignmentControl.appendChild(optionElement);
      });

      assignmentField.appendChild(assignmentLabel);
      assignmentField.appendChild(assignmentControl);
      detailsGrid.appendChild(assignmentField);
    }

    // Notes section
    const notesSection = document.createElement('div');
    notesSection.style.cssText = 'margin-bottom: 20px;';

    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Task Notes';
    notesLabel.style.cssText = `
      display: block;
      margin-bottom: 8px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    const taskNotes = document.createElement('div');
    taskNotes.textContent = task.notes;
    taskNotes.style.cssText = `
      padding: 12px;
      background: var(--secondary-background-color);
      border-radius: 4px;
      color: var(--primary-text-color);
      font-size: 14px;
      line-height: 1.4;
      margin-bottom: 16px;
      min-height: 40px;
    `;

    const completionNotesLabel = document.createElement('label');
    completionNotesLabel.textContent = config.show_completion_notes !== false ? 'Completion Notes (Optional)' : '';
    completionNotesLabel.style.cssText = `
      display: ${config.show_completion_notes !== false ? 'block' : 'none'};
      margin-bottom: 8px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    const completionNotesTextarea = document.createElement('textarea');
    completionNotesTextarea.placeholder = 'Add completion notes...';
    completionNotesTextarea.style.cssText = `
      width: 100%;
      min-height: 80px;
      padding: 12px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
      display: ${config.show_completion_notes !== false ? 'block' : 'none'};
    `;

    notesSection.appendChild(notesLabel);
    notesSection.appendChild(taskNotes);
    notesSection.appendChild(completionNotesLabel);
    notesSection.appendChild(completionNotesTextarea);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 24px;
    `;

    const cancelButton = TaskTrackerUtils.createStyledButton('Cancel');

    // Save button (only if onSave callback provided)
    let saveButton;
    if (onSave) {
      saveButton = TaskTrackerUtils.createStyledButton('Save');
    }

    const completeButton = TaskTrackerUtils.createStyledButton('Complete');

    // Append buttons in correct order: Cancel, Save (if exists), Complete
    buttonContainer.appendChild(cancelButton);
    if (saveButton) {
      buttonContainer.appendChild(saveButton);
    }
    buttonContainer.appendChild(completeButton);

    // Assemble modal content
    modalContent.appendChild(header);
    modalContent.appendChild(detailsGrid);
    modalContent.appendChild(notesSection);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);

    const closeModal = () => {
      if (modal.parentNode) {
        modal.style.opacity = '0';
        setTimeout(() => {
          if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
          }
        }, 200);
      }
    };

    // Event handlers
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Save button handler
    if (saveButton && onSave) {
      saveButton.addEventListener('click', async () => {
        const updates = {};

        // Collect duration changes
        if (durationControl.value && parseInt(durationControl.value) !== taskDuration) {
          updates.duration_minutes = parseInt(durationControl.value);
        }

        // Collect priority changes
        if (priorityControl.value && parseInt(priorityControl.value) !== taskPriority) {
          updates.priority = parseInt(priorityControl.value);
        }

        // Collect due date changes (if applicable)
        if (taskFrequencyDays && dueDateControl.value) {
          const newDueDate = new Date(dueDateControl.value).toISOString();
          if (newDueDate !== dueDate) {
            updates.next_due = newDueDate;
          }
        }

        // Collect assignment changes (if applicable)
        const assignmentSelect = assignmentField?.querySelector('select');
        if (assignmentSelect && assignmentSelect.value !== assignedTo) {
          updates.assigned_to = assignmentSelect.value;
        }

        if (Object.keys(updates).length > 0) {
          try {
            await onSave(updates);
            closeModal();
          } catch (error) {
            console.error('Failed to save task:', error);
            // Error handling is done in the onSave callback
          }
        } else {
          closeModal();
        }
      });
    }

    // Complete button handler
    completeButton.addEventListener('click', async () => {
      const notes = completionNotesTextarea.value.trim();
      try {
        await onComplete(notes);
        closeModal();
      } catch (error) {
        console.error('Failed to complete task:', error);
        // Error handling is done in the onComplete callback
      }
    });

    // Apply fade-in animation
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.transition = 'opacity 0.2s ease';
      modal.style.opacity = '1';
    }, 10);

    return modal;
  }

  static createCompletionEditModal(completion, config, onDelete, onUpdate, availableUsers = [], enhancedUsers = null) {
    const modal = document.createElement('div');
    modal.className = 'completion-edit-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: var(--card-background-color);
      border-radius: 8px;
      padding: 24px;
      width: 90%;
      max-width: 450px;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font-family: var(--primary-font-family);
    `;

    const taskName = completion.task_name || completion.name;
    const completedBy = completion.completed_by;
    const completedAt = completion.completed_at;
    const notes = completion.notes || '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    `;

    const title = document.createElement('h3');
    title.textContent = `Edit Completion`;
    title.style.cssText = `
      margin: 0;
      color: var(--primary-text-color);
      font-size: 1.3em;
      font-weight: 500;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--secondary-text-color);
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    header.appendChild(title);
    header.appendChild(closeButton);

    // Task name display
    const taskNameField = document.createElement('div');
    taskNameField.style.cssText = 'margin-bottom: 16px;';
    const taskNameLabel = document.createElement('label');
    taskNameLabel.textContent = 'Task Name';
    taskNameLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;
    const taskNameValue = document.createElement('div');
    taskNameValue.textContent = taskName;
    taskNameValue.style.cssText = `
      padding: 8px;
      background: var(--secondary-background-color);
      border-radius: 4px;
      color: var(--primary-text-color);
      font-size: 14px;
    `;
    taskNameField.appendChild(taskNameLabel);
    taskNameField.appendChild(taskNameValue);

    // Completed by field (editable if users are available)
    const completedByField = document.createElement('div');
    completedByField.style.cssText = 'margin-bottom: 16px;';
    const completedByLabel = document.createElement('label');
    completedByLabel.textContent = 'Completed By';
    completedByLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    let completedByControl;
    if (availableUsers && availableUsers.length > 0) {
      completedByControl = document.createElement('select');
      completedByControl.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      `;

      availableUsers.forEach(username => {
        const optionElement = document.createElement('option');
        optionElement.value = username;
        optionElement.textContent = TaskTrackerUtils.getUserDisplayName(username, enhancedUsers);
        optionElement.selected = username === completedBy;
        completedByControl.appendChild(optionElement);
      });
    } else {
      completedByControl = document.createElement('div');
      completedByControl.textContent = TaskTrackerUtils.getUserDisplayName(completedBy, enhancedUsers);
      completedByControl.style.cssText = `
        padding: 8px;
        background: var(--secondary-background-color);
        border-radius: 4px;
        color: var(--primary-text-color);
        font-size: 14px;
      `;
    }

    completedByField.appendChild(completedByLabel);
    completedByField.appendChild(completedByControl);

    // Completion date display
    const completedAtField = document.createElement('div');
    completedAtField.style.cssText = 'margin-bottom: 16px;';
    const completedAtLabel = document.createElement('label');
    completedAtLabel.textContent = 'Completed At';
    completedAtLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;
    const completedAtValue = document.createElement('div');
    completedAtValue.textContent = TaskTrackerUtils.formatDateTime(completedAt);
    completedAtValue.style.cssText = `
      padding: 8px;
      background: var(--secondary-background-color);
      border-radius: 4px;
      color: var(--primary-text-color);
      font-size: 14px;
    `;
    completedAtField.appendChild(completedAtLabel);
    completedAtField.appendChild(completedAtValue);

    // Notes field (editable)
    const notesField = document.createElement('div');
    notesField.style.cssText = 'margin-bottom: 20px;';
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes';
    notesLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;
    const notesTextarea = document.createElement('textarea');
    notesTextarea.value = notes;
    notesTextarea.placeholder = 'Add notes about this completion...';
    notesTextarea.style.cssText = `
      width: 100%;
      min-height: 80px;
      padding: 8px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
    `;
    notesField.appendChild(notesLabel);
    notesField.appendChild(notesTextarea);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: space-between;
      margin-top: 24px;
    `;

    const undoButton = TaskTrackerUtils.createStyledButton('Undo Completion', 'error');

    const rightButtons = document.createElement('div');
    rightButtons.style.cssText = 'display: flex; gap: 8px;';

    const cancelButton = TaskTrackerUtils.createStyledButton('Cancel');
    const updateButton = TaskTrackerUtils.createStyledButton('Update');

    rightButtons.appendChild(cancelButton);
    rightButtons.appendChild(updateButton);
    buttonContainer.appendChild(undoButton);
    buttonContainer.appendChild(rightButtons);

    // Assemble modal content
    modalContent.appendChild(header);
    modalContent.appendChild(taskNameField);
    modalContent.appendChild(completedByField);
    modalContent.appendChild(completedAtField);
    modalContent.appendChild(notesField);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);

    const closeModal = () => {
      if (modal.parentNode) {
        modal.style.opacity = '0';
        setTimeout(() => {
          if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
          }
        }, 200);
      }
    };

    // Event handlers
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Undo button handler
    undoButton.addEventListener('click', async () => {
      try {
        await onDelete();
        closeModal();
      } catch (error) {
        console.error('Failed to delete completion:', error);
        // Error handling is done in the onDelete callback
      }
    });

    // Update button handler
    updateButton.addEventListener('click', async () => {
      const updates = {};

      // Check for completed_by changes
      if (availableUsers && availableUsers.length > 0 && completedByControl.value !== completedBy) {
        updates.completed_by = completedByControl.value;
      }

      // Check for notes changes
      if (notesTextarea.value !== notes) {
        updates.notes = notesTextarea.value;
      }

      if (Object.keys(updates).length > 0) {
        try {
          await onUpdate(updates);
          closeModal();
        } catch (error) {
          console.error('Failed to update completion:', error);
          // Error handling is done in the onUpdate callback
        }
      } else {
        closeModal();
      }
    });

    // Apply fade-in animation
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.transition = 'opacity 0.2s ease';
      modal.style.opacity = '1';
    }, 10);

    return modal;
  }

  static showModal(modal) {
    document.body.appendChild(modal);
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
    });
  }

  // Configuration utilities
  static createConfigRow(label, description, inputHtml) {
    return `
      <div class="config-row">
        <label>
          ${label}
          ${description ? `<div class="config-description">${description}</div>` : ''}
        </label>
        ${inputHtml}
      </div>
    `;
  }

  static createNumberInput(value, configKey, min = null, max = null, step = null) {
    const attrs = [
      `value="${value}"`,
      `data-config-key="${configKey}"`,
      min !== null ? `min="${min}"` : '',
      max !== null ? `max="${max}"` : '',
      step !== null ? `step="${step}"` : ''
    ].filter(Boolean).join(' ');

    return `<input type="number" ${attrs} />`;
  }

  static createTextInput(value, configKey, placeholder = '') {
    return `
      <input
        type="text"
        value="${value || ''}"
        data-config-key="${configKey}"
        placeholder="${placeholder}"
      />
    `;
  }

  static createCheckboxInput(checked, configKey) {
    return `
      <input
        type="checkbox"
        ${checked ? 'checked' : ''}
        data-config-key="${configKey}"
      />
    `;
  }

  static createSelectInput(value, configKey, options) {
    const optionsHtml = options.map(option => {
      const optionValue = typeof option === 'string' ? option : option.value;
      const optionLabel = typeof option === 'string' ? option : option.label;
      const selected = value === optionValue ? 'selected' : '';
      return `<option value="${optionValue}" ${selected}>${optionLabel}</option>`;
    }).join('');

    return `<select data-config-key="${configKey}">${optionsHtml}</select>`;
  }

  static capitalize(string) {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // Common styles for cards
  static getCommonCardStyles() {
    return `
      :host {
        display: block;
      }

      .card {
        padding: 16px;
        font-family: var(--primary-font-family);
        background: var(--card-background-color);
        border-radius: var(--ha-card-border-radius, 12px);
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
        padding: 2px;
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
        color: var(--error-color);
        text-align: center;
        font-style: italic;
        padding: 16px;
      }

      .no-tasks {
        color: var(--secondary-text-color);
      }

      .no-user-warning {
        color: var(--primary-text-color);
        background: var(--secondary-background-color);
        padding: 12px;
        border-radius: 4px;
        border: 1px solid var(--divider-color);
        text-align: center;
        margin-bottom: 16px;
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

      .task-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 4px;
          background: var(--secondary-background-color);
          border-radius: 4px;
          border-left: 2px solid var(--secondary-text-color);
          cursor: pointer;
        }

        .task-item.needs-completion {
          border-left: 2px solid var(--primary-color);
        }

        .task-item.completed {
          border-left: 2px solid var(--success-color);
        }

        .task-item:hover {
          background: var(--divider-color);
        }

        .task-item:last-child {
          margin-bottom: 0;
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
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .completion-indicator {
          width: 6px;
          height: 6px;
          background: var(--primary-color);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .task-metadata {
          font-size: 0.8em;
          color: var(--secondary-text-color);
        }

      @keyframes pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.8; }
      }

      .complete-btn,
      .dispose-btn {
        background: transparent;
        border: none;
        color: var(--secondary-text-color);
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
        transition: background-color 0.2s ease;
      }

      .complete-btn:hover,
      .dispose-btn:hover {
        background: var(--divider-color);
        color: var(--primary-text-color);
      }

      .complete-btn:active,
      .dispose-btn:active {
        transform: scale(0.95);
      }

      .category {
        margin-bottom: 16px;
      }

      .category-title {
        font-size: 1.1em;
        margin-bottom: 8px;
      }
    `;
  }

  // Common styles for config editors
  static getCommonConfigStyles() {
    return `
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
    `;
  }

  // Auto-refresh setup utility
  static setupAutoRefresh(refreshCallback, intervalSeconds) {
    // Validate interval before setting up the timer
    const intervalMs = intervalSeconds * 1000;
    if (isNaN(intervalMs) || intervalMs <= 0) {
      console.warn('Invalid refresh interval, skipping auto-refresh setup');
      return null;
    }

    return setInterval(refreshCallback, intervalMs);
  }

  // Array equality check utility
  static arraysEqual(arr1, arr2, compareFunction) {
    if (arr1.length !== arr2.length) return false;

    for (let i = 0; i < arr1.length; i++) {
      if (!compareFunction(arr1[i], arr2[i])) {
        return false;
      }
    }

    return true;
  }

  // Common config value change handler for card editors
  static handleConfigValueChange(ev, editorInstance, updateConfigCallback, optionalFields = ['explicit_user', 'user', 'default_user']) {
    if (!editorInstance._config || !editorInstance._hass) {
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
      const parsedValue = parseInt(target.value, 10);
      // Handle empty values or invalid numbers by using null to trigger default fallback
      value = isNaN(parsedValue) ? null : parsedValue;
    } else {
      value = target.value || null;
    }

    // Handle empty string for optional fields
    if (optionalFields.includes(configKey) && value === '') {
      value = null;
    }

    // For text inputs, debounce the config update to avoid frequent API calls
    if (target.type === 'text') {
      // Initialize debounce timers if not exists
      if (!editorInstance._debounceTimers) {
        editorInstance._debounceTimers = {};
      }

      // Clear any existing timer for this field
      if (editorInstance._debounceTimers[configKey]) {
        clearTimeout(editorInstance._debounceTimers[configKey]);
      }

      // Set a new timer to update config after user stops typing
      editorInstance._debounceTimers[configKey] = setTimeout(() => {
        updateConfigCallback(configKey, value);
        delete editorInstance._debounceTimers[configKey];
      }, 500); // Wait 500ms after user stops typing
    } else {
      // For non-text inputs (checkboxes, selects, numbers), update immediately
      updateConfigCallback(configKey, value);
    }
  }
}