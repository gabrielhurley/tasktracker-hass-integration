import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';
import { TaskTrackerBaseCard } from './utils/base-card.js';
import { TaskTrackerBaseEditor } from './utils/base-config-editor.js';
import { TaskTrackerDateTime } from './utils/datetime-utils.js';

/**
 * TaskTracker Leftovers Card
 *
 * A custom Lovelace card for managing leftover food items:
 * - Shows good and expired leftovers
 * - Visual emphasis for expired items
 * - Quick disposal actions
 * - Real-time API integration for leftover management
 */

class TaskTrackerLeftoversCard extends TaskTrackerBaseCard {
  constructor() {
    super();
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
    super.hass = hass;
  }
  onHassFirstRun() { this._fetchLeftovers(); this._setupEventListeners(); }

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

  onAutoRefresh() { this._fetchLeftovers(); }
  onRefresh() { this._fetchLeftovers(); }

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

  async _fetchLeftovers() {
    // Fetch available users if not already loaded
    if (!this._availableUsers || this._availableUsers.length === 0 ||
        !this._enhancedUsers || this._enhancedUsers.length === 0) {
      await this._fetchAvailableUsers();
    }

    // Validate current user configuration before making API calls
    const userValidation = TaskTrackerUtils.validateCurrentUser(this._config, this._hass, this._enhancedUsers);

    if (!userValidation.canMakeRequests) {
      this._error = userValidation.error;
      this._leftovers = [];
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
      const params = {};

      if (userValidation.username) {
        params.assigned_to = userValidation.username;
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
      // Use API-provided overdue status when available (most reliable)
      if (leftover.is_overdue !== undefined) {
        if (leftover.is_overdue) {
          expired.push(leftover);
        } else {
          good.push(leftover);
        }
      } else if (leftover.due_date) {
        // Fallback to frontend calculation if API doesn't provide is_overdue
        const daysOverdue = this._userContext
          ? TaskTrackerDateTime.calculateDaysOverdue(leftover.due_date, this._userContext)
          : TaskTrackerDateTime.calculateDaysOverdue(leftover.due_date, null);

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
    const cleanups = [];
    cleanups.push(
      TaskTrackerUtils.setupLeftoverDisposalListener(this._hass, () => setTimeout(() => this._fetchLeftovers(), 500))
    );
    cleanups.push(
      TaskTrackerUtils.setupLeftoverCreationListener(this._hass, () => setTimeout(() => this._fetchLeftovers(), 500))
    );
    cleanups.push(
      TaskTrackerUtils.setupTaskCompletionListener(this._hass, () => setTimeout(() => this._fetchLeftovers(), 500))
    );
    this.setEventCleanups(cleanups);
  }

  async _disposeLeftover(leftover, notes) {
    // Fetch available users if not already loaded
    if (!this._availableUsers || this._availableUsers.length === 0 ||
        !this._enhancedUsers || this._enhancedUsers.length === 0) {
      await this._fetchAvailableUsers();
    }

    // Validate current user configuration before making API calls
    const userValidation = TaskTrackerUtils.validateCurrentUser(this._config, this._hass, this._enhancedUsers);

    if (!userValidation.canMakeRequests) {
      TaskTrackerUtils.showError(userValidation.error);
      return;
    }

    try {
      const response = await TaskTrackerUtils.disposeLeftover(this._hass, leftover.name, userValidation.username, notes);

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

    // Use the centralized formatDueDate utility for consistency with other cards
    return TaskTrackerUtils.formatDueDate(leftover.due_date, this._userContext, leftover);
  }



  _render() {
    const username = this._getCurrentUsername();
    const hasValidUserConfig = TaskTrackerUtils.hasValidUserConfig(this._config);

    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerStyles.getCommonCardStyles()}
      </style>

      <div class="card">
        ${this._renderHeader()}

        ${!hasValidUserConfig ? `
          <div class="no-user-warning">
            No user configured. Please set user in card configuration.
          </div>
        ` : this._renderContent()}
      </div>
    `;

    // Add event listeners
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this._fetchLeftovers());

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

  // Base header integration
  getCardTitle() { return 'Leftovers'; }
  getHeaderStatusHTML() { return this._refreshing ? '<div class="refreshing-indicator"></div>' : ''; }

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

    // Use the same border styling logic as other cards - prioritize API data
    // If API provides is_overdue and days_overdue, use those directly
    // Otherwise fall back to frontend calculation
    let borderInfo;
    if (leftover.is_overdue !== undefined || leftover.days_overdue !== undefined) {
      // API-provided data - use it directly with getTaskBorderStyle
      borderInfo = TaskTrackerUtils.getTaskBorderStyle(leftover, 'task', leftover.days_overdue || 0);
    } else {
      // Fallback to frontend calculation for border styling
      const dueDate = leftover.due_date || leftover.expiration_date;
      const daysOverdue = dueDate && this._userContext
        ? TaskTrackerDateTime.calculateDaysOverdue(dueDate, this._userContext)
        : 0;
      borderInfo = TaskTrackerUtils.getTaskBorderStyle(leftover, 'task', daysOverdue);
    }

    const taskClasses = [
      'task-item',
      'leftover-item',
      borderInfo.cssClasses.needsCompletion ? 'needs-completion' : '',
      borderInfo.cssClasses.overdue ? 'overdue' : '',
      borderInfo.cssClasses.dueToday ? 'due-today' : ''
    ].filter(Boolean).join(' ');

    const borderClass = borderInfo.borderClass || '';
    const borderStyle = borderInfo.borderStyle || '';

    return `
      <div class="${[taskClasses, borderClass].filter(Boolean).join(' ')}" ${borderStyle ? `style="${borderStyle}"` : ''}>
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

class TaskTrackerLeftoversCardEditor extends TaskTrackerBaseEditor {
  constructor() {
    super();
    this._debounceTimers = {};
  }

  getDefaultConfig() { return { ...TaskTrackerLeftoversCard.getStubConfig() }; }

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
      if (input.type === 'text' || input.type === 'number') input.addEventListener('input', this._valueChanged.bind(this));
    });
  }

  _updateConfig(configKey, value) { super._updateConfig(configKey, value); }
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