/**
 * TaskTracker Recommended Tasks Card
 *
 * A custom Lovelace card for displaying recommended tasks:
 * - Time slider for available minutes
 * - List of recommended tasks based on time
 * - Modal popup for task details and completion
 * - Real-time API integration for task recommendations
 */

class TaskTrackerRecommendedTasksCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._tasks = [];
    this._availableMinutes = 60;
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._default_minutes = 60;
    this._default_refresh_interval = 300;
    this._default_max_tasks = 3;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-recommended-tasks-card-editor');
  }

  static getStubConfig() {
    return {
      user: null,
      default_minutes: this._default_minutes,
      show_completion_notes: true,
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
    this._hass = hass;
    this._setupAutoRefresh();
    this._fetchRecommendedTasks();
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }
  }

  _setupAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }

    this._refreshInterval = setInterval(() => {
      this._fetchRecommendedTasks();
    }, this._config.refresh_interval * 1000);
  }

  _getCurrentUsername() {
    switch (this._config.user_filter_mode) {
      case 'explicit':
        return this._config.explicit_user;

      case 'current':
        // Try to detect current user
        if (this._hass && this._hass.user && this._hass.user.name) {
          // Basic mapping - in real implementation this would use the integration's user mapping
          return this._hass.user.name.toLowerCase();
        }
        return null;

      default:
        return null;
    }
  }

  async _fetchRecommendedTasks() {
    const username = this._getCurrentUsername();
    if (!username) {
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
      const response = await this._hass.callService('tasktracker', 'get_recommended_tasks', {
        username: username,
        available_minutes: this._availableMinutes
      }, {}, true, true);

      let newTasks = [];
      if (response && response.response) {
        newTasks = (response.response.recommended_tasks || []).slice(0, this._config.max_tasks);
      }

      // Always update tasks and re-render on initial load, only compare for subsequent refreshes
      if (this._initialLoad || !this._tasksEqual(this._tasks, newTasks)) {
        this._tasks = newTasks;
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
    if (tasks1.length !== tasks2.length) return false;

    for (let i = 0; i < tasks1.length; i++) {
      const t1 = tasks1[i];
      const t2 = tasks2[i];

      if (t1.name !== t2.name ||
        t1.duration_minutes !== t2.duration_minutes ||
        t1.priority !== t2.priority ||
        t1.last_completed !== t2.last_completed) {
        return false;
      }
    }

    return true;
  }

  _showTaskModal(task, taskIndex) {
    const modal = this._createTaskModal(task, taskIndex);
    document.body.appendChild(modal);

    // Show modal with animation
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
    });
  }

  _createTaskModal(task, taskIndex) {
    const modal = document.createElement('div');
    modal.className = 'task-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.className = 'modal-content';
    modalContent.style.cssText = `
      background: var(--card-background-color);
      border-radius: 4px;
      padding: 16px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      transition: transform 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      border: 1px solid var(--divider-color);
    `;

    modalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--divider-color);">
        <h2 style="margin: 0; color: var(--primary-text-color); font-size: 1.1em; font-weight: 500;">${task.name}</h2>
        <button class="close-btn" style="
          background: none;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          padding: 6px;
          cursor: pointer;
          color: var(--secondary-text-color);
          font-size: 16px;
        ">&times;</button>
      </div>

      <div class="task-details" style="margin-bottom: 16px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Duration:</strong>
            <div style="color: var(--secondary-text-color); font-size: 0.8em;">${task.duration_minutes} minutes</div>
          </div>
          <div>
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Priority:</strong>
            <div style="color: var(--secondary-text-color); font-size: 0.8em;">${this._formatPriority(task.priority)}</div>
          </div>
          <div>
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Frequency:</strong>
            <div style="color: var(--secondary-text-color); font-size: 0.8em;">${task.frequency || 'N/A'}</div>
          </div>
          <div>
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Last Completed:</strong>
            <div style="color: var(--secondary-text-color); font-size: 0.8em;">${task.last_completed ? this._formatDate(task.last_completed) : 'Never'}</div>
          </div>
        </div>

        ${task.notes ? `
          <div style="margin-bottom: 12px;">
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Notes:</strong>
            <div style="color: var(--secondary-text-color); margin-top: 4px; font-size: 0.8em;">${task.notes}</div>
          </div>
        ` : ''}

        ${task.last_completion_notes ? `
          <div style="margin-bottom: 12px;">
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Last Completion Notes:</strong>
            <div style="color: var(--secondary-text-color); margin-top: 4px; font-size: 0.8em;">${task.last_completion_notes}</div>
          </div>
        ` : ''}
      </div>

      ${this._config.show_completion_notes ? `
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; color: var(--primary-text-color); font-weight: 500; font-size: 0.9em;">
            Completion Notes (optional):
          </label>
          <textarea
            class="completion-notes"
            placeholder="Add any notes about completing this task..."
            style="
              width: 100%;
              min-height: 60px;
              padding: 8px;
              border: 1px solid var(--divider-color);
              border-radius: 4px;
              background: var(--card-background-color);
              color: var(--primary-text-color);
              font-family: inherit;
              font-size: 0.8em;
              resize: vertical;
              box-sizing: border-box;
            "
          ></textarea>
        </div>
      ` : ''}

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="cancel-btn" style="
          padding: 6px 12px;
          border: 1px solid var(--divider-color);
          background: var(--card-background-color);
          color: var(--secondary-text-color);
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8em;
        ">Cancel</button>
        <button class="complete-btn" style="
          padding: 6px 12px;
          border: 1px solid var(--divider-color);
          background: transparent;
          color: var(--secondary-text-color);
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8em;
        ">Complete</button>
      </div>
    `;

    modal.appendChild(modalContent);

    // Event listeners
    const closeBtn = modalContent.querySelector('.close-btn');
    const cancelBtn = modalContent.querySelector('.cancel-btn');
    const completeBtn = modalContent.querySelector('.complete-btn');
    const notesTextarea = modalContent.querySelector('.completion-notes');

    const closeModal = () => {
      modal.style.opacity = '0';
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 300);
    };

    closeBtn.addEventListener('click', closeModal);
    cancelBtn.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) closeModal();
    });

    completeBtn.addEventListener('click', async () => {
      const notes = notesTextarea ? notesTextarea.value.trim() : '';
      await this._completeTask(task, notes);
      closeModal();
    });

    // Style complete button on hover
    completeBtn.addEventListener('mouseenter', () => {
      completeBtn.style.background = 'var(--secondary-background-color)';
      completeBtn.style.borderColor = 'var(--primary-text-color)';
    });
    completeBtn.addEventListener('mouseleave', () => {
      completeBtn.style.background = 'transparent';
      completeBtn.style.borderColor = 'var(--divider-color)';
    });

    return modal;
  }

  async _completeTask(task, notes) {
    const username = this._getCurrentUsername();
    if (!username) {
      this._showError('No user configured for task completion');
      return;
    }

    try {
      const response = await this._hass.callService('tasktracker', 'complete_task_by_name', {
        name: task.name,
        username: username,
        notes: notes || undefined
      }, {}, true, true);

      if (response && response.response) {
        this._showSuccess(`Task "${task.name}" completed successfully`);
      } else {
        this._showError(`Failed to complete task: ${response.error || 'Unknown error'}`);
      }

      // Refresh tasks after completion
      setTimeout(() => {
        this._fetchRecommendedTasks();
      }, 1000);

    } catch (error) {
      console.error('Failed to complete task:', error);
      this._showError(`Failed to complete task: ${error.message}`);
    }
  }

  _formatPriority(priority) {
    const priorityStringMap = {
      'High': 1,
      'Medium': 2,
      'Low': 3
    }

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

  _formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  }

  _formatDueDate(dueDateString) {
    try {
      const dueDate = new Date(dueDateString);
      const now = new Date();
      const diffMs = dueDate - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
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

  _render() {
    const username = this._getCurrentUsername();

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
          padding: 6px;
          cursor: pointer;
          color: var(--secondary-text-color);
        }

        .refresh-btn:hover {
          background: var(--secondary-background-color);
        }

        .time-control {
          margin-bottom: 16px;
        }

        .time-label {
          display: block;
          margin-bottom: 8px;
          color: var(--primary-text-color);
          font-weight: 500;
          font-size: 0.9em;
        }

        .time-slider-container {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .time-slider {
          flex: 1;
          height: 4px;
          background: var(--divider-color);
          border-radius: 2px;
          outline: none;
          -webkit-appearance: none;
        }

        .time-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 16px;
          height: 16px;
          background: var(--primary-color);
          border-radius: 50%;
          cursor: pointer;
        }

        .time-slider::-moz-range-thumb {
          width: 16px;
          height: 16px;
          background: var(--primary-color);
          border-radius: 50%;
          border: none;
          cursor: pointer;
        }

        .time-value {
          color: var(--primary-text-color);
          font-weight: 500;
          min-width: 60px;
          text-align: right;
          font-size: 0.9em;
        }

        .loading, .error, .no-tasks {
          text-align: center;
          padding: 24px 0;
          color: var(--secondary-text-color);
          font-size: 0.9em;
        }

        .error {
          color: var(--primary-text-color);
          background: var(--secondary-background-color);
          padding: 12px;
          border-radius: 4px;
          border: 1px solid var(--divider-color);
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

        .task-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 4px;
          background: var(--secondary-background-color);
          border-radius: 4px;
          border-left: 2px solid var(--primary-color);
          cursor: pointer;
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

        @keyframes pulse {
          0%, 100% { opacity: 0.3; }
          50% { opacity: 0.8; }
        }
      </style>

      <div class="card">
        <div class="header">
          <h3 class="title">Recommended Tasks</h3>
          <button class="refresh-btn" title="Refresh tasks">
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>
          ${this._refreshing ? '<div class="refreshing-indicator"></div>' : ''}
        </div>

        ${!username ? `
          <div class="no-user-warning">
            No user configured. Please set user in card configuration.
          </div>
        ` : `
          <div class="time-control">
            <label class="time-label">Available Time</label>
            <div class="time-slider-container">
              <input
                type="range"
                class="time-slider"
                min="5"
                max="180"
                step="5"
                value="${this._availableMinutes}"
              />
              <span class="time-value">${this._availableMinutes} min</span>
            </div>
          </div>

          ${this._renderContent()}
        `}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._fetchRecommendedTasks());
    }

    if (username) {
      const slider = this.shadowRoot.querySelector('.time-slider');
      const timeValue = this.shadowRoot.querySelector('.time-value');

      if (slider) {
        slider.addEventListener('input', (e) => {
          this._availableMinutes = parseInt(e.target.value);
          timeValue.textContent = `${this._availableMinutes} min`;
        });

        slider.addEventListener('change', () => {
          this._fetchRecommendedTasks();
        });
      }

      // Task item click handlers
      const taskItems = this.shadowRoot.querySelectorAll('.task-item');
      taskItems.forEach((item, index) => {
        item.addEventListener('click', () => {
          if (this._tasks[index]) {
            this._showTaskModal(this._tasks[index], index);
          }
        });
      });
    }
  }

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
    const priority = this._formatPriority(task.priority);
    const duration = `${task.duration_minutes}m`;

    // Build metadata line with pipes
    const metadataParts = [];
    metadataParts.push(priority);
    metadataParts.push(duration);
    if (task.due_date) {
      metadataParts.push(`${this._formatDueDate(task.due_date)}`);
    }

    return `
      <div class="task-item">
        <div class="task-content">
          <div class="task-name">
            ${task.name}
            ${task.last_completion_notes ? '<div class="completion-indicator" title="Has completion notes"></div>' : ''}
          </div>
          <div class="task-metadata">${metadataParts.join(' | ')}</div>
        </div>
      </div>
    `;
  }

  getCardSize() {
    return Math.min(4, Math.max(2, Math.ceil(this._tasks.length / 3) + 1));
  }
}

class TaskTrackerRecommendedTasksCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._debounceTimers = {}; // Store debounce timers for different fields
  }

  setConfig(config) {
    this._config = { ...TaskTrackerRecommendedTasksCard.getStubConfig(), ...config };
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
      </style>

      <div class="card-config">
        <div class="section-title">Display Settings</div>

        <div class="config-row">
          <label>
            Default Minutes
            <div class="config-description">Default time slider value in minutes</div>
          </label>
          <input
            type="number"
            min="5"
            max="180"
            step="5"
            value="${this._config.default_minutes}"
            data-config-key="default_minutes"
          />
        </div>

        <div class="config-row">
          <label>
            Maximum Tasks
            <div class="config-description">Maximum number of tasks to display</div>
          </label>
          <input
            type="number"
            min="1"
            max="10"
            value="${this._config.max_tasks}"
            data-config-key="max_tasks"
          />
        </div>

        <div class="config-row">
          <label>
            Show Completion Notes
            <div class="config-description">Display completion notes field in modal</div>
          </label>
          <input
            type="checkbox"
            ${this._config.show_completion_notes ? 'checked' : ''}
            data-config-key="show_completion_notes"
          />
        </div>

        <div class="section-title">User Settings</div>

        <div class="config-row">
          <label>
            User Filter Mode
            <div class="config-description">How to determine the user for recommendations</div>
          </label>
          <select data-config-key="user_filter_mode">
            <option value="current" ${this._config.user_filter_mode === 'current' ? 'selected' : ''}>Current User</option>
            <option value="explicit" ${this._config.user_filter_mode === 'explicit' ? 'selected' : ''}>Specific User</option>
          </select>
        </div>

        ${this._config.user_filter_mode === 'explicit' ? `
        <div class="config-row">
          <label>
            Username
            <div class="config-description">Specific username for task recommendations</div>
          </label>
          <input
            type="text"
            value="${this._config.explicit_user || ''}"
            data-config-key="explicit_user"
            placeholder="Enter username"
          />
        </div>
        ` : ''}

        <div class="section-title">Behavior Settings</div>

        <div class="config-row">
          <label>
            Refresh Interval (seconds)
            <div class="config-description">How often to automatically refresh task data</div>
          </label>
          <input
            type="number"
            min="10"
            max="3600"
            step="10"
            value="${this._config.refresh_interval}"
            data-config-key="refresh_interval"
          />
        </div>
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
    } else if (target.type === 'number') {
      value = parseInt(target.value, 10);
    } else {
      value = target.value || null;
    }

    // Handle empty string for optional fields
    if ((configKey === 'explicit_user' || configKey === 'user') && value === '') {
      value = null;
    }

    // For text inputs, debounce the config update to avoid frequent API calls
    if (target.type === 'text') {
      // Clear any existing timer for this field
      if (this._debounceTimers[configKey]) {
        clearTimeout(this._debounceTimers[configKey]);
      }

      // Set a new timer to update config after user stops typing
      this._debounceTimers[configKey] = setTimeout(() => {
        this._updateConfig(configKey, value);
        delete this._debounceTimers[configKey];
      }, 500); // Wait 500ms after user stops typing
    } else {
      // For non-text inputs (checkboxes, selects, numbers), update immediately
      this._updateConfig(configKey, value);
    }
  }

  _updateConfig(configKey, value) {
    // Update config
    this._config = {
      ...this._config,
      [configKey]: value
    };

    // If user_filter_mode changed, re-render to show/hide explicit user field
    if (configKey === 'user_filter_mode') {
      this._render();
    }

    this.configChanged(this._config);
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