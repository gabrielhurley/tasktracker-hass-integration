/**
 * TaskTracker Shared Styles
 *
 * Centralized CSS classes for TaskTracker frontend components.
 * Provides global styles for elements that live outside card shadow roots
 * (e.g., modals appended to document.body) and reusable utility classes.
 */

export class TaskTrackerStyles {
  // DRY: shared button styles usable in both globals and shadow roots
  static getSharedButtonStyles() {
    return `
      .tt-btn, .btn {
        padding: 6px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--secondary-text-color);
        cursor: pointer;
        font-family: inherit;
        font-size: 0.9em;
        transition: background-color 0.2s ease, color 0.2s ease, opacity 0.2s ease;
      }
      .tt-btn:hover, .btn:hover { background: var(--divider-color); color: var(--primary-text-color); }
      .tt-btn:disabled, .btn:disabled { opacity: 0.6; cursor: not-allowed; }

      .tt-btn--primary, .btn--primary { border-color: var(--primary-color); color: var(--primary-text-color); }
      .tt-btn--primary:hover, .btn--primary:hover { background: var(--primary-color); color: var(--primary-text-color); }

      .tt-btn--error, .btn--error { border-color: var(--error-color, #f44336); color: var(--error-color, #f44336); background: transparent; }
      .tt-btn--error:hover, .btn--error:hover { background: var(--error-color, #f44336); color: white; }

      .tt-btn--link, .btn--ghost { background: transparent; border: none; color: var(--secondary-text-color); }
      .tt-btn--link:hover, .btn--ghost:hover { background: var(--divider-color); color: var(--primary-text-color); }
    `;
  }
  // Single source of truth for Daily State shared styles
  static getDailyStateSharedStyles() {
    return `
      .tt-ds-quick-flow { margin-bottom: 16px; }
      .tt-ds-quick-prompt { font-size: 16px; margin-bottom: 16px; color: var(--primary-text-color); text-align: center; }
      .tt-ds-preset-grid { display: grid; grid-template-columns: repeat(2, 1fr); gap: 8px; margin-bottom: 16px; }
      @media (min-width: 500px) { .tt-ds-preset-grid { grid-template-columns: repeat(4, 1fr); } }
      .tt-ds-preset-btn {
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
      .tt-ds-label { margin-bottom: 16px; font-weight: 500; }
      .tt-ds-label > .tt-checkbox { vertical-align: middle; }
      .tt-ds-preset-btn:hover, .tt-ds-preset-btn.tt-selected { border-color: var(--primary-color); background: var(--primary-color); color: var(--primary-text-color); }
      .tt-ds-preset-btn:disabled { opacity: 0.6; cursor: not-allowed; }
      .tt-ds-advanced { margin-top: 16px; border-top: 1px solid var(--divider-color); padding-top: 16px; }
      .tt-ds-advanced > .tt-ds-button-row { margin-top: 0; }
      .tt-ds-slider-row { display: grid; grid-template-columns: 100px 1fr 60px; align-items: center; gap: 12px; margin-bottom: 12px; }
      .tt-ds-slider-label { font-weight: 500; color: var(--primary-text-color); }
      .tt-ds-slider-container { position: relative; flex: 1; width: 100%; display: flex; }
      .tt-ds-range { width: 100%; height: 18px; background: transparent; outline: none; -webkit-appearance: none; }
      .tt-ds-range::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--divider-color); }
      .tt-ds-range::-moz-range-track { height: 4px; border-radius: 2px; background: var(--divider-color); }
      .tt-ds-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: var(--primary-color); cursor: pointer; margin-top: -7px; }
      .tt-ds-range::-moz-range-thumb { width: 18px; height: 18px; border-radius: 50%; background: var(--primary-color); cursor: pointer; border: none; }
      .tt-ds-slider-value { text-align: center; font-weight: 500; min-width: 80px; color: var(--primary-text-color); }
      .tt-ds-button-row { display: flex; justify-content: space-between; align-items: center; margin-top: 20px; }
      .back-to-simple { margin-bottom: 16px; }
    `;
  }
  /**
   * Shared utilities and component styles used across both the main DOM and card shadow roots.
   * Use this as the single source of truth to avoid drift between ensureGlobal() and card styles.
   */
  static getSharedUtilitiesStyles() {
    return `
      /* Buttons */
      ${TaskTrackerStyles.getSharedButtonStyles()}

      /* Generic button variants not covered above */
      .btn--icon { padding: 6px; display: inline-flex; align-items: center; justify-content: center; }
      .btn--block { width: 100%; }

      /* Inputs */
      .tt-input, .tt-select, .tt-textarea {
        width: 100%;
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-family: inherit;
        font-size: 14px;
        box-sizing: border-box;
      }
      .tt-input:focus, .tt-select:focus, .tt-textarea:focus {
        outline: none;
        border-color: var(--primary-color);
        box-shadow: 0 0 0 1px var(--primary-color);
      }
      .tt-textarea { min-height: 80px; resize: vertical; }

      /* Containers and sections */
      .tt-section { margin-bottom: 16px; }
      .tt-section--muted { background: var(--secondary-background-color); border-radius: 8px; padding: 16px; border-left: 4px solid var(--primary-color); }
      .tt-section--warning { border-left-color: var(--warning-color); }

      /* Form containers */
      .tt-form { display: grid; gap: 16px; }
      .tt-form ~ .tt-section { margin-top: 16px; }
      .tt-box { border: 1px solid var(--divider-color); border-radius: 6px; padding: 16px; background: var(--secondary-background-color); margin-bottom: 16px; }
      .tt-box-sm { background: transparent; margin-bottom: 0; }
      .tt-box-title { margin: 0 0 12px 0; color: var(--primary-text-color); font-size: 14px; font-weight: 600; }
      .tt-multiselect { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 8px; padding: 8px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); }
      .tt-checkbox { width: auto; margin-right: 8px; }
      .tt-form-row { display: flex; flex-direction: column; gap: 4px; }
      /* Ensure checkboxes in form rows are left-aligned */
      .tt-form-row .tt-checkbox,
      .tt-form-row input[type="checkbox"] { align-self: flex-start; }
      /* Avoid extra spacing inside form rows where row gap manages spacing */
      .tt-form-row .tt-label { margin-bottom: 0; }
      .tt-label { display: block; font-size: 0.85em; color: var(--secondary-text-color); font-weight: 500; margin-bottom: 4px; }

      /* Layout utilities */
      .tt-hidden { display: none !important; }
      .tt-col-span-full { grid-column: 1 / -1; }
      .tt-grid-2 { display: grid; grid-template-columns: 1fr 1fr; }
      .tt-grid-auto { display: grid; gap: 12px; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); }
      .tt-gap-12 { gap: 12px; }
      .tt-gap-16 { gap: 16px; }
      .tt-gap-4 { gap: 4px; }
      .tt-gap-8 { gap: 8px; }
      .tt-mb-12 { margin-bottom: 12px; }
      .tt-mb-16 { margin-bottom: 16px; }
      .tt-mb-20 { margin-bottom: 20px; }
      .tt-mt-12 { margin-top: 12px; }
      .tt-mt-24 { margin-top: 24px; }
      .tt-flex-end { display: flex; justify-content: flex-end !important; align-items: center; }
      .tt-flex-row { display: flex; align-items: center; }
      .tt-flex-1 { flex: 1; }
      .tt-text-center { text-align: center; }
      .tt-text-muted { color: var(--secondary-text-color); }
      .tt-p-40 { padding: 40px; }
      .tt-justify-between { display: flex; justify-content: space-between; align-items: center; }
      .tt-title--sm { font-size: 1em; margin-top: 0; }

      /* Task items (unify tt-task-item and task-item) */
      .task-item, .tt-task-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 8px 12px;
        margin-bottom: 4px;
        background: var(--secondary-background-color);
        border-radius: 4px;
        border-left: 2px solid var(--secondary-text-color);
        cursor: pointer;
      }
      .tt-task-border--due, .task-item.due-today, .tt-task-item.due-today { border-left: 2px solid var(--primary-color) !important; }
      .tt-task-border--overdue, .task-item.overdue, .tt-task-item.overdue { border-left: 2px solid var(--warning-color, #ffc107) !important; }
      .tt-task-border--overdue-custom { }
      .task-item.completed, .tt-task-item.completed { border-left: 2px solid var(--success-color); }
      .task-item:hover, .tt-task-item:hover { background: var(--divider-color); }
      .task-item:last-child, .tt-task-item:last-child { margin-bottom: 0; }
      .task-content { flex: 1; min-width: 0; }
      .task-name { font-weight: 500; color: var(--primary-text-color); font-size: 0.95em; margin-bottom: 2px; word-wrap: break-word; display: flex; align-items: center; gap: 8px; }
      .completion-indicator { width: 6px; height: 6px; background: var(--primary-color); border-radius: 50%; flex-shrink: 0; }
      .task-metadata { font-size: 0.8em; color: var(--secondary-text-color); }

      /* Inline task action buttons */
      .task-item .complete-btn,
      .task-item .dispose-btn {
        background: transparent;
        border: none;
        color: var(--secondary-text-color);
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
        transition: background-color 0.2s ease;
      }
      .task-item .complete-btn:hover,
      .task-item .dispose-btn:hover {
        background: var(--divider-color);
        color: var(--primary-text-color);
      }

      /* Self-care windows */
      .windows-container { margin-top: 8px; display: flex; flex-direction: column; gap: 4px; }
      .window-item { display: flex; align-items: center; gap: 8px; padding: 4px 8px; border-radius: 4px; font-size: 0.9em; transition: background-color 0.2s ease; }
      .window-item.completed { background: rgba(76,175,80,0.15); color: var(--primary-text-color); }
      .window-item.inferred-complete { background: rgba(76,175,80,0.08); color: var(--primary-text-color); border-left: 2px solid rgba(76,175,80,0.3); }
      .window-item.incomplete { background: var(--secondary-background-color, rgba(0,0,0,0.05)); color: var(--primary-text-color); cursor: pointer; }
      .window-item.incomplete:hover { background: var(--divider-color, rgba(0,0,0,0.1)); }
      .window-item.incomplete:focus { outline: 2px solid var(--primary-color); outline-offset: 2px; background: var(--divider-color, rgba(0,0,0,0.1)); }
      .needs-completion.due-today .window-item.incomplete { background: rgba(3,169,244,0.1); }
      .needs-completion.due-today .window-item.incomplete:hover,
      .needs-completion.due-today .window-item.incomplete:focus { background: rgba(3,169,244,0.2); }
      .needs-completion.overdue .window-item.incomplete { background: rgba(255,193,7,0.1); }
      .needs-completion.overdue .window-item.incomplete:hover,
      .needs-completion.overdue .window-item.incomplete:focus { background: rgba(255,193,7,0.2); }
      .window-item.incomplete.overdue { background: rgba(255,193,7,0.1); }
      .window-item.incomplete.overdue:hover,
      .window-item.incomplete.overdue:focus { background: rgba(255,193,7,0.2); }
      .window-opportunity { color: var(--secondary-text-color); font-size: 1em; display: flex; align-items: center; }
      .window-opportunity ha-icon { --mdc-icon-size: 16px; color: inherit; }
      .needs-completion.due-today .window-opportunity { color: var(--primary-color); }
      .needs-completion.overdue .window-opportunity { color: var(--error-color, #f44336); }
      .window-label { font-weight: 500; min-width: 60px; }
      .window-time { color: var(--secondary-text-color); font-size: 0.85em; margin-left: auto; }

      /* Tooltip base */
      .tt-tooltip {
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

      /* Misc */
      .loading, .error, .no-tasks { text-align: center; padding: 24px 0; color: var(--secondary-text-color); font-size: 0.9em; }
      .error { color: var(--error-color); text-align: center; font-style: italic; padding: 16px; }
      .no-tasks { color: var(--secondary-text-color); }
      .no-user-warning { color: var(--primary-text-color); background: var(--secondary-background-color); padding: 12px; border-radius: 4px; border: 1px solid var(--divider-color); text-align: center; margin-bottom: 16px; }
      .category-title { font-weight: 600; margin-bottom: 8px; margin-top: 8px; }

      /* Effects */
      .tt-focus-highlight { transition: box-shadow 0.3s ease; box-shadow: 0 0 20px rgba(255, 193, 7, 0.5); }

      /* Generic sliders (non Daily-State specific) */
      .time-slider { flex: 1; width: 100%; height: 4px; background: var(--divider-color); border-radius: 2px; outline: none; -webkit-appearance: none; display: block; }
      .time-slider::-webkit-slider-runnable-track { height: 4px; border-radius: 2px; background: var(--divider-color); }
      .time-slider::-moz-range-track { height: 4px; border-radius: 2px; background: var(--divider-color); }
    `;
  }
  static ensureGlobal() {
    if (document.getElementById('tt-global-styles')) return;

    const style = document.createElement('style');
    style.id = 'tt-global-styles';
    style.textContent = `
      ${TaskTrackerStyles.getSharedUtilitiesStyles()}

      /* Modal */
      .tt-modal {
        position: fixed; inset: 0;
        background: rgba(0, 0, 0, 0.5);
        z-index: 10000;
        display: flex; align-items: center; justify-content: center;
        opacity: 0; transition: opacity 0.2s ease;
        pointer-events: none; /* Prevent blocking clicks when not visible */
      }
      .tt-modal--visible { opacity: 1; pointer-events: auto; }

      .tt-modal__content {
        background: var(--card-background-color);
        border-radius: 8px;
        padding: 0;
        width: 90%;
        max-width: 600px;
        max-height: 90vh; /* slightly less than full window height */
        display: flex;
        flex-direction: column;
        overflow: hidden;
        box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
        font-family: var(--primary-font-family);
      }

      .tt-modal__header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 16px 20px;
        border-bottom: 1px solid var(--divider-color);
        flex: 0 0 auto;
        background: var(--card-background-color);
        position: sticky; top: 0; z-index: 1;
      }
      .tt-modal__title { margin: 0; color: var(--primary-text-color); font-size: 1.3em; font-weight: 500; }
      .tt-modal__close { background: none; border: none; font-size: 24px; cursor: pointer; color: var(--secondary-text-color); padding: 0; width: 24px; height: 24px; display: flex; align-items: center; justify-content: center; }

      .tt-modal__body {
        flex: 1 1 auto;
        overflow: auto;
        padding: 16px 20px;
      }

      .tt-modal__footer {
        flex: 0 0 auto;
        padding: 12px 20px;
        border-top: 1px solid var(--divider-color);
        display: block;
        background: var(--card-background-color);
        position: sticky; bottom: 0; z-index: 1;
      }

      .tt-modal__footer-row {
        display: flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        flex-wrap: wrap;
      }
      .tt-modal__footer-controls { display: flex; gap: 12px; align-items: center; flex-wrap: wrap; }
      .tt-modal__footer-actions { display: flex; gap: 12px; align-items: center; margin-left: auto; }

      /* Toasts */
      .tt-toast {
        position: fixed;
        top: 20px;
        right: 20px;
        color: white;
        padding: 8px 16px;
        border-radius: 4px;
        font-weight: 500;
        box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
        z-index: 10001;
        font-size: 0.9em;
        transform: translateY(-10px);
        opacity: 0;
        transition: opacity 0.15s ease, transform 0.15s ease;
      }
      .tt-toast--success { background: var(--success-color, #4caf50); }
      .tt-toast--error { background: var(--error-color, #f44336); }
      .tt-toast.tt-show { opacity: 1; transform: translateY(0); }

      /* Modal width variants */
      .tt-modal__content--w-450 { max-width: 450px; }
      .tt-modal__content--w-600 { max-width: 600px; }

      /* Daily State modal styles - centralized via shared helper */
      ${TaskTrackerStyles.getDailyStateSharedStyles()}
    `;

    document.head.appendChild(style);
  }

