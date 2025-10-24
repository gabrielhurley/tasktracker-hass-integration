import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';

/**
 * TaskTracker Complete Task Card
 *
 * A custom Lovelace card for completing arbitrary tasks:
 * - Task name dropdown populated from all tasks
 * - Username dropdown populated from configured users
 * - Notes freeform text field
 * - Complete task button
 */

class TaskTrackerCompleteTaskCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._allTasks = [];
    this._availableUsers = [];
    this._loading = false;
    this._error = null;
    this._completing = false;
    this._shouldResetForm = false;
    this._eventCleanup = null; // Store event listener cleanup function
  }

  static getConfigElement() {
    return document.createElement('tasktracker-complete-task-card-editor');
  }

  static getStubConfig() {
    return {
      show_task_details: true,
      show_header: true,
      default_user_mode: 'current', // 'current', 'explicit', 'none'
      default_user: null
    };
  }

  setConfig(config) {
    this._config = {
      show_task_details: config.show_task_details !== false,
      show_header: config.show_header !== false,
      default_user_mode: config.default_user_mode || 'current',
      default_user: config.default_user || null,
      ...config
    };

    this._render();
  }

  set hass(hass) {
    const wasInitialized = this._hass !== null;
    this._hass = hass;

    // Always set up event listeners when hass changes
    this._setupEventListeners();

    // Only fetch initial data on first hass assignment
    if (!wasInitialized && hass) {
      this._fetchInitialData();
    }
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
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

  async _fetchInitialData() {
    await Promise.all([
      this._fetchAllTasks(),
      this._loadAvailableUsers()
    ]);
  }

  async _fetchAllTasks() {
    this._loading = true;
    this._error = null;
    this._render();

    try {
      const response = await this._hass.callService('tasktracker', 'get_all_tasks', { thin: true }, {}, true, true);

      if (response && response.response && response.response.data && response.response.data.items) {
        this._allTasks = response.response.data.items.sort((a, b) => a.name.localeCompare(b.name));
      } else {
        this._allTasks = [];
      }

      this._loading = false;
      this._render();
    } catch (error) {
      console.error('Failed to fetch all tasks:', error);
      this._error = `Failed to fetch tasks: ${error.message}`;
      this._allTasks = [];
      this._loading = false;
      this._render();
    }
  }

  async _loadAvailableUsers() {
    try {
      const response = await this._hass.callService('tasktracker', 'get_available_users', {}, {}, true, true);

      if (response && response.response && response.response.data && response.response.data.users) {
        this._availableUsers = response.response.data.users;
      } else {
        // Fallback to hardcoded users if service fails
        this._availableUsers = [];
      }
    } catch (error) {
      console.error('Failed to fetch available users:', error);
      // Fallback to hardcoded users if service fails
      this._availableUsers = [];
    }
  }

  _getCurrentUsername() {
    switch (this._config.default_user_mode) {
      case 'explicit':
        return this._config.default_user;

      case 'current':
        // For current user mode, we need to find the mapped TaskTracker username
        // The available users list contains the actual TaskTracker usernames
        // We should check if there's a way to get the mapped username for the current HA user
        if (this._hass && this._hass.user && this._hass.user.name) {
          const currentUserName = this._hass.user.name.toLowerCase();

          // First try exact match with current logic for backward compatibility
          if (this._availableUsers.includes(currentUserName)) {
            return currentUserName;
          }

          // Try case-insensitive match
          const matchedUser = this._availableUsers.find(user =>
            user.toLowerCase() === currentUserName
          );
          if (matchedUser) {
            return matchedUser;
          }

          // Try to match by first name if full name doesn't work
          const firstName = this._hass.user.name.split(' ')[0].toLowerCase();
          if (this._availableUsers.includes(firstName)) {
            return firstName;
          }

          // Try case-insensitive first name match
          const matchedFirstName = this._availableUsers.find(user =>
            user.toLowerCase() === firstName
          );
          if (matchedFirstName) {
            return matchedFirstName;
          }
        }
        return null;

      default:
        return null;
    }
  }

  async _completeTask() {
    const taskSelect = this.shadowRoot.querySelector('#task-select');
    const usernameSelect = this.shadowRoot.querySelector('#username-select');
    const notesField = this.shadowRoot.querySelector('#notes-field');

    const selectedTaskIndex = taskSelect.value;
    const selectedUsername = usernameSelect.value;
    const notes = notesField.value.trim();

    if (!selectedTaskIndex) {
      this._showError('Please select a task');
      return;
    }

    if (!selectedUsername) {
      this._showError('Please select a username');
      return;
    }

    // Get the task object from the index
    const taskIndex = parseInt(selectedTaskIndex, 10);
    if (taskIndex < 0 || taskIndex >= this._allTasks.length) {
      this._showError('Invalid task selection');
      return;
    }

    const selectedTask = this._allTasks[taskIndex];

    this._completing = true;
    this._render();

    try {
      const response = await TaskTrackerUtils.completeTask(this._hass, selectedTask.id, selectedTask.task_type, selectedUsername, notes);

      if (response && response.success) {
        // Success message is handled by TaskTrackerUtils.completeTask to avoid duplication

        // Mark that we should reset the form on next render
        this._shouldResetForm = true;
      } else {
        const errorMsg = (response && response.message) || 'Unknown error';
        TaskTrackerUtils.showError(`Failed to complete task: ${errorMsg}`);
      }

      this._completing = false;
      this._render();

    } catch (error) {
      console.error('Failed to complete task:', error);
      TaskTrackerUtils.showError(`Failed to complete task: ${error.message}`);
      this._completing = false;
      this._render();
    }
  }

  _getSelectedTask(taskIndex = null) {
    // If taskIndex is provided, use it; otherwise try to get from DOM
    let selectedTaskIndex = taskIndex;
    if (selectedTaskIndex === null || selectedTaskIndex === '') {
      const taskSelect = this.shadowRoot.querySelector('#task-select');
      if (!taskSelect || !taskSelect.value) return null;
      selectedTaskIndex = taskSelect.value;
    }

    const index = parseInt(selectedTaskIndex, 10);
    if (index < 0 || index >= this._allTasks.length) return null;
    return this._allTasks[index];
  }

  _formatTaskDetails(task) {
    if (!task) return '';

    const details = [];

    if (task.priority) {
      const priorityMap = { 1: 'High', 2: 'Medium', 3: 'Low' };
      details.push(`Priority: ${priorityMap[task.priority] || task.priority}`);
    }

    if (task.duration_minutes) {
      const duration = task.duration_minutes < 60
        ? `${task.duration_minutes}m`
        : `${Math.floor(task.duration_minutes / 60)}h ${task.duration_minutes % 60 > 0 ? task.duration_minutes % 60 + 'm' : ''}`;
      details.push(`Duration: ${duration}`);
    }

    if (task.due_date) {
      const dueDate = new Date(task.due_date);
      details.push(`Due: ${dueDate.toLocaleDateString()}`);
    }

    return details.join(' | ');
  }

  _showSuccess(message) {
    TaskTrackerUtils.showSuccess(message);
  }

  _showError(message) {
    TaskTrackerUtils.showError(message);
  }

  _render() {
    // Preserve current form values before re-rendering (unless we should reset)
    let currentTaskValue = '';
    let currentUsernameValue = '';
    let currentNotesValue = '';

    if (!this._shouldResetForm) {
      currentTaskValue = this.shadowRoot.querySelector('#task-select')?.value || '';
      currentUsernameValue = this.shadowRoot.querySelector('#username-select')?.value || '';
      currentNotesValue = this.shadowRoot.querySelector('#notes-field')?.value || '';
    }

    const selectedTask = this._getSelectedTask(currentTaskValue || null);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerStyles.getCommonCardStyles()}
        ${TaskTrackerStyles.getCompleteTaskCardStyles()}
      </style>

      <div class="tasktracker-complete-task-card card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Complete Task</h3>
          </div>
        ` : ''}

        ${this._renderContent()}
      </div>
    `;

    // Add event listeners
    const taskSelect = this.shadowRoot.querySelector('#task-select');
    if (taskSelect) {
      // Restore the task selection or reset
      if (this._shouldResetForm) {
        taskSelect.value = '';
      } else {
        taskSelect.value = currentTaskValue;
      }
      taskSelect.addEventListener('change', () => this._render());
    }

    const usernameSelect = this.shadowRoot.querySelector('#username-select');
    if (usernameSelect) {
      // Restore username selection, reset, or set default
      if (this._shouldResetForm) {
        const defaultUser = this._getCurrentUsername();
        usernameSelect.value = (defaultUser && this._availableUsers.includes(defaultUser)) ? defaultUser : '';
      } else if (currentUsernameValue) {
        usernameSelect.value = currentUsernameValue;
      } else {
        const defaultUser = this._getCurrentUsername();
        if (defaultUser && this._availableUsers.includes(defaultUser)) {
          usernameSelect.value = defaultUser;
        }
      }
    }

    const notesField = this.shadowRoot.querySelector('#notes-field');
    if (notesField) {
      // Restore notes or reset
      if (this._shouldResetForm) {
        notesField.value = '';
      } else {
        notesField.value = currentNotesValue;
      }
    }

    const completeBtn = this.shadowRoot.querySelector('.complete-btn');
    if (completeBtn) {
      completeBtn.addEventListener('click', () => this._completeTask());
    }

    // Clear the reset flag after applying it
    this._shouldResetForm = false;
  }

  _renderContent() {
    if (this._loading) {
      return '<div class="loading">Loading tasks...</div>';
    }

    if (this._error) {
      return `<div class="error">${this._error}</div>`;
    }

    return `
      <div class="form-group">
        <label class="form-label" for="task-select">Task Name</label>
        <select id="task-select" class="form-control" ${this._completing ? 'disabled' : ''}>
          <option value="">Select a task...</option>
          ${this._allTasks.map((task, index) => `
            <option value="${index}" data-task-id="${task.id}" data-task-type="${task.task_type}">${task.name}</option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="username-select">Username</label>
        <select id="username-select" class="form-control" ${this._completing ? 'disabled' : ''}>
          <option value="">Select a user...</option>
          ${this._availableUsers.map(user => `
            <option value="${user}">${user}</option>
          `).join('')}
        </select>
      </div>

      <div class="form-group">
        <label class="form-label" for="notes-field">Notes (optional)</label>
        <textarea
          id="notes-field"
          class="form-control"
          placeholder="Add any notes about task completion..."
          ${this._completing ? 'disabled' : ''}
        ></textarea>
      </div>

      <button class="complete-btn ${this._completing ? 'tt-loading-dots' : ''}" ${this._completing ? 'disabled' : ''}>
        ${this._completing ? '' : 'Complete Task'}
      </button>
    `;
  }

  getCardSize() {
    return 3;
  }

  _setupEventListeners() {
    // Clean up any existing listener
    if (this._eventCleanup) {
      this._eventCleanup().catch(error => {
        // Suppress "not_found" errors which are common during dashboard editing
        if (error?.code !== 'not_found') {
          console.warn('Error cleaning up existing TaskTracker event listener:', error);
        }
      });
      this._eventCleanup = null;
    }

    // Set up listener for task creations to refresh task list
    const creationCleanup = TaskTrackerUtils.setupTaskCreationListener(
      this._hass,
      (eventData) => {
        // Refresh the task list when new tasks are created
        setTimeout(() => {
          this._fetchAllTasks();
        }, 100);
      }
    );

    // Also listen for completions to keep the list up to date
    const completionCleanup = TaskTrackerUtils.setupTaskCompletionListener(
      this._hass,
      (eventData) => {
        // Refresh the task list when tasks are completed
        setTimeout(() => {
          this._fetchAllTasks();
        }, 100);
      }
    );

    // Combined cleanup function
    this._eventCleanup = async () => {
      await Promise.all([
        creationCleanup().catch(err => err.code !== 'not_found' && console.warn('Creation cleanup error:', err)),
        completionCleanup().catch(err => err.code !== 'not_found' && console.warn('Completion cleanup error:', err))
      ]);
    };
  }
}

class TaskTrackerCompleteTaskCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
  }

  setConfig(config) {
    this._config = { ...TaskTrackerCompleteTaskCard.getStubConfig(), ...config };
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
      <style>${TaskTrackerUtils.getCommonConfigStyles()}</style>
      <div class="card-config">
        <div class="section-title">Display Settings</div>

        <div class="config-row">
          <label>
            Show Task Details
            <div class="config-description">Display task details when a task is selected</div>
          </label>
          <input
            type="checkbox"
            ${this._config.show_task_details ? 'checked' : ''}
            data-config-key="show_task_details"
          />
        </div>

        <div class="config-row">
          <label>
            Show Header
            <div class="config-description">Display card header with title</div>
          </label>
          <input
            type="checkbox"
            ${this._config.show_header ? 'checked' : ''}
            data-config-key="show_header"
          />
        </div>

        <div class="section-title">Default User Settings</div>

        <div class="config-row">
          <label>
            Default User Mode
            <div class="config-description">How to set the default user selection</div>
          </label>
          <select data-config-key="default_user_mode">
            <option value="none" ${this._config.default_user_mode === 'none' ? 'selected' : ''}>No Default</option>
            <option value="current" ${this._config.default_user_mode === 'current' ? 'selected' : ''}>Current User</option>
            <option value="explicit" ${this._config.default_user_mode === 'explicit' ? 'selected' : ''}>Specific User</option>
          </select>
        </div>

        ${this._config.default_user_mode === 'explicit' ? `
        <div class="config-row">
          <label>
            Default User
            <div class="config-description">Specific username to default to</div>
          </label>
          <input
            type="text"
            value="${this._config.default_user || ''}"
            data-config-key="default_user"
            placeholder="Enter username"
          />
        </div>
        ` : ''}
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

  _valueChanged(ev) {
    TaskTrackerUtils.handleConfigValueChange(ev, this, (configKey, value) => {
      // Update config
      this._config = {
        ...this._config,
        [configKey]: value
      };

      // If default_user_mode changed, re-render to show/hide default user field
      if (configKey === 'default_user_mode') {
        this._render();
      }

      this.configChanged(this._config);
    }, ['default_user']);
  }
}

if (!customElements.get('tasktracker-complete-task-card')) {
  customElements.define('tasktracker-complete-task-card', TaskTrackerCompleteTaskCard);
}
if (!customElements.get('tasktracker-complete-task-card-editor')) {
  customElements.define('tasktracker-complete-task-card-editor', TaskTrackerCompleteTaskCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === 'tasktracker-complete-task-card')) {
  window.customCards.push({
    type: 'tasktracker-complete-task-card',
    name: 'TaskTracker Complete Task',
    description: 'Form to complete arbitrary tasks with task and user selection',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}