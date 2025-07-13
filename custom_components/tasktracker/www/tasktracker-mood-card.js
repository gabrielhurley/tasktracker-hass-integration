import { TaskTrackerUtils } from './tasktracker-utils.js';

class TaskTrackerMoodCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._hass = null;
    this._config = {};
    this._mood = null;
    this._availableUsers = [];
    this._loading = false;
    this._error = null;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-mood-card-editor');
  }

  static getStubConfig() {
    return {
      user_filter_mode: 'explicit', // 'current' or 'explicit'
      explicit_user: null,
      show_header: true,
    };
  }

  setConfig(config) {
    this._config = {
      user_filter_mode: config.user_filter_mode || 'explicit',
      explicit_user: config.explicit_user || null,
      show_header: config.show_header !== false,
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
      await this._fetchMood();
      this._setupEventListener();
    } catch (error) {
      this._error = error.message;
    } finally {
      this._loading = false;
      this._render();
    }
  }

  connectedCallback() {
    this._render();
  }

  disconnectedCallback() {
    if (this._eventCleanup) {
      this._eventCleanup();
    }
  }

  async _fetchAvailableUsers() {
    this._availableUsers = await TaskTrackerUtils.getAvailableUsers(this._hass);
  }

  _getUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);
  }

  async _fetchMood() {
    const username = this._getUsername();
    if (!username) return;

    try {
      const resp = await this._hass.callService('tasktracker', 'get_mood', { username }, {}, true, true);
      if (resp && resp.response && resp.response.data && resp.response.data.mood) {
        this._mood = resp.response.data.mood;
      }
    } catch (err) {
      console.warn('Failed to fetch mood:', err);
    }
  }

  _setupEventListener() {
    this._eventCleanup = TaskTrackerUtils.setupEventListener(this._hass, 'mood_set', (event) => {
      const evUsername = event?.username;
      const username = this._getUsername();
      if (evUsername === username) {
        this._mood = event.mood;
        this._render();
      }
    });
  }

  async _handleRefresh() {
    this._loading = true;
    this._error = null;
    this._render();

    try {
      await this._fetchMood();
    } catch (error) {
      this._error = error.message;
    } finally {
      this._loading = false;
      this._render();
    }
  }

  _handleMoodChange(mood) {
    const username = this._getUsername();
    if (!mood || !username) return;

    this._hass.callService('tasktracker', 'set_mood', { mood, username }, {}, true, true);
  }

  _showEditModal() {
    const username = this._getUsername();
    if (!username) return;

    const modal = this._createMoodEditModal();
    TaskTrackerUtils.showModal(modal);
  }

  _createMoodEditModal() {
    const modal = document.createElement('div');
    modal.className = 'mood-edit-modal';
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
      max-width: 400px;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font-family: var(--primary-font-family);
    `;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Set Mood';
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
      width: 32px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 50%;
    `;

    header.appendChild(title);
    header.appendChild(closeButton);

    // Mood options
    const moodOptions = document.createElement('div');
    moodOptions.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 12px;
      margin-bottom: 20px;
    `;

    const moods = [
      { value: 'bad', label: 'Bad', icon: 'mdi:emoticon-sad', color: '#f44336' },
      { value: 'lazy', label: 'Lazy', icon: 'mdi:emoticon-neutral', color: '#ff9800' },
      { value: 'productive', label: 'Productive', icon: 'mdi:emoticon-happy', color: '#4caf50' },
      { value: 'great', label: 'Great', icon: 'mdi:emoticon-excited', color: '#2196f3' }
    ];

    moods.forEach(mood => {
      const moodButton = document.createElement('button');
      moodButton.style.cssText = `
        display: flex;
        align-items: center;
        gap: 8px;
        padding: 12px;
        border: 1px solid var(--divider-color);
        border-radius: 6px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        cursor: pointer;
        font-family: inherit;
        font-size: 14px;
        transition: all 0.2s ease;
        ${this._mood === mood.value ? `border-color: ${mood.color}; background: ${mood.color}20;` : ''}
      `;

      const icon = document.createElement('ha-icon');
      icon.setAttribute('icon', mood.icon);
      icon.style.cssText = `
        color: ${mood.color};
        --mdc-icon-size: 20px;
      `;

      const label = document.createElement('span');
      label.textContent = mood.label;

      moodButton.appendChild(icon);
      moodButton.appendChild(label);

      moodButton.addEventListener('click', () => {
        this._handleMoodChange(mood.value);
        closeModal();
      });

      moodButton.addEventListener('mouseenter', () => {
        if (this._mood !== mood.value) {
          moodButton.style.borderColor = mood.color;
          moodButton.style.background = `${mood.color}10`;
        }
      });

      moodButton.addEventListener('mouseleave', () => {
        if (this._mood !== mood.value) {
          moodButton.style.borderColor = 'var(--divider-color)';
          moodButton.style.background = 'var(--card-background-color)';
        }
      });

      moodOptions.appendChild(moodButton);
    });

    // Cancel button
    const cancelButton = document.createElement('button');
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      width: 100%;
      padding: 12px;
      border: 1px solid var(--divider-color);
      border-radius: 6px;
      background: var(--card-background-color);
      color: var(--secondary-text-color);
      cursor: pointer;
      font-family: inherit;
      font-size: 14px;
    `;

    const closeModal = () => {
      if (modal.parentNode) {
        modal.parentNode.removeChild(modal);
      }
      document.removeEventListener('keydown', escapeHandler);
    };

    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', escapeHandler);

    modalContent.appendChild(header);
    modalContent.appendChild(moodOptions);
    modalContent.appendChild(cancelButton);
    modal.appendChild(modalContent);

    return modal;
  }

  _render() {
    if (!this.shadowRoot) return;

    const username = this._getUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);
    const { icon, color, label } = TaskTrackerUtils.moodToIcon(this._mood);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerUtils.getCommonCardStyles()}
        .mood-display {
          display: flex;
          align-items: center;
          justify-content: space-between;
          gap: 8px;
          font-size: 1.2em;
          margin-bottom: 12px;
        }
        .mood-info {
          display: flex;
          align-items: center;
          gap: 8px;
        }
        .mood-info ha-icon {
          color: ${color};
        }
        .edit-button {
          background: none;
          border: none;
          cursor: pointer;
          color: var(--secondary-text-color);
          padding: 4px 8px;
          border-radius: 4px;
          font-size: 14px;
          transition: all 0.2s ease;
        }
        .edit-button:hover {
          background: var(--divider-color);
          color: var(--primary-text-color);
        }
      </style>

      <div class="card">
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Mood ${username ? `- ${TaskTrackerUtils.capitalize(username)}` : ''}</h3>
            <button class="refresh-btn" title="Refresh mood">
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
      refreshBtn.addEventListener('click', () => this._handleRefresh());
    }

    const editBtn = this.shadowRoot.querySelector('.edit-button');
    if (editBtn) {
      editBtn.addEventListener('click', () => this._showEditModal());
    }
  }

  _renderContent() {
    if (this._loading) {
      return '<div class="loading">Loading mood...</div>';
    }

    if (this._error) {
      return `<div class="error">${this._error}</div>`;
    }

    if (!TaskTrackerUtils.hasValidUserConfig(this._config)) {
      return '<div class="no-user-warning">No user configured. Please set user in card configuration.</div>';
    }

    const { icon, color, label } = TaskTrackerUtils.moodToIcon(this._mood);

    return `
      <div class="mood-display">
        <div class="mood-info">
          <ha-icon icon="${icon}"></ha-icon>
          <span>${label || 'No mood set'}</span>
        </div>
        <button class="edit-button" title="Edit mood">
          <ha-icon icon="mdi:pencil"></ha-icon>
        </button>
      </div>
    `;
  }

  getCardSize() {
    return 2;
  }
}

