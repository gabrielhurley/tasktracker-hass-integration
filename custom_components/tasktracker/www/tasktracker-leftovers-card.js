import { TaskTrackerUtils } from './tasktracker-utils.js';

/**
 * TaskTracker Leftovers Card
 *
 * A custom Lovelace card for managing leftover food items:
 * - Shows good and expired leftovers
 * - Visual emphasis for expired items
 * - Quick disposal actions
 * - Real-time API integration for leftover management
 */

class TaskTrackerLeftoversCard extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._leftovers = [];
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._default_refresh_interval = 300;
    this._default_max_items = 20;
  }

  static getConfigElement() {
    return document.createElement('tasktracker-leftovers-card-editor');
  }

  static getStubConfig() {
    return {
      categorize_by_safety: true,
      show_disposal_actions: true,
      refresh_interval: this._default_refresh_interval,
      max_items: this._default_max_items,
      show_age: true
    };
  }

  setConfig(config) {
    this._config = {
      categorize_by_safety: config.categorize_by_safety !== false,
      show_disposal_actions: config.show_disposal_actions !== false,
      refresh_interval: config.refresh_interval || this._default_refresh_interval, // seconds
      max_items: config.max_items || this._default_max_items,
      show_age: config.show_age !== false,
      ...config
    };

    this._render();
  }

  set hass(hass) {
    this._hass = hass;
    this._setupAutoRefresh();
    this._fetchLeftovers();
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

    this._refreshInterval = TaskTrackerUtils.setupAutoRefresh(() => {
      this._fetchLeftovers();
    }, this._config.refresh_interval);
  }

  _getCurrentUsername() {
    return TaskTrackerUtils.getCurrentUsername(this._config, this._hass);
  }

  async _fetchLeftovers() {
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
      const response = await this._hass.callService('tasktracker', 'list_leftovers', {}, {}, true, true);

      let newLeftovers = [];
      if (response && response.response && response.response.data && response.response.data.items) {
        newLeftovers = response.response.data.items.slice(0, this._config.max_items);
      }

      // Always update leftovers and re-render on initial load, only compare for subsequent refreshes
      if (this._initialLoad || !this._leftoversEqual(this._leftovers, newLeftovers)) {
        this._leftovers = newLeftovers;
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
      console.error('Failed to fetch leftovers:', error);
      this._error = `Failed to fetch leftovers: ${error.message}`;
      this._leftovers = [];
      this._loading = false;
      this._refreshing = false;
      this._initialLoad = false;
      this._render();
    }
  }

  _leftoversEqual(leftovers1, leftovers2) {
    return TaskTrackerUtils.arraysEqual(leftovers1, leftovers2, (l1, l2) => {
      return l1.name === l2.name &&
        l1.category === l2.category &&
        l1.expiration_date === l2.expiration_date &&
        l1.storage_location === l2.storage_location;
    });
  }

  _categorizeLeftoversByStatus(leftovers) {
    const now = new Date();
    const good = [];
    const expired = [];

    leftovers.forEach(leftover => {
      if (leftover.due_date) {
        const dueDate = new Date(leftover.due_date);
        if (dueDate >= now) {
          good.push(leftover);
        } else {
          expired.push(leftover);
        }
      } else {
        // If no due date, assume it's good for now
        good.push(leftover);
      }
    });

    return { good, expired };
  }

  async _disposeLeftover(leftover, notes) {
    const username = TaskTrackerUtils.getUsernameForAction(this._config, this._hass);

    if (!username) {
      if (this._config.user_filter_mode === 'all') {
        TaskTrackerUtils.showError('Cannot dispose leftover: No user available for disposal');
      } else {
        TaskTrackerUtils.showError('No user configured for leftover disposal');
      }
      return;
    }

    try {
      const response = await this._hass.callService('tasktracker', 'complete_task_by_name', {
        name: leftover.name,
        assigned_to: username,
        notes: notes || undefined
      }, {}, true, true);

      if (response && response.response && response.response.success) {
        TaskTrackerUtils.showSuccess(response.response.spoken_response || `Leftover "${leftover.name}" disposed successfully`);
      } else {
        const errorMsg = (response && response.response && response.response.message) || 'Unknown error';
        TaskTrackerUtils.showError(`Failed to dispose leftover: ${errorMsg}`);
      }

      // Refresh leftovers after disposal
      setTimeout(() => {
        this._fetchLeftovers();
      }, 1000);

    } catch (error) {
      console.error('Failed to dispose leftover:', error);
      TaskTrackerUtils.showError(`Failed to dispose leftover: ${error.message}`);
    }
  }

  _formatExpirationDate(expirationDateString) {
    return TaskTrackerUtils.formatDueDate(expirationDateString);
  }

  _formatAge(createdAt) {
    try {
      const created = new Date(createdAt);
      const now = new Date();
      const diffMs = now - created;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (diffDays > 0) {
        return `${diffDays} day${diffDays === 1 ? '' : 's'}`;
      } else if (diffHours > 0) {
        return `${diffHours} hour${diffHours === 1 ? '' : 's'}`;
      } else {
        return 'Less than 1 hour';
      }
    } catch {
      return 'Unknown age';
    }
  }

  _formatExpirationStatus(leftover) {
    if (!leftover.due_date) return 'No expiration';

    try {
      const dueDate = new Date(leftover.due_date);
      const now = new Date();
      const diffMs = dueDate - now;
      const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

      if (diffMs < 0) {
        // Expired
        const expiredDays = Math.abs(diffDays);
        if (expiredDays === 0) {
          return 'Expired today';
        } else if (expiredDays === 1) {
          return '1 day expired';
        } else {
          return `${expiredDays} days expired`;
        }
      } else if (diffDays === 0) {
        // Expires today
        return diffHours > 0 ? `${diffHours}h left` : 'Expires now';
      } else if (diffDays === 1) {
        return 'Expires tomorrow';
      } else {
        return `${diffDays} days left`;
      }
    } catch {
      return 'Unknown status';
    }
  }

  _showLeftoverModal(leftover, leftoverIndex) {
    const modal = this._createLeftoverModal(leftover, leftoverIndex);
    TaskTrackerUtils.showModal(modal);
  }

  _render() {
    const username = this._getCurrentUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerUtils.getCommonCardStyles()}
        .leftover-item.fresh {
          border-left: 2px solid #4caf50;
        }

        .leftover-item.warning {
          border-left: 2px solid #ff9800;
        }

        .leftover-item.expired {
          border-left: 2px solid #f44336;
        }
      </style>

      <div class="card">
        <div class="header">
          <h3 class="title">Leftovers</h3>
          <button class="refresh-btn" title="Refresh leftovers">
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>
          ${this._refreshing ? '<div class="refreshing-indicator"></div>' : ''}
        </div>

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
      refreshBtn.addEventListener('click', () => this._fetchLeftovers());
    }

    if (hasValidUserConfig) {
      // Leftover item click handlers
      const leftoverItems = this.shadowRoot.querySelectorAll('.leftover-item');
      leftoverItems.forEach((item, index) => {
        item.addEventListener('click', () => {
          if (this._leftovers[index]) {
            this._showLeftoverModal(this._leftovers[index], index);
          }
        });
      });

      // Dispose button click handlers
      const disposeButtons = this.shadowRoot.querySelectorAll('.dispose-btn');
      disposeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling to parent leftover item
          const leftoverIndex = parseInt(button.dataset.leftoverIndex, 10);
          if (this._leftovers[leftoverIndex]) {
            this._disposeLeftover(this._leftovers[leftoverIndex], '');
          }
        });
      });
    }
  }

  _renderContent() {
    // Only show loading state on initial load
    if (this._loading && this._initialLoad) {
      return '<div class="loading">Loading leftovers...</div>';
    }

    if (this._error) {
      return `<div class="error">${this._error}</div>`;
    }

    if (!this._leftovers || this._leftovers.length === 0) {
      return '<div class="no-leftovers">No leftovers found</div>';
    }

    let content = '';

    if (this._config.categorize_by_safety) {
      const { good, expired } = this._categorizeLeftoversByStatus(this._leftovers);
      if (expired.length > 0) {
        content += `
          <div class="category category-expired">
            <div class="category-title">Expired</div>
            ${expired.map((leftover, index) => this._renderLeftoverItem(leftover, this._leftovers.indexOf(leftover), true)).join('')}
          </div>
        `;
      }

      if (good.length > 0) {
        content += `
          <div class="category category-good">
            <div class="category-title">Good</div>
            ${good.map((leftover, index) => this._renderLeftoverItem(leftover, this._leftovers.indexOf(leftover), false)).join('')}
          </div>
        `;
      }
    } else {
      // Show all leftovers without categorization
      content = this._leftovers.map((leftover, index) => this._renderLeftoverItem(leftover, index, false)).join('');
    }

    return content;
  }

  _renderLeftoverItem(leftover, originalIndex, isExpired) {
    const age = this._formatAge(leftover.created_at);
    const expirationStatus = this._formatExpirationStatus(leftover);

    // Build metadata line with pipes
    const metadataParts = [];
    if (this._config.show_age) metadataParts.push(`${age} old`);
    metadataParts.push(expirationStatus);

    return `
      <div class="task-item leftover-item ${isExpired ? 'expired' : 'fresh'}">
        <div class="task-content leftover-content">
          <div class="task-name leftover-name">${leftover.name}</div>
          <div class="task-metadata leftover-metadata">${metadataParts.join(' | ')}</div>
        </div>
        ${this._config.show_disposal_actions ? `
          <div class="task-actions leftover-actions">
            <button class="dispose-btn" data-leftover-index="${originalIndex}">
              Dispose
            </button>
          </div>
        ` : ''}
      </div>
    `;
  }

  getCardSize() {
    return Math.min(4, Math.max(1, Math.ceil(this._leftovers.length / 5)));
  }
}

class TaskTrackerLeftoversCardEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
    this._debounceTimers = {};
  }

  setConfig(config) {
    this._config = { ...TaskTrackerLeftoversCard.getStubConfig(), ...config };
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
      'Show Expired',
      'Display expired leftovers in the list',
      TaskTrackerUtils.createCheckboxInput(this._config.show_expired, 'show_expired')
    )}

        ${TaskTrackerUtils.createConfigRow(
      'Show Disposal Notes',
      'Display disposal notes field in modal',
      TaskTrackerUtils.createCheckboxInput(this._config.show_disposal_notes, 'show_disposal_notes')
    )}

        <div class="section-title">User Settings</div>

        ${TaskTrackerUtils.createConfigRow(
      'User Filter Mode',
      'How to determine the user for leftovers',
      TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
        { value: 'all', label: 'All Users' },
        { value: 'current', label: 'Current User' },
        { value: 'explicit', label: 'Specific User' }
      ])
    )}

        ${this._config.user_filter_mode === 'explicit' ? TaskTrackerUtils.createConfigRow(
      'Username',
      'Specific username for leftover management',
      TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
    ) : ''}

        <div class="section-title">Behavior Settings</div>

        ${TaskTrackerUtils.createConfigRow(
      'Refresh Interval (seconds)',
      'How often to automatically refresh leftover data',
      TaskTrackerUtils.createNumberInput(this._config.refresh_interval, 'refresh_interval', 10, 3600, 10)
    )}
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
    TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
  }

  _updateConfig(configKey, value) {
    // Update config
    this._config = {
      ...this._config,
      [configKey]: value
    };

    this.configChanged(this._config);
  }
}

if (!customElements.get('tasktracker-leftovers-card')) {
  customElements.define('tasktracker-leftovers-card', TaskTrackerLeftoversCard);
}
if (!customElements.get('tasktracker-leftovers-card-editor')) {
  customElements.define('tasktracker-leftovers-card-editor', TaskTrackerLeftoversCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === 'tasktracker-leftovers-card')) {
  window.customCards.push({
    type: 'tasktracker-leftovers-card',
    name: 'TaskTracker Leftovers',
    description: 'Display and manage leftover food items with expiration tracking',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}