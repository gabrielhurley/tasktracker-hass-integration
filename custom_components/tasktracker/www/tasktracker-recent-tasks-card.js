import { TaskTrackerUtils } from './tasktracker-utils.js';

/**
 * TaskTracker Recent Tasks Card
 *
 * A custom Lovelace card for displaying recent task completions:
 * - Shows completion history with timestamps
 * - Displays completion notes where available
 * - Configurable time range and result limit
 * - Real-time API integration for completion data
 */

class TaskTrackerRecentTasksCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._completions = [];
    this._userContext = null;
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._availableUsers = []; // Add available users tracking
    this._default_days = 7;
    this._default_limit = 10;
    this._default_refresh_interval = 300;
    this._eventCleanup = null; // Store event listener cleanup function
  }

  static getConfigElement() {
    return document.createElement('tasktracker-recent-tasks-card-editor');
  }

  static getStubConfig() {
    return {
      days: this._default_days,
      limit: this._default_limit,
      show_notes: true,
      show_header: true,
      refresh_interval: this._default_refresh_interval,
      user_filter_mode: 'all', // 'all', 'current', 'explicit'
      explicit_user: null
    };
  }

  setConfig(config) {
    this._config = {
      days: config.days || this._default_days,
      limit: config.limit || this._default_limit,
      show_notes: config.show_notes !== false,
      show_header: config.show_header !== false,
      refresh_interval: config.refresh_interval || this._default_refresh_interval, // seconds
      user_filter_mode: config.user_filter_mode || 'all',
      explicit_user: config.explicit_user || null,
      // Legacy support for old 'user' config
      user: config.user || null,
      ...config
    };

    // Migrate legacy user config to new format
    if (this._config.user && !config.user_filter_mode) {
      this._config.user_filter_mode = 'explicit';
      this._config.explicit_user = this._config.user;
    }

    this._render();
  }

  set hass(hass) {
    const wasInitialized = this._hass !== null;
    this._hass = hass;

    // Always set up auto-refresh and event listeners when hass changes
    this._setupAutoRefresh();
    this._setupEventListeners();

    // Only fetch initial data on first hass assignment
    if (!wasInitialized && hass) {
      this._fetchRecentCompletions();
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

  _setupAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }

    this._refreshInterval = TaskTrackerUtils.setupAutoRefresh(() => {
      this._fetchRecentCompletions();
    }, this._config.refresh_interval);
  }

  _getCurrentUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
  }

  async _fetchAvailableUsers() {
    try {
      this._availableUsers = await TaskTrackerUtils.getAvailableUsers(this._hass);
    } catch (error) {
      console.warn('Failed to fetch available users:', error);
      this._availableUsers = []; // fallback to empty array
    }
  }

  async _fetchRecentCompletions() {
    // Fetch available users if not already loaded and we're in current user mode
    if (this._config.user_filter_mode === 'current' && this._availableUsers.length === 0) {
      await this._fetchAvailableUsers();
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
      const params = {
        days: this._config.days,
        limit: this._config.limit
      };

      const username = this._getCurrentUsername();
      if (username) {
        params.assigned_to = username;
      }

      const response = await this._hass.callService('tasktracker', 'get_recent_completions', params, {}, true, true);

      let newCompletions = [];
      if (response && response.response && response.response.data && response.response.data.items) {
        newCompletions = response.response.data.items;
        // Capture user context from API response for timezone-aware formatting
        this._userContext = response.response.data.user_context || null;
      }

      // Always update completions and re-render on initial load, only compare for subsequent refreshes
      if (this._initialLoad || !this._completionsEqual(this._completions, newCompletions)) {
        this._completions = newCompletions;
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
      console.error('Failed to fetch recent completions:', error);
      this._error = `Failed to fetch recent completions: ${error.message}`;
      this._completions = [];
      this._loading = false;
      this._refreshing = false;
      this._initialLoad = false;
      this._render();
    }
  }

  _completionsEqual(completions1, completions2) {
    return TaskTrackerUtils.arraysEqual(completions1, completions2, (c1, c2) => {
      return c1.task_name === c2.task_name &&
        c1.completed_at === c2.completed_at &&
        c1.completed_by === c2.completed_by &&
        c1.notes === c2.notes;
    });
  }

  _formatDateTime(dateString) {
    return TaskTrackerUtils.formatDateTime(dateString, this._userContext);
  }

  _formatDuration(minutes) {
    return TaskTrackerUtils.formatDuration(minutes);
  }

  _render() {
    const username = this._getCurrentUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerUtils.getCommonCardStyles()}

        .completion-details {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          margin-bottom: 4px;
        }

        .completion-notes {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          font-style: italic;
          margin-top: 4px;
          padding: 4px 8px;
          background: var(--card-background-color);
          border-radius: 4px;
          border: 1px solid var(--divider-color);
        }




      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Recent Completions</h3>
            <button class="refresh-btn" title="Refresh completions">
              <ha-icon icon="mdi:refresh"></ha-icon>
            </button>
            ${this._refreshing ? '<div class="refreshing-indicator"></div>' : ''}
          </div>
        ` : ''}

        ${!hasValidUserConfig ? `
          <div class="no-user-warning">
            No user configured. Please set user in card configuration.
          </div>
        ` : this._renderContent()}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._fetchRecentCompletions());
    }

    // Add event listeners for edit buttons
    const editButtons = this.shadowRoot.querySelectorAll('.complete-btn[data-completion-id]');
    editButtons.forEach(btn => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const completionId = parseInt(btn.getAttribute('data-completion-id'));
        this._showEditCompletionModal(completionId);
      });
    });
  }

  _renderContent() {
    // Only show loading state on initial load
    if (this._loading && this._initialLoad) {
      return '<div class="loading">Loading recent completions...</div>';
    }

    if (this._error) {
      return `<div class="error">${this._error}</div>`;
    }

    if (!this._completions || this._completions.length === 0) {
      return '<div class="no-completions">No recent task completions found</div>';
    }

    return this._completions.map(completion => this._renderCompletionItem(completion)).join('');
  }

  _renderCompletionItem(completion) {
    const taskName = completion.task_name || completion.name;
    const completedBy = TaskTrackerUtils.capitalize(completion.completed_by) || 'Unknown';
    const time = this._formatDateTime(completion.completed_at);

    // Build metadata line with pipes
    const metadataParts = [];
    metadataParts.push(`Completed by ${completedBy}`);
    if (time) metadataParts.push(time);

    // Only show edit button for completions with an ID (only recurring task completions have edit capability)
    const showEditButton = completion.id && completion.id !== null;

    return `
      <div class="task-item completion-item completed">
        <div class="task-content completion-content">
          <div class="task-name">${taskName}</div>
          <div class="task-metadata completion-details">${metadataParts.join(' ')}</div>
          ${this._config.show_notes && completion.notes ? `
            <div class="completion-notes">"${completion.notes}"</div>
          ` : ''}
        </div>
        ${showEditButton ? `
          <div class="task-actions completion-actions">
            <button class="complete-btn" data-completion-id="${completion.id}" title="Edit completion">
              Edit
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  getCardSize() {
    return Math.min(4, Math.max(1, Math.ceil(this._completions.length / 5)));
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

    // Set up listeners for both task completions and leftover disposals
    const taskCleanup = TaskTrackerUtils.setupTaskCompletionListener(
      this._hass,
      (eventData) => {
        const shouldRefresh = this._shouldRefreshForUser(eventData.username);
        if (shouldRefresh) {
          setTimeout(() => {
            this._fetchRecentCompletions();
          }, 500);
        }
      }
    );

    const leftoverCleanup = TaskTrackerUtils.setupLeftoverDisposalListener(
      this._hass,
      (eventData) => {
        const shouldRefresh = this._shouldRefreshForUser(eventData.username);
        if (shouldRefresh) {
          setTimeout(() => {
            this._fetchRecentCompletions();
          }, 500);
        }
      }
    );

    // Set up listeners for completion edits
    const completionDeletedCleanup = TaskTrackerUtils.setupEventListener(
      this._hass,
      'tasktracker_completion_deleted',
      () => {
        setTimeout(() => {
          this._fetchRecentCompletions();
        }, 500);
      }
    );

    const completionUpdatedCleanup = TaskTrackerUtils.setupEventListener(
      this._hass,
      'tasktracker_completion_updated',
      () => {
        setTimeout(() => {
          this._fetchRecentCompletions();
        }, 500);
      }
    );

    // Combined cleanup function
    this._eventCleanup = async () => {
      await Promise.all([
        taskCleanup().catch(err => err.code !== 'not_found' && console.warn('Task cleanup error:', err)),
        leftoverCleanup().catch(err => err.code !== 'not_found' && console.warn('Leftover cleanup error:', err)),
        completionDeletedCleanup().catch(err => err.code !== 'not_found' && console.warn('Completion deleted cleanup error:', err)),
        completionUpdatedCleanup().catch(err => err.code !== 'not_found' && console.warn('Completion updated cleanup error:', err))
      ]);
    };
  }

  _shouldRefreshForUser(completedByUsername) {
    const currentUsername = this._getCurrentUsername();

    // If we're showing all users, refresh for any completion
    if (this._config.user_filter_mode === 'all') {
      return true;
    }

    // If we're filtering by user, only refresh if it matches our filter
    if (currentUsername) {
      return completedByUsername === currentUsername;
    }

    // Default to refreshing
    return true;
  }

  async _showEditCompletionModal(completionId) {
    // Find the completion by ID
    const completion = this._completions.find(c => c.id === completionId);
    if (!completion) {
      TaskTrackerUtils.showError('Completion not found');
      return;
    }

    // Fetch available users for user selection
    let availableUsers = [];
    let enhancedUsers = [];
    try {
      availableUsers = await TaskTrackerUtils.getAvailableUsers(this._hass);
      enhancedUsers = await TaskTrackerUtils.getEnhancedUsers(this._hass);
    } catch (error) {
      console.warn('Failed to fetch users for completion editing:', error);
    }

    const modal = TaskTrackerUtils.createCompletionEditModal(
      completion,
      this._config,
      async () => {
        // Delete/undo completion
        await TaskTrackerUtils.deleteCompletion(this._hass, completionId);
        this._fetchRecentCompletions();
      },
      async (updates) => {
        // Update completion
        await TaskTrackerUtils.updateCompletion(this._hass, completionId, updates);
        this._fetchRecentCompletions();
      },
      availableUsers,
      enhancedUsers
    );

    TaskTrackerUtils.showModal(modal);
  }
}

class TaskTrackerRecentTasksCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._debounceTimers = {};
  }

  setConfig(config) {
    this._config = { ...TaskTrackerRecentTasksCard.getStubConfig(), ...config };
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
        ${TaskTrackerUtils.getCommonConfigStyles()}
      </style>

      <div class="card-config">
        <div class="section-title">Display Settings</div>

        ${TaskTrackerUtils.createConfigRow(
      'Time Range (days)',
      'Number of days back to fetch completions',
      TaskTrackerUtils.createNumberInput(this._config.days, 'days', 1, 90)
    )}

        ${TaskTrackerUtils.createConfigRow(
      'Maximum Results',
      'Maximum number of completions to display',
      TaskTrackerUtils.createNumberInput(this._config.limit, 'limit', 1, 50)
    )}

        ${TaskTrackerUtils.createConfigRow(
      'Show Notes',
      'Display completion notes where available',
      TaskTrackerUtils.createCheckboxInput(this._config.show_notes, 'show_notes')
    )}

        ${TaskTrackerUtils.createConfigRow(
      'Show Header',
      'Display card header with title and refresh button',
      TaskTrackerUtils.createCheckboxInput(this._config.show_header, 'show_header')
    )}

        <div class="section-title">User Settings</div>

        ${TaskTrackerUtils.createConfigRow(
      'User Filter Mode',
      'Which completions to display',
      TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
        { value: 'all', label: 'All Users' },
        { value: 'current', label: 'Current User' },
        { value: 'explicit', label: 'Specific User' }
      ])
    )}

        ${this._config.user_filter_mode === 'explicit' ? TaskTrackerUtils.createConfigRow(
      'Username',
      'Specific username to filter completions',
      TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
    ) : ''}

        <div class="section-title">Behavior Settings</div>

        ${TaskTrackerUtils.createConfigRow(
      'Refresh Interval (seconds)',
      'How often to automatically refresh completion data',
      TaskTrackerUtils.createNumberInput(this._config.refresh_interval, 'refresh_interval', 10, 3600, 10)
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

  _valueChanged(ev) {
    TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
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

if (!customElements.get('tasktracker-recent-tasks-card')) {
  customElements.define('tasktracker-recent-tasks-card', TaskTrackerRecentTasksCard);
}
if (!customElements.get('tasktracker-recent-tasks-card-editor')) {
  customElements.define('tasktracker-recent-tasks-card-editor', TaskTrackerRecentTasksCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === 'tasktracker-recent-tasks-card')) {
  window.customCards.push({
    type: 'tasktracker-recent-tasks-card',
    name: 'TaskTracker Recent Tasks',
    description: 'Display recent task completion history with notes',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}