  /**
   * Return common card-scoped styles to be injected inside each card's shadow root
   * Ensures components have consistent visuals (card frame, headers, lists, sliders, etc.)
   */
  static getCommonCardStyles() {
    return `
      :host {
        display: block;
      }

      .card {
        padding: 16px;
        font-family: var(--primary-font-family);
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border-radius: var(--ha-card-border-radius, 12px);
        border: 1px solid var(--divider-color);
        position: relative;
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
        padding: 2px;
        cursor: pointer;
        color: var(--secondary-text-color);
      }

      .refresh-btn:hover {
        background: var(--secondary-background-color);
      }

      /* Shared utilities and components */
      ${TaskTrackerStyles.getSharedUtilitiesStyles()}

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

      @keyframes pulse { 0%,100% { opacity: 0.3; } 50% { opacity: 0.8; } }
      /* Daily State shared styles */
      ${TaskTrackerStyles.getDailyStateSharedStyles()}
    `;
  }

  // Common config editor styles shared by all editors
  static getCommonConfigStyles() {
    return `
      .card-config { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
      .config-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .config-row label { flex: 1; font-weight: 500; color: var(--primary-text-color); }
      .config-row input, .config-row select { flex: 0 0 auto; min-width: 120px; padding: 8px 12px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); font-family: inherit; }
      .config-row input[type="checkbox"] { min-width: auto; width: 20px; height: 20px; }
      .config-row input[type="number"] { width: 80px; }
      .config-description { font-size: 0.85em; color: var(--secondary-text-color); margin-top: 4px; font-style: italic; }
      .section-title { font-size: 1.1em; font-weight: 600; color: var(--primary-text-color); margin-top: 16px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--divider-color); }
      .section-title:first-child { margin-top: 0; }
    `;
  }

