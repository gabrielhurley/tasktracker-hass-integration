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
    this._config = { ...this.getDefaultConfig(), ...config };
    this._render();
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
    this._render();
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
  onRefresh() { this.onAutoRefresh(); }

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
          ${showRefresh ? '<button class="refresh-btn" title="Refresh"><ha-icon icon="mdi:refresh"></ha-icon></button>' : ''}
          ${headerStatus}
        </div>
      </div>
    `;
  }

  _renderContent() { return ''; }

  _render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerStyles.getCommonCardStyles()}
      </style>
      <div class="card">
        ${this._renderHeader()}
        ${this._renderContent()}
      </div>
    `;

    const refreshBtn = this.shadowRoot.querySelector('.refresh-btn');
    if (refreshBtn) refreshBtn.addEventListener('click', () => this.onRefresh());

    if (typeof this._afterRender === 'function') this._afterRender();
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
