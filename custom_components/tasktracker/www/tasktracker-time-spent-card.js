import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';
import { TaskTrackerBaseEditor } from './utils/base-config-editor.js';

/**
 * TaskTracker Time Spent Card
 *
 * A custom Lovelace card for displaying time spent on tasks recently:
 * - Shows total time spent from recent completions
 * - Configurable time range and result limit
 * - Real-time API integration for completion data
 * - Human-friendly time formatting
 */

class TaskTrackerTimeSpentCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._completions = [];
    this._userContext = null;
    this._totalMinutes = 0;
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._availableUsers = [];
    this._enhancedUsers = [];
    this._default_days = 7;
    this._default_limit = 100; // Higher default to capture more time data
    this._default_refresh_interval = 300;
    this._eventCleanup = null;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-time-spent-card-editor');
  }

  static getStubConfig() {
    return {
      days: 7,
      limit: 100,
      show_header: true,
      refresh_interval: 300,
      user_filter_mode: 'explicit', // 'current', 'explicit', 'all'
      explicit_user: null
    };
  }

  setConfig(config) {
    this._config = {
      days: config.days || this._default_days,
      limit: config.limit || this._default_limit,
      show_header: config.show_header !== false,
      refresh_interval: config.refresh_interval || this._default_refresh_interval,
      user_filter_mode: config.user_filter_mode || 'explicit',
      explicit_user: config.explicit_user || null,
      // Legacy support
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
      this._fetchTimeSpentData();
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
      this._eventCleanup().catch(error => {
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
      this._fetchTimeSpentData();
    }, this._config.refresh_interval);
  }

  _getCurrentUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
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

  async _fetchTimeSpentData() {
    await this._fetchAvailableUsers();

    // Validate current user configuration before making API calls
    const userValidation = TaskTrackerUtils.validateCurrentUser(this._config, this._hass, this._enhancedUsers);

    if (!userValidation.canMakeRequests) {
      this._error = userValidation.error;
      this._completions = [];
      this._totalMinutes = 0;
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
      const params = {
        days: this._config.days,
        limit: this._config.limit
      };

      if (userValidation.username) {
        params.assigned_to = userValidation.username;
      }

      const response = await this._hass.callService('tasktracker', 'get_recent_completions', params, {}, true, true);

      let newCompletions = [];
      let newTotalMinutes = 0;

      if (response && response.response && response.response.data) {
        newTotalMinutes = response.response.data.total_duration;
        newCompletions = response.response.data.items;
        // Capture user context from API response for potential future timezone-aware formatting
        this._userContext = response.response.data.user_context || null;
      }

      // Always update data and re-render on initial load, only compare for subsequent refreshes
      if (this._initialLoad || !this._dataEqual(this._completions, newCompletions, this._totalMinutes, newTotalMinutes)) {
        this._completions = newCompletions;
        this._totalMinutes = newTotalMinutes;
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
      console.error('Failed to fetch time spent data:', error);
      this._error = `Failed to fetch time spent data: ${error.message}`;
      this._completions = [];
      this._totalMinutes = 0;
      this._loading = false;
      this._refreshing = false;
      this._initialLoad = false;
      this._render();
    }
  }

  _dataEqual(completions1, completions2, total1, total2) {
    return total1 === total2 && TaskTrackerUtils.arraysEqual(completions1, completions2, (c1, c2) => {
      return c1.task_name === c2.task_name &&
        c1.completed_at === c2.completed_at &&
        c1.duration_minutes === c2.duration_minutes;
    });
  }

  _render() {
    const username = this._getCurrentUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerStyles.getCommonCardStyles()}
      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Time Spent${username ? ` - ${TaskTrackerUtils.capitalize(username)}` : ''}</h3>
            <button class="refresh-btn" title="Refresh time data">
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
      refreshBtn.addEventListener('click', () => this._fetchTimeSpentData());
    }
  }

  _renderContent() {
    // Only show loading state on initial load
    if (this._loading && this._initialLoad) {
      return '<div class="loading">Loading time spent data...</div>';
    }

    if (this._error) {
      return `<div class="error">${this._error}</div>`;
    }

    if (this._totalMinutes === 0) {
      return `
        <div class="no-tasks">
          No time spent on tasks in the last ${this._config.days} day${this._config.days !== 1 ? 's' : ''}
        </div>
      `;
    }

    const formattedTime = TaskTrackerUtils.formatDuration(this._totalMinutes);
    const dayText = this._config.days === 1 ? 'day' : 'days';

    return `
      <div class="text-center">
        ${formattedTime} spent on tasks in the last ${this._config.days} ${dayText}
      </div>
    `;
  }

  getCardSize() {
    return 2;
  }

  _setupEventListeners() {
    // Clean up any existing listener
    if (this._eventCleanup) {
      this._eventCleanup().catch(error => {
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
            this._fetchTimeSpentData();
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
            this._fetchTimeSpentData();
          }, 500);
        }
      }
    );

    // Combined cleanup function
    this._eventCleanup = async () => {
      await Promise.all([
        taskCleanup().catch(err => err.code !== 'not_found' && console.warn('Task cleanup error:', err)),
        leftoverCleanup().catch(err => err.code !== 'not_found' && console.warn('Leftover cleanup error:', err))
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
}

class TaskTrackerTimeSpentCardEditor extends TaskTrackerBaseEditor {
  constructor() {
    super();
  }

  getDefaultConfig() { return { ...TaskTrackerTimeSpentCard.getStubConfig() }; }

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
          'Maximum number of completions to analyze for time calculation',
          TaskTrackerUtils.createNumberInput(this._config.limit, 'limit', 1, 500)
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Show Header',
          'Display card header with title and refresh button',
          TaskTrackerUtils.createCheckboxInput(this._config.show_header, 'show_header')
        )}

        <div class="section-title">User Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'User Filter Mode',
          'Which completions to include in time calculation',
          TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
            { value: 'all', label: 'All Users' },
            { value: 'current', label: 'Current User' },
            { value: 'explicit', label: 'Specific User' }
          ])
        )}

        ${this._config.user_filter_mode === 'explicit' ? TaskTrackerUtils.createConfigRow(
          'Username',
          'Specific username to calculate time for',
          TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
        ) : ''}

        <div class="section-title">Behavior Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'Refresh Interval (seconds)',
          'How often to automatically refresh time data',
          TaskTrackerUtils.createNumberInput(this._config.refresh_interval, 'refresh_interval', 10, 3600, 10)
        )}
      </div>
    `;

    // Add event listeners
    this.shadowRoot.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', this._valueChanged.bind(this));
      if (input.type === 'text' || input.type === 'number') input.addEventListener('input', this._valueChanged.bind(this));
    });
  }

  _updateConfig(configKey, value) {
    super._updateConfig(configKey, value);
    if (configKey === 'user_filter_mode') this._render();
  }
}

if (!customElements.get('tasktracker-time-spent-card')) {
  customElements.define('tasktracker-time-spent-card', TaskTrackerTimeSpentCard);
}
if (!customElements.get('tasktracker-time-spent-card-editor')) {
  customElements.define('tasktracker-time-spent-card-editor', TaskTrackerTimeSpentCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === 'tasktracker-time-spent-card')) {
  window.customCards.push({
    type: 'tasktracker-time-spent-card',
    name: 'TaskTracker Time Spent',
    description: 'Display total time spent on recently completed tasks',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}