  // Per-card style blocks
  static getDailyPlanCardStyles() {
    return `
      .section-title { font-weight: 600; margin: 16px 0 8px 0; color: var(--primary-text-color); }
      .section-title:first-child { margin-top: 0; }
      .section-title.urgent { color: var(--error-color, #f44336); font-size: 1.1em; }
      .all-done-text { font-weight: normal; font-size: 0.9em; font-style: italic; }
      .task-list { margin-bottom: 16px; }
      .task-list:last-child { margin-bottom: 0; }
      .debug { font-size: 0.8em; color: var(--secondary-text-color); margin-top: 8px; padding: 8px; background: var(--secondary-background-color); border-radius: 4px; }
      .notification-focus { color: var(--primary-text-color); padding: 12px; border-radius: 4px; margin-bottom: 16px; font-weight: 500; border: 1px solid rgba(76, 175, 80, 0.3); }
      .daily-state-prompt { margin-bottom: 16px; }
      .daily-state-help { font-size: 0.8em; color: var(--secondary-text-color); font-style: italic; text-align: center; margin-top: 8px; }
      .daily-state-container { border-top: 1px solid var(--divider-color); padding-top: 16px; }
      .daily-state-display { background: var(--secondary-background-color, rgba(0, 0, 0, 0.05)); border-radius: 6px; padding: 12px; display: flex; align-items: center; justify-content: space-between; gap: 12px; }
      .daily-state-edit-btn { background: var(--secondary-background-color); font-size: 0.8em; }
      .daily-state-values { display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px; }
      .state-value { display: flex; align-items: center; gap: 4px; font-size: 0.85em; color: var(--primary-text-color); }
      .state-label { color: var(--secondary-text-color); font-weight: 500; }
      .state-number { font-weight: 600; color: var(--light-primary-color); }
      .urgent-section { margin-top: 16px; }
      .urgent-description { color: var(--secondary-text-color); font-size: 0.9em; margin-bottom: 12px; font-style: italic; }
      .all-caught-up { text-align: center; padding: 8px; color: var(--secondary-text-color); font-size: 0.9em; }
      .no-urgent-tasks { text-align: center; padding: 20px; color: var(--secondary-text-color); font-style: italic; }
      .selfcare-windowed { border-radius: 6px; }
      .selfcare-windowed.all-complete { opacity: 0.8; background: rgba(76, 175, 80, 0.1); }
      .task-item[data-task-type="self_care"]:not(.selfcare-windowed) .task-metadata { font-style: italic; }
      .selfcare-windowed .task-content { padding-right: 0; }
      .selfcare-windowed .task-actions { margin-top: 8px; margin-left: 12px; border-left: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12)); padding-left: 12px; }
      .task-item.low-recommendation { opacity: 0.6; transition: opacity 0.2s ease; }
      .task-item.low-recommendation:hover { opacity: 0.8; }
      .task-item { display: flex; align-items: stretch; transition: opacity 0.3s ease, transform 0.3s ease; }
      .task-item.fade-out { opacity: 0; transform: scale(0.95); pointer-events: none; }
      .task-content { flex: 1; }
      .task-actions { display: flex; align-items: stretch; border-left: 1px solid var(--divider-color, rgba(0, 0, 0, 0.12)); padding-left: 12px; margin-left: 12px; }
      .complete-btn { display: flex; align-items: center; justify-content: center; flex: 1; }
      .filter-toggle-btn { background: none; border: none; color: var(--primary-text-color); cursor: pointer; padding: 8px; border-radius: 4px; transition: background-color 0.2s ease, color 0.2s ease; display: flex; align-items: center; justify-content: center; }
      .filter-toggle-btn:hover { background: var(--secondary-background-color); }
      .filter-toggle-btn.filtered { background: var(--secondary-background-color); }
      .filter-toggle-btn ha-icon { --mdc-icon-size: 20px; }
      .header-actions { display: flex; align-items: center; gap: 4px; }
    `;
  }

