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
  }

  static getConfigElement() {
    return document.createElement('tasktracker-leftovers-card-editor');
  }

  static getStubConfig() {
    return {
      categorize_by_safety: true,
      show_disposal_actions: true,
      refresh_interval: 60,
      max_items: 20,
      show_age: true
    };
  }

  setConfig(config) {
    this._config = {
      categorize_by_safety: config.categorize_by_safety !== false,
      show_disposal_actions: config.show_disposal_actions !== false,
      refresh_interval: config.refresh_interval || 60, // seconds
      max_items: config.max_items || 20,
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

    this._refreshInterval = setInterval(() => {
      this._fetchLeftovers();
    }, this._config.refresh_interval * 1000);
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
      if (response && response.response) {
        newLeftovers = (response.response.leftovers || []).slice(0, this._config.max_items);
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
    if (leftovers1.length !== leftovers2.length) return false;

    for (let i = 0; i < leftovers1.length; i++) {
      const l1 = leftovers1[i];
      const l2 = leftovers2[i];

      if (l1.name !== l2.name ||
        l1.created_at !== l2.created_at ||
        l1.due_date !== l2.due_date) {
        return false;
      }
    }

    return true;
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

  async _disposeLeftover(leftover) {
    try {
      await this._hass.callService('tasktracker', 'complete_task_by_name', {
        name: leftover.name,
        notes: `Disposed via leftovers card`
      });

      this._showSuccess(`Leftover "${leftover.name}" disposed successfully`);

      // Refresh leftovers after disposal
      setTimeout(() => {
        this._fetchLeftovers();
      }, 1000);

    } catch (error) {
      console.error('Failed to dispose leftover:', error);
      this._showError(`Failed to dispose leftover: ${error.message}`);
    }
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
    const { good, expired } = this._config.categorize_by_safety
      ? this._categorizeLeftoversByStatus(this._leftovers)
      : { good: [], expired: this._leftovers };

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

        .loading, .error, .no-leftovers {
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

        .no-leftovers {
          color: var(--secondary-text-color);
        }

        .category {
          margin-bottom: 16px;
        }

        .category:last-child {
          margin-bottom: 0;
        }

        .category-title {
          font-size: 0.9em;
          font-weight: 600;
          margin-bottom: 8px;
          padding-bottom: 4px;
          border-bottom: 1px solid var(--divider-color);
          color: var(--primary-text-color);
          letter-spacing: 0.5px;
        }

        .leftover-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 4px;
          background: var(--secondary-background-color);
          border-radius: 4px;
          border-left: 2px solid var(--divider-color);
        }

        .leftover-item:hover {
          background: var(--divider-color);
        }

        .leftover-item:last-child {
          margin-bottom: 0;
        }

        .leftover-item.expired {
          border-left-color: var(--error-color);
        }

        .leftover-content {
          flex: 1;
          min-width: 0;
        }

        .leftover-name {
          font-weight: 500;
          color: var(--primary-text-color);
          font-size: 0.95em;
          margin-bottom: 2px;
          word-wrap: break-word;
        }

        .leftover-metadata {
          font-size: 0.8em;
          color: var(--secondary-text-color);
        }

        .leftover-actions {
          display: flex;
          gap: 8px;
          margin-left: 12px;
        }

        .dispose-btn {
          background: transparent;
          color: var(--secondary-text-color);
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          padding: 6px 10px;
          font-size: 0.8em;
          cursor: pointer;
          min-width: 44px;
          min-height: 32px;
        }

        .dispose-btn:hover {
          background: var(--secondary-background-color);
          border-color: var(--primary-text-color);
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
          <h3 class="title">Leftovers</h3>
          <button class="refresh-btn" title="Refresh leftovers">
            <ha-icon icon="mdi:refresh"></ha-icon>
          </button>
          ${this._refreshing ? '<div class="refreshing-indicator"></div>' : ''}
        </div>

        ${this._renderContent(good, expired)}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this._fetchLeftovers());
    }

    // Dispose button event listeners
    const disposeBtns = this.shadowRoot.querySelectorAll('.dispose-btn');
    disposeBtns.forEach((btn, index) => {
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        const leftoverIndex = parseInt(btn.dataset.leftoverIndex);
        const leftover = this._leftovers[leftoverIndex];
        if (leftover) {
          this._disposeLeftover(leftover);
        }
      });
    });
  }

  _renderContent(good, expired) {
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
      <div class="leftover-item ${isExpired ? 'expired' : 'good'}">
        <div class="leftover-content">
          <div class="leftover-name">${leftover.name}</div>
          <div class="leftover-metadata">${metadataParts.join(' | ')}</div>
        </div>
        ${this._config.show_disposal_actions ? `
          <div class="leftover-actions">
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
    this._debounceTimers = {}; // Store debounce timers for different fields
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
            Maximum Items
            <div class="config-description">Maximum number of leftovers to display</div>
          </label>
          <input
            type="number"
            min="5"
            max="100"
            value="${this._config.max_items}"
            data-config-key="max_items"
          />
        </div>

        <div class="config-row">
          <label>
            Categorize by Safety
            <div class="config-description">Separate good and expired leftovers</div>
          </label>
          <input
            type="checkbox"
            ${this._config.categorize_by_safety ? 'checked' : ''}
            data-config-key="categorize_by_safety"
          />
        </div>

        <div class="config-row">
          <label>
            Show Age
            <div class="config-description">Display how long leftovers have been stored</div>
          </label>
          <input
            type="checkbox"
            ${this._config.show_age ? 'checked' : ''}
            data-config-key="show_age"
          />
        </div>

        <div class="config-row">
          <label>
            Show Disposal Actions
            <div class="config-description">Display quick disposal buttons for leftovers</div>
          </label>
          <input
            type="checkbox"
            ${this._config.show_disposal_actions ? 'checked' : ''}
            data-config-key="show_disposal_actions"
          />
        </div>

        <div class="section-title">Behavior Settings</div>

        <div class="config-row">
          <label>
            Refresh Interval (seconds)
            <div class="config-description">How often to automatically refresh leftover data</div>
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

    this.configChanged(this._config);
  }
}

customElements.define('tasktracker-leftovers-card', TaskTrackerLeftoversCard);
customElements.define('tasktracker-leftovers-card-editor', TaskTrackerLeftoversCardEditor);

window.customCards = window.customCards || [];
window.customCards.push({
  type: 'tasktracker-leftovers-card',
  name: 'TaskTracker Leftovers',
  description: 'Display and manage leftover food items with expiration tracking',
  preview: true,
  documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
});