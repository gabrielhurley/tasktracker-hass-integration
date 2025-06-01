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
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._default_days = 7;
    this._default_limit = 10;
    this._default_refresh_interval = 300;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-recent-tasks-card-editor');
  }

  static getStubConfig() {
    return {
      days: this._default_days,
      limit: this._default_limit,
      show_notes: true,
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
    this._hass = hass;
    this._setupAutoRefresh();
    this._fetchRecentCompletions();
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
      this._fetchRecentCompletions();
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

      case 'all':
      default:
        return null; // No username filter
    }
  }

  async _fetchRecentCompletions() {
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
        params.username = username;
      }

      const response = await this._hass.callService('tasktracker', 'get_recent_completions', params, {}, true, true);

      let newCompletions = [];
      if (response && response.response) {
        newCompletions = response.response.completions || [];
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
    if (completions1.length !== completions2.length) return false;

    for (let i = 0; i < completions1.length; i++) {
      const c1 = completions1[i];
      const c2 = completions2[i];

      if (c1.task_name !== c2.task_name ||
        c1.completed_at !== c2.completed_at ||
        c1.completed_by !== c2.completed_by ||
        c1.notes !== c2.notes) {
        return false;
      }
    }

    return true;
  }

  _formatDateTime(dateString) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
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
      } else if (diffDays < 7) {
        return `${diffDays}d ago`;
      } else {
        // For older entries, show actual date
        return date.toLocaleDateString();
      }
    } catch {
      return 'Unknown time';
    }
  }

  _formatDuration(minutes) {
    if (!minutes) return '';

    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  }

  _render() {
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

        .loading, .error, .no-completions {
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

        .no-completions {
          color: var(--secondary-text-color);
        }

        .completion-item {
          display: flex;
          align-items: flex-start;
          padding: 8px 12px;
          margin-bottom: 4px;
          background: var(--secondary-background-color);
          border-radius: 4px;
          border-left: 2px solid #4caf50;
        }

        .completion-item:hover {
          background: var(--divider-color);
        }

        .completion-item:last-child {
          margin-bottom: 0;
        }

        .completion-content {
          flex: 1;
          min-width: 0;
        }

        .completion-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-start;
          margin-bottom: 2px;
          gap: 8px;
        }

        .completion-task {
          font-weight: 500;
          color: var(--primary-text-color);
          font-size: 0.95em;
          flex: 1;
          min-width: 0;
          word-wrap: break-word;
        }

        .completion-time {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          white-space: nowrap;
          flex-shrink: 0;
        }

        .completion-metadata {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          margin-bottom: 2px;
        }

        .completion-notes {
          font-size: 0.8em;
          color: var(--secondary-text-color);
          font-style: italic;
          margin-top: 4px;
          padding: 6px 8px;
          background: var(--card-background-color);
          border-radius: 4px;
          border-left: 2px solid var(--divider-color);
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
          <h3 class="title">Recent Completions</h3>
          <button class="refresh-btn" title="Refresh completions">
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>
          ${this._refreshing ? '<div class="refreshing-indicator"></div>' : ''}
        </div>

        ${this._renderContent()}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._fetchRecentCompletions());
    }
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
    const completedBy = completion.completed_by || 'Unknown';
    const duration = this._formatDuration(completion.duration_minutes);
    const time = this._formatDateTime(completion.completed_at);

    // Build metadata line with pipes
    const metadataParts = [];
    metadataParts.push(`by ${completedBy}`);
    if (duration) metadataParts.push(duration);
    if (completion.task_type) metadataParts.push(completion.task_type);

    return `
      <div class="completion-item">
        <div class="completion-content">
          <div class="completion-header">
            <div class="completion-task">${taskName}</div>
            <div class="completion-time">${time}</div>
          </div>
          <div class="completion-metadata">${metadataParts.join(' | ')}</div>
          ${this._config.show_notes && completion.notes ? `
            <div class="completion-notes">"${completion.notes}"</div>
          ` : ''}
        </div>
      </div>
    `;
  }

  getCardSize() {
    return Math.min(4, Math.max(1, Math.ceil(this._completions.length / 5)));
  }
}

class TaskTrackerRecentTasksCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._debounceTimers = {}; // Store debounce timers for different fields
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
            Days to Show
            <div class="config-description">Number of days back to fetch completions</div>
          </label>
          <input
            type="number"
            min="1"
            max="365"
            value="${this._config.days}"
            data-config-key="days"
          />
        </div>

        <div class="config-row">
          <label>
            Completion Limit
            <div class="config-description">Maximum number of completions to display</div>
          </label>
          <input
            type="number"
            min="1"
            max="100"
            value="${this._config.limit}"
            data-config-key="limit"
          />
        </div>

        <div class="config-row">
          <label>
            Show Completion Notes
            <div class="config-description">Display completion notes when available</div>
          </label>
          <input
            type="checkbox"
            ${this._config.show_notes ? 'checked' : ''}
            data-config-key="show_notes"
          />
        </div>

        <div class="section-title">Filter Settings</div>

        <div class="config-row">
          <label>
            User Filter Mode
            <div class="config-description">How to filter completions by user</div>
          </label>
          <select data-config-key="user_filter_mode">
            <option value="all" ${this._config.user_filter_mode === 'all' ? 'selected' : ''}>All Users</option>
            <option value="current" ${this._config.user_filter_mode === 'current' ? 'selected' : ''}>Current User</option>
            <option value="explicit" ${this._config.user_filter_mode === 'explicit' ? 'selected' : ''}>Specific User</option>
          </select>
        </div>

        ${this._config.user_filter_mode === 'explicit' ? `
        <div class="config-row">
          <label>
            Username
            <div class="config-description">Specific username to filter completions for</div>
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
            <div class="config-description">How often to automatically refresh completion data</div>
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