import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';
import { TaskTrackerBaseEditor } from './utils/base-config-editor.js';
import { TaskTrackerDailyStateUI } from './utils/ui/daily-state-ui.js';

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

    // No last-saved timestamp tracking
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



  // Removed: preset selection handled by shared UI

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
      // No last-saved timestamp tracking

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
    if (type === 'success') {
      TaskTrackerUtils.showSuccess(message);
    } else if (type === 'error') {
      TaskTrackerUtils.showError(message);
    } else {
      TaskTrackerUtils.showSuccess(message);
    }
  }

  _toggleAdvanced() {
    this._showAdvanced = !this._showAdvanced;
    this._render();
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

    // Add a temporary highlight effect using class
    const card = this.shadowRoot.querySelector('.card');
    if (card) {
      card.classList.add('tt-focus-highlight');
      setTimeout(() => card.classList.remove('tt-focus-highlight'), 2000);
    }
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerStyles.getCommonCardStyles()}
        ${TaskTrackerStyles.getDailyStateSharedStyles()}
        ${TaskTrackerStyles.getDailyStateCardStyles()}
        ${TaskTrackerStyles.getCompleteTaskCardStyles()}
      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Daily Check-in${this._getUsername() ? ` - ${TaskTrackerUtils.capitalize(this._getUsername())}` : ''}</h3>
            <button class="refresh-btn" title="Refresh state"><ha-icon icon="mdi:refresh"></ha-icon></button>
          </div>
        ` : ''}

        ${this._loading ? '<div class="loading">Loading…</div>' :
          this._error ? `<div class="error">${this._error}</div>` :
          '<div class="tt-ds-mount"></div>'}
      </div>
    `;

    this._attachEventListeners();

    if (!this._loading && !this._error) {
      // Mount the shared UI
      const mount = this.shadowRoot.querySelector('.tt-ds-mount');
      if (mount) {
        const presets = TaskTrackerUtils.getPresetDailyStates();
        const currentState = this._getCurrentStateOrDefaults();
        const currentPreset = TaskTrackerUtils.findMatchingDailyStatePreset(currentState);
        const useEmoji = this._config.use_emoji_labels;

        // Keep a reference to update on re-render
        this._uiController = TaskTrackerDailyStateUI.render(mount, {
          mode: 'embedded',
          state: currentState,
          hasExistingState: this._hasExistingState(),
          currentPreset,
          showAdvanced: this._showAdvanced,
          useEmojiLabels: useEmoji,
          saving: this._saving,
          presets,
          getMoodLabel: (v) => this._getMoodLabel(v),
          getFreeTimeLabel: (v) => this._getFreeTimeLabel(v),
          onSelectPreset: async (presetKey) => {
            const preset = presets[presetKey];
            if (presetKey === 'complicated') {
              this._showAdvanced = true;
              this._uiController.update({ showAdvanced: true });
              return;
            }
            if (preset && preset.values) {
              await this._saveState(preset.values);
            }
          },
          onSave: async () => {
            // In embedded mode, saving uses current internal state
            await this._handleAdvancedSave();
          },
          onToggleBackToSimple: () => {
            this._toggleAdvanced();
          },
          onSliderChange: (axis, value) => {
            this._handleStateChange(axis, value);
          }
        });
      }
    }
  }

  // Old _renderContent and render helpers removed. Shared UI handles rendering.

  _attachEventListeners() {
    // Header refresh button
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._handleRefresh());
    }

    // Shared UI attaches its own listeners on mount
  }

  getCardSize() {
    return this._showAdvanced ? 4 : 3;
  }
}

// ---------------------------------------------------------------------------
// Editor
// ---------------------------------------------------------------------------
class TaskTrackerDailyStateCardEditor extends TaskTrackerBaseEditor {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
  }

  getDefaultConfig() { return { ...TaskTrackerDailyStateCard.getStubConfig() }; }

  _updateConfig(key, value) { super._updateConfig(key, value); if (key === 'user_filter_mode') this._render(); }

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