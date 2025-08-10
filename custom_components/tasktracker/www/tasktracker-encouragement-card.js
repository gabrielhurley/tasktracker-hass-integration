import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';

/**
 * TaskTracker Encouragement Card
 *
 * A minimalist card that displays AI-powered encouragement based on the user's daily plan.
 */
class TaskTrackerEncouragementCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._encouragement = null;
    this._loading = false;
    this._error = null;
    this._availableUsers = [];
    this._refreshInterval = null;
    this._eventCleanup = null;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-encouragement-card-editor');
  }

  static getStubConfig() {
    return {
      user_filter_mode: 'explicit',
      explicit_user: null,
      show_header: true,
      refresh_interval: 600,
    };
  }

  setConfig(config) {
    this._config = {
      user_filter_mode: config.user_filter_mode || 'explicit',
      explicit_user: config.explicit_user || null,
      show_header: config.show_header !== false,
      refresh_interval: config.refresh_interval || 600,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    const firstRun = this._hass === null;
    this._hass = hass;

    if (firstRun) {
      this._fetchEncouragement();
      this._setupAutoRefresh();
      this._setupEventListeners();
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
      this._eventCleanup().catch(() => {});
    }
  }

  _setupAutoRefresh() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
    }
    this._refreshInterval = TaskTrackerUtils.setupAutoRefresh(() => {
      this._fetchEncouragement();
    }, this._config.refresh_interval);
  }

  async _fetchAvailableUsers() {
    this._availableUsers = await TaskTrackerUtils.getAvailableUsers(this._hass);
  }

  _getUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
  }

  async _fetchEncouragement() {
    this._loading = true;
    this._error = null;
    this._render();

    await this._fetchAvailableUsers();
    const username = this._getUsername();

    const serviceData = {};
    if (username) {
      serviceData.username = username;
    }

    try {
      const response = await this._hass.callService('tasktracker', 'get_daily_plan_encouragement', serviceData, {}, true, true);

      if (response && response.response) {
        this._encouragement = response.response;
      } else {
        this._encouragement = null;
      }
    } catch (err) {
      console.error('Failed to fetch encouragement:', err);
      this._error = err.message;
      this._encouragement = null;
    }

    this._loading = false;
    this._render();
  }

  _setupEventListeners() {
    // Clean up any existing listener
    if (this._eventCleanup) {
      this._eventCleanup().catch(() => {});
    }

    // Listen for task completion events to refresh encouragement
    const completionCleanup = TaskTrackerUtils.setupTaskCompletionListener(this._hass, (eventData) => {
      const currentUsername = this._getUsername();
      if (!currentUsername || currentUsername === eventData.username) {
        setTimeout(() => {
          this._fetchEncouragement();
        }, 500);
      }
    });

    // Listen for task creation events to refresh encouragement
    const creationCleanup = TaskTrackerUtils.setupTaskCreationListener(this._hass, (eventData) => {
      const currentUsername = this._getUsername();
      if (!currentUsername || currentUsername === eventData.username) {
        setTimeout(() => {
          this._fetchEncouragement();
        }, 500);
      }
    });

    // Listen for daily state events to refresh encouragement
    const dailyStateCleanup = TaskTrackerUtils.setupEventListener(this._hass, 'tasktracker_daily_state_set', (event) => {
      const evUsername = event?.data?.username;
      const username = this._getUsername();
      if (!username || username === evUsername) {
        setTimeout(() => {
          this._fetchEncouragement();
        }, 500);
      }
    });

    // Combined cleanup function
    this._eventCleanup = async () => {
      await Promise.all([
        completionCleanup().catch(() => {}),
        creationCleanup().catch(() => {}),
        dailyStateCleanup().catch(() => {})
      ]);
    };
  }

  _render() {
    if (!this.shadowRoot) return;

    const username = this._getUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerStyles.getCommonCardStyles()}
      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Encouragement ${username ? `- ${TaskTrackerUtils.capitalize(username)}` : ''}</h3>
            <button class="refresh-btn" title="Refresh encouragement">
              <ha-icon icon="mdi:refresh"></ha-icon>
            </button>
          </div>
        ` : ''}

        ${this._renderContent()}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._fetchEncouragement());
    }
  }

  _renderContent() {
    if (this._loading) {
      return '<div class="loading">Loading encouragement...</div>';
    }

    if (this._error) {
      if (this._error.includes('AI') || this._error.includes('configuration') || this._error.includes('500')) {
        return `
          <div class="message message--muted">
            AI encouragement is not available right now.<br>
            <small>AI service may not be configured or is temporarily unavailable.</small>
          </div>
        `;
      }
      return `<div class="error">Error: ${this._error}</div>`;
    }

    if (!TaskTrackerUtils.hasValidUserConfig(this._config)) {
      return '<div class="no-user-warning">No user configured. Please set user in card configuration.</div>';
    }

    if (!this._encouragement || !this._encouragement.success) {
      return '<div class="no-tasks">No encouragement available.</div>';
    }

    const encouragementText = this._encouragement.data?.encouragement || this._encouragement.spoken_response;

    if (!encouragementText) {
      return '<div class="no-encouragement">No encouragement message available.</div>';
    }

    return `
      <div class="text-center">
        <div class="italic">${encouragementText}</div>
      </div>
    `;
  }

  getCardSize() {
    return 2;
  }
}

// Config editor
class TaskTrackerEncouragementCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    const isInitialRender = !this.shadowRoot.hasChildNodes();
    this._config = { ...TaskTrackerEncouragementCard.getStubConfig(), ...config };

    if (isInitialRender) {
      this._render();
    } else {
      // Update field values without re-rendering
      this._updateFieldValues();
    }
  }

  set hass(hass) {
    this._hass = hass;
  }

  _valueChanged(ev) {
    TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
  }

  _updateFieldValues() {
    // Update field values without re-rendering
    this.shadowRoot.querySelectorAll('input, select').forEach(input => {
      const configKey = input.dataset.configKey;
      if (configKey && this._config[configKey] !== undefined) {
        if (input.type === 'checkbox') {
          input.checked = this._config[configKey];
        } else {
          input.value = this._config[configKey] || '';
        }
      }
    });

    // Handle user_filter_mode visibility
    const explicitUserRow = this.shadowRoot.querySelector('.explicit-user-row');
    if (explicitUserRow) {
      explicitUserRow.classList.toggle('hidden', this._config.user_filter_mode !== 'explicit');
    }
  }

  _updateConfig(configKey, value) {
    this._config = {
      ...this._config,
      [configKey]: value
    };

    // If user_filter_mode changed, show/hide explicit user field
    if (configKey === 'user_filter_mode') {
      const explicitUserRow = this.shadowRoot.querySelector('.explicit-user-row');
      if (explicitUserRow) {
        explicitUserRow.classList.toggle('hidden', value !== 'explicit');
      }
    }

    this.dispatchEvent(new CustomEvent('config-changed', { detail: { config: this._config } }));
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

        <div class="section-title">User Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'User Filter Mode',
          'How to determine the user for encouragement',
          TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
            { value: 'current', label: 'Current User' },
            { value: 'explicit', label: 'Specific User' }
          ])
        )}

        <div class="explicit-user-row ${this._config.user_filter_mode === 'explicit' ? '' : 'hidden'}">
          ${TaskTrackerUtils.createConfigRow(
            'Username',
            'Specific username for encouragement',
            TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
          )}
        </div>

        <div class="section-title">Behavior Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'Refresh Interval (seconds)',
          'How often to automatically refresh encouragement',
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
}

if (!customElements.get('tasktracker-encouragement-card')) {
  customElements.define('tasktracker-encouragement-card', TaskTrackerEncouragementCard);
}
if (!customElements.get('tasktracker-encouragement-card-editor')) {
  customElements.define('tasktracker-encouragement-card-editor', TaskTrackerEncouragementCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === 'tasktracker-encouragement-card')) {
  window.customCards.push({
    type: 'tasktracker-encouragement-card',
    name: 'TaskTracker Encouragement',
    description: 'Displays AI-powered encouragement based on your daily plan',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}