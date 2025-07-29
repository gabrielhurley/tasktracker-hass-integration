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
    this._userContext = null;
    this._availableUsers = [];
    this._loading = false;
    this._initialLoad = true;
    this._refreshing = false;
    this._error = null;
    this._refreshInterval = null;
    this._default_refresh_interval = 300;
    this._default_max_items = 20;
    this._eventCleanup = null; // Store event listener cleanup function
    this._default_user_filter_mode = 'all';
  }

  static getConfigElement() {
    return document.createElement('tasktracker-leftovers-card-editor');
  }

  static getStubConfig() {
    return {
      categorize_by_safety: true,
      show_disposal_actions: true,
      show_disposal_notes: true,
      show_header: true,
      refresh_interval: this._default_refresh_interval,
      max_items: this._default_max_items,
      show_age: true,
      user_filter_mode: 'all',
      explicit_user: null
    };
  }

  setConfig(config) {
    this._config = {
      categorize_by_safety: config.categorize_by_safety !== false,
      show_disposal_actions: config.show_disposal_actions !== false,
      show_disposal_notes: config.show_disposal_notes !== false,
      show_header: config.show_header !== false,
      refresh_interval: config.refresh_interval || this._default_refresh_interval, // seconds
      max_items: config.max_items || this._default_max_items,
      show_age: config.show_age !== false,
      user_filter_mode: config.user_filter_mode || 'all',
      explicit_user: config.explicit_user || null,
      ...config
    };

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
      this._fetchLeftovers();
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
      this._fetchLeftovers();
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
      this._availableUsers = [];
    }
  }

  async _fetchLeftovers() {
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
      const params = {};

      const username = this._getCurrentUsername();
      if (username) {
        params.assigned_to = username;
      }

      const response = await this._hass.callService('tasktracker', 'list_leftovers', params, {}, true, true);

      let newLeftovers = [];
      if (response && response.response && response.response.data && response.response.data.items) {
        newLeftovers = response.response.data.items.slice(0, this._config.max_items);
        // Capture user context from API response for timezone-aware formatting
        this._userContext = response.response.data.user_context || null;
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
    const good = [];
    const expired = [];

    leftovers.forEach(leftover => {
      if (leftover.due_date) {
        // Use timezone-aware calculation when user context is available
        const daysOverdue = this._userContext
          ? TaskTrackerUtils.calculateLogicalDaysOverdue(leftover.due_date, this._userContext)
          : TaskTrackerUtils.calculateDaysOverdue(leftover.due_date);

        if (daysOverdue > 0) {
          expired.push(leftover);
        } else {
          good.push(leftover);
        }
      } else {
        // If no due date, assume it's good for now
        good.push(leftover);
      }
    });

    return { good, expired };
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

    // Set up listeners for leftover disposals, leftover creations, and task completions
    // (task completions needed because voice commands for leftover disposal fire task_completed events)
    const disposalCleanup = TaskTrackerUtils.setupLeftoverDisposalListener(
      this._hass,
      (eventData) => {
        // For leftovers, refresh when any leftover is disposed
        setTimeout(() => {
          this._fetchLeftovers();
        }, 500);
      }
    );

    const creationCleanup = TaskTrackerUtils.setupLeftoverCreationListener(
      this._hass,
      (eventData) => {
        // Refresh when any leftover is created
        setTimeout(() => {
          this._fetchLeftovers();
        }, 500);
      }
    );

    const taskCompletionCleanup = TaskTrackerUtils.setupTaskCompletionListener(
      this._hass,
      (eventData) => {
        // Refresh for task completions (covers voice commands for leftover disposal)
        setTimeout(() => {
          this._fetchLeftovers();
        }, 500);
      }
    );

    // Combined cleanup function
    this._eventCleanup = async () => {
      await Promise.all([
        disposalCleanup().catch(err => err.code !== 'not_found' && console.warn('Disposal cleanup error:', err)),
        creationCleanup().catch(err => err.code !== 'not_found' && console.warn('Creation cleanup error:', err)),
        taskCompletionCleanup().catch(err => err.code !== 'not_found' && console.warn('Task completion cleanup error:', err))
      ]);
    };
  }

  async _disposeLeftover(leftover, notes) {
    // Fetch available users if not already loaded and we're in current user mode
    if (this._config.user_filter_mode === 'current' && this._availableUsers.length === 0) {
      await this._fetchAvailableUsers();
    }

    const username = TaskTrackerUtils.getUsernameForAction(this._config, this._hass, this._availableUsers);

    // For 'current' user mode, username will be null and that's expected
    // The backend will handle user mapping via call context
    if (username === null && this._config.user_filter_mode !== 'current' && this._config.user_filter_mode !== 'all') {
      TaskTrackerUtils.showError('No user configured for leftover disposal');
      return;
    }

    try {
      const response = await TaskTrackerUtils.disposeLeftover(this._hass, leftover.name, username, notes);

      if (response && response.success) {
        TaskTrackerUtils.showSuccess(response.spoken_response || `Leftover "${leftover.name}" disposed successfully`);
      } else {
        const errorMsg = (response && response.message) || 'Unknown error';
        TaskTrackerUtils.showError(`Failed to dispose leftover: ${errorMsg}`);
      }

      // Refresh leftovers after disposal
      setTimeout(() => {
        this._fetchLeftovers();
      }, 100);

    } catch (error) {
      console.error('Failed to dispose leftover:', error);
      TaskTrackerUtils.showError(`Failed to dispose leftover: ${error.message}`);
    }
  }

  _formatExpirationDate(expirationDateString, leftover = null) {
    return TaskTrackerUtils.formatDueDate(expirationDateString, this._userContext, leftover);
  }

  _formatAge(createdAt) {
    if (this._userContext) {
      // Use timezone-aware formatting when user context is available
      return TaskTrackerUtils.formatDateTime(createdAt, this._userContext);
    }

    // Fallback to browser timezone calculation
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

    if (this._userContext) {
      // Use timezone-aware calculation when user context is available
      return TaskTrackerUtils.formatDueDate(leftover.due_date, this._userContext, leftover);
    }

    // Fallback to browser timezone calculation
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
        ${this._config.show_header ? `
          <div class="header">
            <h3 class="title">Leftovers</h3>
            <button class="refresh-btn" title="Refresh leftovers">
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
      refreshBtn.addEventListener('click', () => this._fetchLeftovers());
    }

    if (hasValidUserConfig) {
      // Dispose button click handlers
      const disposeButtons = this.shadowRoot.querySelectorAll('.dispose-btn');
      disposeButtons.forEach(button => {
        button.addEventListener('click', (e) => {
          e.stopPropagation(); // Prevent event bubbling if needed
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

        ${TaskTrackerUtils.createConfigRow(
          'Show Disposal Notes',
          'Display disposal notes field in modal',
          TaskTrackerUtils.createCheckboxInput(this._config.show_disposal_notes, 'show_disposal_notes')
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Show Header',
          'Display card header with title and refresh button',
          TaskTrackerUtils.createCheckboxInput(this._config.show_header, 'show_header')
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