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
    }

    static getConfigElement() {
        return document.createElement('tasktracker-complete-task-card-editor');
    }

    static getStubConfig() {
        return {
            show_task_details: true,
            default_user_mode: 'current', // 'current', 'explicit', 'none'
            default_user: null
        };
    }

    setConfig(config) {
        this._config = {
            show_task_details: config.show_task_details !== false,
            default_user_mode: config.default_user_mode || 'current',
            default_user: config.default_user || null,
            ...config
        };

        this._render();
    }

    set hass(hass) {
        this._hass = hass;
        this._fetchInitialData();
    }

    connectedCallback() {
        this._render();
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

            if (response && response.response && response.response.tasks) {
                this._allTasks = response.response.tasks.sort((a, b) => a.name.localeCompare(b.name));
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

            if (response && response.response && response.response.users) {
                this._availableUsers = response.response.users;
            } else {
                // Fallback to hardcoded users if service fails
                this._availableUsers = ['gabriel', 'katie', 'admin'];
            }
        } catch (error) {
            console.error('Failed to fetch available users:', error);
            // Fallback to hardcoded users if service fails
            this._availableUsers = ['gabriel', 'katie', 'admin'];
        }
    }

    _getCurrentUsername() {
        switch (this._config.default_user_mode) {
            case 'explicit':
                return this._config.default_user;

            case 'current':
                // Try to detect current user
                if (this._hass && this._hass.user && this._hass.user.name) {
                    // Convert to lowercase and check if it matches any available user
                    const currentUserName = this._hass.user.name.toLowerCase();

                    // First try exact match
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

        const selectedTask = taskSelect.value;
        const selectedUsername = usernameSelect.value;
        const notes = notesField.value.trim();

        if (!selectedTask) {
            this._showError('Please select a task');
            return;
        }

        if (!selectedUsername) {
            this._showError('Please select a username');
            return;
        }

        this._completing = true;
        this._render();

        try {
            const serviceData = {
                name: selectedTask,
                username: selectedUsername
            };

            if (notes) {
                serviceData.notes = notes;
            }

            await this._hass.callService('tasktracker', 'complete_task_by_name', serviceData);

            this._showSuccess(`Task "${selectedTask}" completed successfully`);

            // Reset form
            taskSelect.value = '';
            usernameSelect.value = this._getCurrentUsername() || '';
            notesField.value = '';

            this._completing = false;
            this._render();

        } catch (error) {
            console.error('Failed to complete task:', error);
            this._showError(`Failed to complete task: ${error.message}`);
            this._completing = false;
            this._render();
        }
    }

    _getSelectedTask() {
        const taskSelect = this.shadowRoot.querySelector('#task-select');
        if (!taskSelect || !taskSelect.value) return null;

        return this._allTasks.find(task => task.name === taskSelect.value);
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

    _showError(message) {
        const toast = document.createElement('div');
        toast.textContent = message;
        toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--error-color, #f44336);
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

    _render() {
        const selectedTask = this._getSelectedTask();

        this.shadowRoot.innerHTML = `
      <style>
        :host {
          display: block;
        }

        .card {
          background: var(--card-background-color);
          border-radius: 4px;
          padding: 16px;
          box-shadow: var(--ha-card-box-shadow);
          font-family: var(--primary-font-family);
          border: 1px solid var(--divider-color);
        }

        .header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 16px;
          padding-bottom: 8px;
          border-bottom: 1px solid var(--divider-color);
        }

        .title {
          font-size: 1.1em;
          font-weight: 500;
          color: var(--primary-text-color);
          margin: 0;
        }

        .loading, .error {
          text-align: center;
          padding: 24px 0;
          color: var(--secondary-text-color);
          font-size: 0.9em;
        }

        .error {
          color: var(--error-color, var(--primary-text-color));
          background: var(--secondary-background-color);
          padding: 12px;
          border-radius: 4px;
          border: 1px solid var(--divider-color);
        }

        .form-group {
          margin-bottom: 16px;
        }

        .form-group:last-of-type {
          margin-bottom: 20px;
        }

        .form-label {
          display: block;
          margin-bottom: 6px;
          font-weight: 500;
          color: var(--primary-text-color);
          font-size: 0.9em;
        }

        .form-control {
          width: 100%;
          padding: 8px 12px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-family: inherit;
          font-size: 0.9em;
          box-sizing: border-box;
        }

        .form-control:focus {
          outline: none;
          border-color: var(--primary-color);
          box-shadow: 0 0 0 1px var(--primary-color);
        }

        .form-control:disabled {
          background: var(--secondary-background-color);
          color: var(--secondary-text-color);
          cursor: not-allowed;
        }

        select.form-control {
          cursor: pointer;
        }

        select.form-control:disabled {
          cursor: not-allowed;
        }

        textarea.form-control {
          resize: vertical;
          min-height: 60px;
          max-height: 120px;
        }

        .task-details {
          margin-top: 6px;
          padding: 8px 12px;
          background: var(--secondary-background-color);
          border-radius: 4px;
          font-size: 0.8em;
          color: var(--secondary-text-color);
          border: 1px solid var(--divider-color);
        }

        .complete-btn {
          width: 100%;
          padding: 12px;
          background: var(--primary-color);
          color: white;
          border: none;
          border-radius: 4px;
          font-size: 0.95em;
          font-weight: 500;
          cursor: pointer;
          font-family: inherit;
        }

        .complete-btn:hover:not(:disabled) {
          background: var(--dark-primary-color, var(--primary-color));
          filter: brightness(0.9);
        }

        .complete-btn:disabled {
          background: var(--secondary-text-color);
          cursor: not-allowed;
          opacity: 0.6;
        }

        .completing {
          opacity: 0.7;
        }
      </style>

      <div class="card">
        <div class="header">
          <h3 class="title">Complete Task</h3>
        </div>

        ${this._renderContent()}
      </div>
    `;

        // Add event listeners
        const taskSelect = this.shadowRoot.querySelector('#task-select');
        if (taskSelect) {
            taskSelect.addEventListener('change', () => this._render());
        }

        const completeBtn = this.shadowRoot.querySelector('.complete-btn');
        if (completeBtn) {
            completeBtn.addEventListener('click', () => this._completeTask());
        }

        // Set default username
        const usernameSelect = this.shadowRoot.querySelector('#username-select');
        if (usernameSelect) {
            const defaultUser = this._getCurrentUsername();
            if (defaultUser && this._availableUsers.includes(defaultUser)) {
                usernameSelect.value = defaultUser;
            }
        }
    }

    _renderContent() {
        if (this._loading) {
            return '<div class="loading">Loading tasks...</div>';
        }

        if (this._error) {
            return `<div class="error">${this._error}</div>`;
        }

        const selectedTask = this._getSelectedTask();

        return `
      <div class="form-group">
        <label class="form-label" for="task-select">Task Name</label>
        <select id="task-select" class="form-control" ${this._completing ? 'disabled' : ''}>
          <option value="">Select a task...</option>
          ${this._allTasks.map(task => `
            <option value="${task.name}">${task.name}</option>
          `).join('')}
        </select>
        ${this._config.show_task_details && selectedTask ? `
          <div class="task-details">
            ${this._formatTaskDetails(selectedTask)}
          </div>
        ` : ''}
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

      <button class="complete-btn ${this._completing ? 'completing' : ''}" ${this._completing ? 'disabled' : ''}>
        ${this._completing ? 'Completing...' : 'Complete Task'}
      </button>
    `;
    }

    getCardSize() {
        return 3;
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
      <style>
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
      </style>

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
            if (input.type === 'text') {
                input.addEventListener('input', this._valueChanged.bind(this));
            }
        });
    }

    _valueChanged(ev) {
        if (!this._config || !this._hass) {
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
        } else {
            value = target.value || null;
        }

        // Handle empty string for optional fields
        if (configKey === 'default_user' && value === '') {
            value = null;
        }

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
    }
}

customElements.define('tasktracker-complete-task-card', TaskTrackerCompleteTaskCard);
customElements.define('tasktracker-complete-task-card-editor', TaskTrackerCompleteTaskCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
    type: 'tasktracker-complete-task-card',
    name: 'TaskTracker Complete Task',
    description: 'Form to complete arbitrary tasks with task and user selection',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
});