  static getDailyStateCardStyles() {
    return `
      /* Card-specific spacing only */
      .advanced-toggle { margin: 8px 0; }
      .card > .tt-ds-mount > .tt-ds-advanced { margin-top: 0; border-top: none; padding-top: 0; }
      /* Optional per-card tweak: wider value column */
      .tt-ds-slider-row { grid-template-columns: 100px 1fr 80px; }
    `;
  }

  static getCompleteTaskCardStyles() {
    return `
      :host { display: block; }
      .form-group { margin-bottom: 16px; }
      .form-group:last-of-type { margin-bottom: 20px; }
      .form-label { display: block; margin-bottom: 6px; font-weight: 500; color: var(--primary-text-color); font-size: 0.9em; }
      .form-control { width: 100%; padding: 8px 12px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); font-family: inherit; font-size: 0.9em; box-sizing: border-box; }
      .form-control:focus { outline: none; border-color: var(--primary-color); box-shadow: 0 0 0 1px var(--primary-color); }
      .form-control:disabled { background: var(--secondary-background-color); color: var(--secondary-text-color); cursor: not-allowed; }
      select.form-control { cursor: pointer; }
      select.form-control:disabled { cursor: not-allowed; }
      textarea.form-control { resize: vertical; min-height: 60px; max-height: 120px; }
      .task-details { margin-top: 6px; padding: 8px 12px; background: var(--secondary-background-color); border-radius: 4px; font-size: 0.8em; color: var(--secondary-text-color); border: 1px solid var(--divider-color); }
      .complete-btn { width: 100%; padding: 12px; background: var(--secondary-background-color); color: white; border: none; border-radius: 4px; font-size: 0.95em; font-weight: 500; cursor: pointer; font-family: inherit; }
      .complete-btn:hover:not(:disabled) { background: var(--secondary-text-color); filter: brightness(0.9); }
      .complete-btn:disabled { background: var(--secondary-text-color); cursor: not-allowed; opacity: 0.6; }
      .completing { opacity: 0.7; }
    `;
  }
}
