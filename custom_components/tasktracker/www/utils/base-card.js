import { TaskTrackerStyles } from './styles.js';
import { TaskTrackerUtils } from '../tasktracker-utils.js';

/**
 * TaskTrackerBaseCard
 *
 * Base class for all TaskTracker Lovelace cards.
 * - Handles shadow DOM setup, config merge, header rendering, refresh wiring
 * - Provides auto-refresh helpers and unified lifecycle cleanup
 */
export class TaskTrackerBaseCard extends HTMLElement {
  constructor() {
    super();
    if (!this.shadowRoot) {
      this.attachShadow({ mode: 'open' });
    }
    this._config = {};
    this._hass = null;
    this._loading = false;
    this._error = null;
    this._refreshInterval = null;
    this._eventCleanup = null;
    this._structureRendered = false; // Track if structure has been rendered to prevent double-rendering
    this._refreshing = false; // Track if refresh is in progress
  }

  // Subclasses should override to provide defaults
  static getStubConfig() {
    return { show_header: true, refresh_interval: 300 };
  }

  // Instance-level default config (can be overridden by subclasses)
  getDefaultConfig() {
    return this.constructor.getStubConfig?.() || TaskTrackerBaseCard.getStubConfig();
  }

  setConfig(config) {
    const oldConfig = this._config;
    this._config = { ...this.getDefaultConfig(), ...config };

    // Check if config changes affect the header structure
    if (this._shouldResetStructure && this._shouldResetStructure(oldConfig, this._config)) {
      this._structureRendered = false;
    }

    this._renderStructure();
  }

  set hass(hass) {
    const firstRun = this._hass === null;
    this._hass = hass;
    if (firstRun && hass) {
      this._setupAutoRefreshHelper(() => this.onAutoRefresh(), this._config.refresh_interval);
      // Allow subclasses to run initial data fetch
      if (typeof this.onHassFirstRun === 'function') {
        this.onHassFirstRun();
      }
      // Allow subclasses to register listeners
      if (typeof this._setupEventListeners === 'function') {
        this._setupEventListeners();
      }
    }
  }

  connectedCallback() {
    this._renderStructure();
  }

  disconnectedCallback() {
    if (this._refreshInterval) {
      clearInterval(this._refreshInterval);
      this._refreshInterval = null;
    }
    if (this._eventCleanup) {
      this._eventCleanup().catch(() => {});
      this._eventCleanup = null;
    }
  }

  // Subclasses can override for periodic refresh
  onAutoRefresh() {}

  // Subclasses can override for header action
  async onRefresh() {
    if (this._refreshing) return; // Prevent multiple simultaneous refreshes

    try {
      this._refreshing = true;
      this._updateRefreshButtonState(true);

      // Invalidate cache first (5th param = returnResponse)
      await this._hass.callService('tasktracker', 'invalidate_cache', {}, {}, true, true);

      // Then fetch fresh data
      await this.onAutoRefresh();

      // Show success feedback
      TaskTrackerUtils.showSuccess('Data refreshed');
    } catch (error) {
      console.error('Refresh failed:', error);
      TaskTrackerUtils.showError('Refresh failed');
    } finally {
      this._refreshing = false;
      this._updateRefreshButtonState(false);
    }
  }

  _setupAutoRefreshHelper(callback, intervalSeconds) {
    if (!intervalSeconds) return;
    if (this._refreshInterval) clearInterval(this._refreshInterval);
    this._refreshInterval = TaskTrackerUtils.setupAutoRefresh(callback, intervalSeconds);
  }

  _renderHeader() {
    if (!this._config.show_header) return '';
    const title = this.getCardTitle?.() || '';
    const headerActions = this.getHeaderActions?.() || '';
    const headerStatus = this.getHeaderStatusHTML?.() || '';
    const showRefresh = this.showRefreshButton ? this.showRefreshButton() : true;
    return `
      <div class="header">
        <h3 class="title">${title}</h3>
        <div class="header-actions">
          ${headerActions}
          ${showRefresh ? '<button class="refresh-btn" title="Refresh"><ha-icon icon="mdi:refresh"></ha-icon><ha-icon class="refresh-spinner" icon="mdi:loading"></ha-icon></button>' : ''}
          ${headerStatus}
        </div>
      </div>
    `;
  }

  _renderContent() { return ''; }

  /**
   * Render the card structure (header, shell) - called once on initialization
   * Subclasses can override this method to implement split rendering
   */
  _renderStructure() {
    if (!this.shadowRoot) return;

    // Only render structure if it hasn't been rendered yet
    if (!this._structureRendered) {
      this.shadowRoot.innerHTML = `
        <style>
          ${TaskTrackerStyles.getCommonCardStyles()}
          ${this.getCardStyles ? this.getCardStyles() : ''}
        </style>
        <div class="card">
          ${this._renderHeader()}
          <div class="content-container">
            ${this._renderContent()}
          </div>
        </div>
      `;

      // Attach header event listeners once - they will persist
      this._attachHeaderEventListeners();
      this._structureRendered = true;
    }
  }

  /**
   * Attach event listeners to header elements (called once during structure render)
   * Subclasses can override to add additional header event listeners
   */
  _attachHeaderEventListeners() {
    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', () => this.onRefresh());
    }
  }

  /**
   * Legacy _render method for backward compatibility
   * Cards using split rendering should override _renderStructure and _renderContent instead
   */
  _render() {
    this._renderStructure();
  }

  /**
   * Update a specific header button's appearance without re-rendering the entire header
   * @param {string} buttonSelector - CSS selector for the button (e.g., '.filter-toggle-btn')
   * @param {Object} updates - Object with properties to update: { classes: [], attributes: {}, icon: '', title: '' }
   */
  _updateHeaderButton(buttonSelector, updates) {
    const button = this.shadowRoot?.querySelector(buttonSelector);
    if (!button) return;

    // Update classes
    if (updates.classes) {
      updates.classes.forEach(({ className, add }) => {
        if (add) {
          button.classList.add(className);
        } else {
          button.classList.remove(className);
        }
      });
    }

    // Update attributes
    if (updates.attributes) {
      Object.entries(updates.attributes).forEach(([attr, value]) => {
        if (value !== null && value !== undefined) {
          button.setAttribute(attr, value);
        } else {
          button.removeAttribute(attr);
        }
      });
    }

    // Update icon
    if (updates.icon) {
      const icon = button.querySelector('ha-icon');
      if (icon) {
        icon.setAttribute('icon', updates.icon);
      }
    }

    // Update title
    if (updates.title) {
      button.title = updates.title;
    }
  }

  /**
   * Update the refresh button state (loading/idle)
   * @param {boolean} isRefreshing - Whether refresh is in progress
   */
  _updateRefreshButtonState(isRefreshing) {
    this._updateHeaderButton('.refresh-btn', {
      classes: [{ className: 'refreshing', add: isRefreshing }],
      attributes: { disabled: isRefreshing ? '' : null }
    });
  }

  // Aggregate and manage event listener cleanup functions
  setEventCleanups(cleanupFunctions) {
    // Cleanup any existing subscriptions first
    if (this._eventCleanup) {
      this._eventCleanup().catch(() => {});
    }
    this._eventCleanup = async () => {
      await Promise.all(
        (cleanupFunctions || []).map((fn) =>
          fn().catch((err) => err?.code !== 'not_found' && console.warn('Event cleanup error:', err))
        )
      );
    };
  }
}

export default TaskTrackerBaseCard;
