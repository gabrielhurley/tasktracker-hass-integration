import { TaskTrackerUtils } from './tasktracker-utils.js';

class TaskTrackerDailyStateCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._state = null; // {energy, motivation, focus, pain, mood, free_time}
    this._availableUsers = [];
    this._loading = false;
    this._error = null;
    this._eventCleanup = null;
    this._showAdvanced = false;
    this._saving = false;
    this._lastSavedTimestamp = null;
    this._currentPreset = null; // stores the matching preset key if current state matches a preset
  }

  static getConfigElement() {
    return document.createElement('tasktracker-daily-state-card-editor');
  }

  static getStubConfig() {
    return {
      user_filter_mode: 'current', // 'current' or 'explicit'
      explicit_user: null,
      show_header: true,
      default_view_mode: 'auto', // 'simple', 'detailed', 'auto'
      use_emoji_labels: true,
    };
  }

  setConfig(config) {
    this._config = {
      user_filter_mode: config.user_filter_mode || 'current',
      explicit_user: config.explicit_user || null,
      show_header: config.show_header !== false,
      default_view_mode: config.default_view_mode || 'auto',
      use_emoji_labels: config.use_emoji_labels !== false,
      ...config,
    };
    this._render();
  }

  set hass(hass) {
    const firstRun = !this._hass;
    this._hass = hass;
    if (firstRun) {
      this._initialize();
    }
  }

  async _initialize() {
    this._loading = true;
    this._render();
    try {
      await this._fetchAvailableUsers();
      await this._fetchDailyState();
      this._setupEventListener();
    } catch (e) {
      this._error = e.message;
    } finally {
      this._loading = false;
      this._render();
    }
  }

  connectedCallback() {
    this._render();

    // Listen for focus events from other cards
    this.addEventListener('focus-daily-state', (event) => {
      this._handleFocusRequest(event.detail);
    });
  }

  disconnectedCallback() {
    if (this._eventCleanup) {
      this._eventCleanup();
    }
  }

  _setupEventListener() {
    this._eventCleanup = TaskTrackerUtils.setupEventListener(this._hass, 'daily_state_set', (event) => {
      const evUsername = event?.username;
      const username = this._getUsername();
      if (evUsername === username) {
        this._state = { ...this._state, ...event.state };
        this._currentPreset = TaskTrackerUtils.findMatchingDailyStatePreset(this._state);
        this._lastSavedTimestamp = new Date();
        this._render();
      }
    });
  }

  async _fetchAvailableUsers() {
    this._availableUsers = await TaskTrackerUtils.getAvailableUsers(this._hass);
  }

  _getUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
  }

  async _fetchDailyState() {
    const username = this._getUsername();
    if (!username) return;

    this._state = await TaskTrackerUtils.fetchDailyState(this._hass, username);

    // Find matching preset
    this._currentPreset = TaskTrackerUtils.findMatchingDailyStatePreset(this._state);

    // Determine initial view based on config and matching preset
    this._showAdvanced = this._determineInitialView();

    // If we have a saved state, assume it was saved recently for display purposes
    if (this._state && Object.keys(this._state).length > 0) {
      this._lastSavedTimestamp = new Date();
    }
  }

  _getCurrentStateOrDefaults() {
    return this._state || TaskTrackerUtils.getDefaultDailyState();
  }

  _hasExistingState() {
    return this._state !== null && this._state !== undefined;
  }

    _determineInitialView() {
    const viewMode = this._config.default_view_mode;

    if (viewMode === 'simple') {
      return false; // Show simple view
    } else if (viewMode === 'detailed') {
      return true; // Show advanced view
    } else { // auto mode
      // If no existing state, default to simple view
      if (!this._hasExistingState()) {
        return false;
      }
      // If we have state, show detailed only if it's complicated
      return this._currentPreset === 'complicated';
    }
  }



  async _handlePresetSelection(presetKey) {
    const presets = TaskTrackerUtils.getPresetDailyStates();
    const preset = presets[presetKey];

    if (!preset) return;

    if (presetKey === 'complicated') {
      // Switch to advanced mode
      this._showAdvanced = true;
      this._render();
      return;
    }

    // Save the preset values
    await this._saveState(preset.values);
  }

  async _saveState(stateValues) {
    const username = this._getUsername();
    if (!username) return;

    this._saving = true;
    this._render();

    const success = await TaskTrackerUtils.saveDailyState(this._hass, username, stateValues);

    if (success) {
      // Update local state
      this._state = { ...stateValues };
      this._currentPreset = TaskTrackerUtils.findMatchingDailyStatePreset(this._state);
      this._lastSavedTimestamp = new Date();

      // Show success toast
      this._showToast('State saved', 'success');
    } else {
      this._showToast('Failed to save state', 'error');
    }

    this._saving = false;
    this._render();
  }

      async _handleStateChange(axis, value) {
    // When user changes sliders, create state if it doesn't exist
    const currentState = this._hasExistingState() ? this._state : TaskTrackerUtils.getDefaultDailyState();
    const newState = { ...currentState, [axis]: value };

    // Update immediately for responsive UI
    this._state = newState;
    this._currentPreset = TaskTrackerUtils.findMatchingDailyStatePreset(this._state);
    this._render();
  }

  async _handleAdvancedSave() {
    // In advanced mode, if no state exists, use current slider values (which default to getDefaultDailyState())
    const currentState = this._hasExistingState() ? this._state : TaskTrackerUtils.getDefaultDailyState();
    await this._saveState(currentState);
  }

  async _handleRefresh() {
    this._loading = true;
    this._error = null;
    this._render();

    try {
      await this._fetchDailyState();
    } catch (e) {
      this._error = e.message;
    } finally {
      this._loading = false;
      this._render();
    }
  }

  _showToast(message, type = 'info') {
    // Create toast element
    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: ${type === 'success' ? 'var(--success-color, #4caf50)' : 'var(--error-color, #f44336)'};
      color: white;
      padding: 12px 20px;
      border-radius: 4px;
      z-index: 1000;
      box-shadow: 0 2px 8px rgba(0,0,0,0.2);
      transform: translateX(100%);
      transition: transform 0.3s ease;
    `;

    document.body.appendChild(toast);

    // Animate in
    requestAnimationFrame(() => {
      toast.style.transform = 'translateX(0)';
    });

    // Remove after 2 seconds
    setTimeout(() => {
      toast.style.transform = 'translateX(100%)';
      setTimeout(() => {
        if (toast.parentNode) {
          toast.parentNode.removeChild(toast);
        }
      }, 300);
    }, 2000);
  }

  _toggleAdvanced() {
    this._showAdvanced = !this._showAdvanced;
    this._render();
  }

  _formatTimestamp(timestamp) {
    if (!timestamp) return '';
    return timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  _getMoodLabel(value) {
    return TaskTrackerUtils.getMoodLabel(value, this._config.use_emoji_labels);
  }

  _getFreeTimeLabel(value) {
    return TaskTrackerUtils.getFreeTimeLabel(value);
  }

  _handleFocusRequest(detail) {
    // Switch to simple view if currently in advanced mode
    if (this._showAdvanced) {
      this._showAdvanced = false;
      this._render();
    }

    // Add a temporary highlight effect
    const card = this.shadowRoot.querySelector('.card');
    if (card) {
      card.style.transition = 'box-shadow 0.3s ease';
      card.style.boxShadow = '0 0 20px rgba(255, 193, 7, 0.5)';

      setTimeout(() => {
        card.style.boxShadow = '';
      }, 2000);
    }
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerUtils.getCommonCardStyles()}

        .main-content {
          padding: 16px;
        }

                 .quick-flow {
           margin-bottom: 16px;
         }

         .quick-prompt {
           font-size: 16px;
           margin-bottom: 16px;
           color: var(--primary-text-color);
           text-align: center;
         }

         .no-state-message {
           font-size: 14px;
           margin-bottom: 12px;
           color: var(--secondary-text-color);
           text-align: center;
           font-style: italic;
         }

         .preset-grid {
           display: grid;
           grid-template-columns: repeat(2, 1fr);
           gap: 8px;
           margin-bottom: 16px;
         }

         .preset-btn {
           background: var(--card-background-color);
           border: 2px solid var(--divider-color);
           border-radius: 8px;
           padding: 16px 12px;
           cursor: pointer;
           font-size: 14px;
           font-weight: 500;
           color: var(--primary-text-color);
           transition: all 0.2s ease;
           text-align: center;
           min-height: 60px;
           display: flex;
           align-items: center;
           justify-content: center;
         }

         .preset-btn:hover {
           border-color: var(--primary-color);
           background: var(--primary-color);
           color: var(--text-primary-color);
         }

         .preset-btn:active {
           transform: scale(0.98);
         }

                   .preset-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }

          .preset-btn.selected {
            border-color: var(--primary-color);
            background: var(--primary-color);
            color: var(--text-primary-color);
          }

         @media (min-width: 500px) {
           .preset-grid {
             grid-template-columns: repeat(4, 1fr);
           }
         }

        .button-row {
          display: flex;
          justify-content: flex-end;
          gap: 8px;
          align-items: center;
        }

        .btn {
          background: var(--primary-color);
          color: var(--text-primary-color);
          border: none;
          border-radius: 4px;
          padding: 8px 16px;
          cursor: pointer;
          font-size: 14px;
          display: flex;
          align-items: center;
          gap: 4px;
          transition: background-color 0.2s;
        }

        .btn:hover {
          background: var(--primary-color);
          opacity: 0.9;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-secondary {
          background: var(--secondary-background-color);
          color: var(--primary-text-color);
          border: 1px solid var(--divider-color);
        }

        .advanced-toggle {
          background: none;
          border: none;
          color: var(--primary-color);
          cursor: pointer;
          font-size: 14px;
          text-decoration: underline;
          padding: 4px;
          margin-top: 8px;
        }

        .advanced-section {
          margin-top: 16px;
          border-top: 1px solid var(--divider-color);
          padding-top: 16px;
        }

        .slider-row {
          display: grid;
          grid-template-columns: 100px 1fr 60px;
          align-items: center;
          gap: 12px;
          margin-bottom: 12px;
        }

        .slider-label {
          font-weight: 500;
          color: var(--primary-text-color);
        }

        .slider-container {
          position: relative;
        }

        input[type="range"] {
          width: 100%;
          height: 6px;
          border-radius: 3px;
          background: var(--disabled-text-color);
          outline: none;
          -webkit-appearance: none;
        }

        input[type="range"]::-webkit-slider-thumb {
          -webkit-appearance: none;
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
        }

        input[type="range"]::-moz-range-thumb {
          width: 18px;
          height: 18px;
          border-radius: 50%;
          background: var(--primary-color);
          cursor: pointer;
          border: none;
        }

        .slider-value {
          text-align: center;
          font-weight: 500;
          min-width: 60px;
          color: var(--primary-text-color);
        }

        .tooltip {
          position: absolute;
          bottom: 100%;
          left: 50%;
          transform: translateX(-50%);
          background: var(--card-background-color);
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          padding: 8px;
          font-size: 12px;
          white-space: nowrap;
          opacity: 0;
          pointer-events: none;
          transition: opacity 0.2s;
          z-index: 100;
          box-shadow: 0 2px 8px rgba(0,0,0,0.1);
        }

        .slider-container:hover .tooltip {
          opacity: 1;
        }

        .footer {
          margin-top: 16px;
          padding-top: 8px;
          border-top: 1px solid var(--divider-color);
          font-size: 12px;
          color: var(--secondary-text-color);
          text-align: center;
        }

                 @media (max-width: 400px) {
           .slider-row {
             grid-template-columns: 1fr;
             gap: 8px;
             text-align: center;
           }

           .preset-grid {
             grid-template-columns: 1fr;
             gap: 12px;
           }

           .preset-btn {
             min-height: 50px;
           }

           .button-row {
             flex-direction: column;
           }
         }
      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Daily Check-in${this._getUsername() ? ` - ${TaskTrackerUtils.capitalize(this._getUsername())}` : ''}</h3>
            <button class="refresh-btn" title="Refresh state"><ha-icon icon="mdi:refresh"></ha-icon></button>
          </div>
        ` : ''}

        <div class="main-content">
          ${this._loading ? '<div class="loading">Loading…</div>' :
            this._error ? `<div class="error">${this._error}</div>` :
            this._renderContent()}
        </div>
      </div>
    `;

    this._attachEventListeners();
  }

      _renderContent() {
    // For advanced view, always show values (use defaults if no state exists)
    const currentState = this._getCurrentStateOrDefaults();

    return `
      ${!this._showAdvanced ? `
        <div class="quick-flow">
          <div class="quick-prompt">How are you feeling today?</div>
          <div class="preset-grid">
            ${this._renderPresetButtons()}
          </div>
        </div>
      ` : ''}

      ${this._showAdvanced ? `
        <div class="advanced-section">
          ${this._renderSlider('energy', 'Energy', currentState.energy, 1, 5, 'Higher energy enables more demanding tasks')}
          ${this._renderSlider('motivation', 'Motivation', currentState.motivation, 1, 5, 'Higher motivation suggests more challenging tasks')}
          ${this._renderSlider('focus', 'Focus', currentState.focus, 1, 5, 'Higher focus enables detail-oriented work')}
          ${this._renderSlider('pain', 'Pain', currentState.pain, 1, 5, 'Higher pain reduces strenuous task suggestions')}
          ${this._renderSlider('mood', 'Mood', currentState.mood, -2, 2, 'Mood affects task type and difficulty recommendations', true)}
          ${this._renderSlider('free_time', 'Free Time', currentState.free_time, 1, 5, 'More free time allows longer task suggestions', false, true)}

          <div class="button-row">
            <button class="btn-secondary advanced-toggle">⌃ Simple</button>
            <button class="btn advanced-save-btn" ${this._saving ? 'disabled' : ''}>
              <ha-icon icon="mdi:check"></ha-icon>
              ${this._saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      ` : ''}

      ${this._lastSavedTimestamp ? `
        <div class="footer">
          Saved ${this._formatTimestamp(this._lastSavedTimestamp)}
        </div>
      ` : ''}
    `;
  }

    _renderPresetButtons() {
    const presets = TaskTrackerUtils.getPresetDailyStates();
    return Object.keys(presets).map(key => {
      const preset = presets[key];
      // Only highlight if we have existing state that matches this preset
      const isSelected = this._hasExistingState() && this._currentPreset === key;
      return `
        <button class="preset-btn ${isSelected ? 'selected' : ''}" data-preset="${key}" ${this._saving ? 'disabled' : ''}>
          ${preset.label}
        </button>
      `;
    }).join('');
  }

  _renderSlider(key, label, value, min, max, tooltip, isMood = false, isFreeTime = false) {
    let displayValue = value;
    if (isMood) {
      displayValue = this._getMoodLabel(value);
    } else if (isFreeTime) {
      displayValue = this._getFreeTimeLabel(value);
    }

    return `
      <div class="slider-row">
        <div class="slider-label">${label}</div>
        <div class="slider-container">
          <input type="range" min="${min}" max="${max}" step="1" value="${value}" data-axis="${key}">
          <div class="tooltip">${tooltip}</div>
        </div>
        <div class="slider-value">${displayValue}</div>
      </div>
    `;
  }

  _attachEventListeners() {
    // Header refresh button
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._handleRefresh());
    }

    // Preset buttons
    const presetBtns = this.shadowRoot.querySelectorAll('.preset-btn');
    presetBtns.forEach(btn => {
      btn.addEventListener('click', (e) => {
        const presetKey = e.target.dataset.preset;
        this._handlePresetSelection(presetKey);
      });
    });

    // Advanced save button
    const advancedSaveBtn = this.shadowRoot.querySelector('.advanced-save-btn');
    if (advancedSaveBtn) {
      advancedSaveBtn.addEventListener('click', () => this._handleAdvancedSave());
    }

    // Advanced toggle buttons
    const toggleBtns = this.shadowRoot.querySelectorAll('.advanced-toggle');
    toggleBtns.forEach(btn => {
      btn.addEventListener('click', () => this._toggleAdvanced());
    });

    // Sliders
    const sliders = this.shadowRoot.querySelectorAll('input[type="range"]');
    sliders.forEach(slider => {
      slider.addEventListener('input', (e) => {
        const axis = e.target.dataset.axis;
        const val = parseInt(e.target.value);
        this._handleStateChange(axis, val);
      });

      // Keyboard navigation
      slider.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
          e.preventDefault();
          const axis = e.target.dataset.axis;
          const currentVal = parseInt(e.target.value);
          const min = parseInt(e.target.min);
          const max = parseInt(e.target.max);

          let newVal = currentVal;
          if (e.key === 'ArrowLeft' && currentVal > min) {
            newVal = currentVal - 1;
          } else if (e.key === 'ArrowRight' && currentVal < max) {
            newVal = currentVal + 1;
          }

          e.target.value = newVal;
          this._handleStateChange(axis, newVal);
        }
      });
    });
  }

  getCardSize() {
    return this._showAdvanced ? 4 : 3;
  }
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
class TaskTrackerDailyStateCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...TaskTrackerDailyStateCard.getStubConfig(), ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _valueChanged(ev) {
    TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
  }

  _updateConfig(key, value) {
    this._config = { ...this._config, [key]: value };
    if (key === 'user_filter_mode') {
      this._render();
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
        ${TaskTrackerUtils.createConfigRow(
          'Default View Mode',
          'How the card should initially appear',
          TaskTrackerUtils.createSelectInput(this._config.default_view_mode, 'default_view_mode', [
            { value: 'simple', label: 'Always Simple' },
            { value: 'detailed', label: 'Always Detailed' },
            { value: 'auto', label: 'Auto (based on current state)' },
          ])
        )}
        ${TaskTrackerUtils.createConfigRow(
          'Use Emoji Labels',
          'Show emoji for mood values and text labels for free time',
          TaskTrackerUtils.createCheckboxInput(this._config.use_emoji_labels, 'use_emoji_labels')
        )}

        <div class="section-title">User Settings</div>
        ${TaskTrackerUtils.createConfigRow(
          'User Filter Mode',
          'Determine which user daily state applies to',
          TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
            { value: 'current', label: 'Current User (Auto)' },
            { value: 'explicit', label: 'Specific User' },
          ])
        )}

        ${this._config.user_filter_mode === 'explicit' ? TaskTrackerUtils.createConfigRow(
          'Username',
          'Specific username for daily state',
          TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
        ) : ''}
      </div>
    `;

    this.shadowRoot.querySelectorAll('input, select').forEach(el => {
      el.addEventListener('change', this._valueChanged.bind(this));
      if (el.type === 'text') {
        el.addEventListener('input', this._valueChanged.bind(this));
      }
    });
  }
}

// ---------------------------------------------------------------------------
// Registration
// ---------------------------------------------------------------------------
if (!customElements.get('tasktracker-daily-state-card')) {
  customElements.define('tasktracker-daily-state-card', TaskTrackerDailyStateCard);
}

if (!customElements.get('tasktracker-daily-state-card-editor')) {
  customElements.define('tasktracker-daily-state-card-editor', TaskTrackerDailyStateCardEditor);
}

// Register with Home Assistant's custom card preview list
window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === 'tasktracker-daily-state-card')) {
  window.customCards.push({
    type: 'tasktracker-daily-state-card',
    name: 'TaskTracker Daily State',
    description: 'View and set your daily state with one-click or detailed controls',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}