if (!customElements.get('tasktracker-mood-card')) {
  customElements.define('tasktracker-mood-card', TaskTrackerMoodCard);
}

class TaskTrackerMoodCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
  }

  setConfig(config) {
    this._config = { ...TaskTrackerMoodCard.getStubConfig(), ...config };
    this._render();
  }

  set hass(hass) {
    this._hass = hass;
  }

  _valueChanged(ev) {
    TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
  }

  _updateConfig(configKey, value) {
    this._config = {
      ...this._config,
      [configKey]: value
    };

    // If user_filter_mode changed, re-render to show/hide explicit user field
    if (configKey === 'user_filter_mode') {
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

        <div class="section-title">User Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'User Filter Mode',
          'How to determine the user for mood tracking',
          TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
            { value: 'current', label: 'Current User' },
            { value: 'explicit', label: 'Specific User' }
          ])
        )}

        ${this._config.user_filter_mode === 'explicit' ? TaskTrackerUtils.createConfigRow(
          'Username',
          'Specific username for mood tracking',
          TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
        ) : ''}
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
}

if (!customElements.get('tasktracker-mood-card-editor')) {
  customElements.define('tasktracker-mood-card-editor', TaskTrackerMoodCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(c => c.type === 'tasktracker-mood-card')) {
  window.customCards.push({
    type: 'tasktracker-mood-card',
    name: 'TaskTracker Mood',
    description: 'View and set your daily mood',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}