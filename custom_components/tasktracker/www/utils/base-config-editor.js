import { TaskTrackerUtils } from '../tasktracker-utils.js';

/**
 * TaskTrackerBaseEditor
 *
 * Shared base class for card config editors.
 * - Provides setConfig with default merge
 * - Handles hass assignment and config-changed event dispatch
 * - Centralizes value change handling using TaskTrackerUtils.handleConfigValueChange
 */
export class TaskTrackerBaseEditor extends HTMLElement {
  constructor() {
    super();
    this.attachShadow({ mode: 'open' });
    this._config = {};
    this._hass = null;
  }

  // Subclasses must override to provide defaults
  getDefaultConfig() { return {}; }

  setConfig(config) {
    this._config = { ...this.getDefaultConfig(), ...config };
    this._render?.();
  }

  set hass(hass) {
    this._hass = hass;
  }

  configChanged(newConfig) {
    const event = new Event('config-changed', { bubbles: true, composed: true });
    event.detail = { config: newConfig };
    this.dispatchEvent(event);
  }

  // Default input change handler using shared util
  _valueChanged(ev) {
    TaskTrackerUtils.handleConfigValueChange(ev, this, this._updateConfig.bind(this));
  }

  // Default config update implementation
  _updateConfig(configKey, value) {
    this._config = { ...this._config, [configKey]: value };
    this.configChanged(this._config);
  }
}

export default TaskTrackerBaseEditor;
