/**
 * TaskTracker Shared Utilities
 *
 * Common functions and utilities shared across all TaskTracker cards
 */

export class TaskTrackerUtils {

    // User management utilities
    static getCurrentUsername(config, hass) {
        switch (config.user_filter_mode) {
            case 'explicit':
                return config.explicit_user;

            case 'current':
                // Try to detect current user
                if (hass && hass.user && hass.user.name) {
                    // Basic mapping - in real implementation this would use the integration's user mapping
                    return hass.user.name.toLowerCase();
                }
                return null;

            case 'all':
            default:
                return null; // No username filter
        }
    }

    static hasValidUserConfig(config) {
        return config.user_filter_mode &&
            (config.user_filter_mode === 'all' ||
                config.user_filter_mode === 'current' ||
                (config.user_filter_mode === 'explicit' && config.explicit_user));
    }

    static getUsernameForAction(config, hass) {
        let username = TaskTrackerUtils.getCurrentUsername(config, hass);

        // If we're in "all users" mode, we need a username for actions
        if (config.user_filter_mode === 'all' && !username) {
            // Try to get current user as fallback
            if (hass && hass.user && hass.user.name) {
                username = hass.user.name.toLowerCase();
            }
        }

        return username;
    }

    // Toast notification utilities
    static showSuccess(message) {
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

    static showError(message) {
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

    // Date and time formatting utilities
    static formatDate(dateString) {
        try {
            const date = new Date(dateString);
            return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
        } catch {
            return dateString;
        }
    }

    static formatDueDate(dueDateString) {
        try {
            const dueDate = new Date(dueDateString);
            const now = new Date();
            const diffMs = dueDate - now;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));

            if (diffMs < 0) {
                // Overdue
                const overdueDays = Math.abs(diffDays);
                if (overdueDays === 0) {
                    return 'Today';
                } else if (overdueDays === 1) {
                    return '1 day ago';
                } else {
                    return `${overdueDays} days ago`;
                }
            } else if (diffDays === 0) {
                // Due today
                return diffHours > 0 ? `${diffHours}h` : 'Now';
            } else if (diffDays === 1) {
                return 'Tomorrow';
            } else {
                return `${diffDays} days`;
            }
        } catch {
            return 'Unknown';
        }
    }

    static formatDateTime(dateString) {
        try {
            const date = new Date(dateString);
            const now = new Date();
            const diffMs = now - date;
            const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));
            const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
            const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

            // Return relative time for recent completions
            if (diffDays === 0) {
                if (diffHours === 0) {
                    if (diffMinutes < 1) {
                        return 'Just now';
                    }
                    return `${diffMinutes}m ago`;
                }
                return `${diffHours}h ago`;
            } else if (diffDays === 1) {
                return 'Yesterday';
            } else {
                return `${diffDays} days ago`;
            }
        } catch {
            return dateString;
        }
    }

    static formatDuration(minutes) {
        if (!minutes) return 'Unknown';

        if (minutes < 60) {
            return `${minutes}m`;
        } else {
            const hours = Math.floor(minutes / 60);
            const remainingMinutes = minutes % 60;
            return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
        }
    }

    // Priority formatting
    static formatPriority(priority) {
        const priorityStringMap = {
            'High': 1,
            'Medium': 2,
            'Low': 3
        };

        const priorityMap = {
            3: 'Low',
            2: 'Medium',
            1: 'High',
            4: 'Very Low',
            5: 'Minimal'
        };

        if (priority in priorityStringMap) {
            return priorityMap[priorityStringMap[priority]];
        } else {
            return priorityMap[priority] || `Priority ${priority}`;
        }
    }

    // Task completion utility
    static async completeTask(hass, taskName, username, notes) {
        const serviceData = {
            name: taskName,
            assigned_to: username
        };

        if (notes) {
            serviceData.notes = notes;
        }

        return await hass.callService('tasktracker', 'complete_task_by_name', serviceData, {}, true, true);
    }

    // Modal creation utilities
    static createTaskModal(task, config, onComplete) {
        const modal = document.createElement('div');
        modal.className = 'task-modal';
        modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      opacity: 0;
      transition: opacity 0.3s ease;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

        const modalContent = document.createElement('div');
        modalContent.className = 'modal-content';
        modalContent.style.cssText = `
      background: var(--card-background-color);
      border-radius: 4px;
      padding: 16px;
      max-width: 500px;
      width: 90%;
      max-height: 80vh;
      overflow-y: auto;
      transition: transform 0.3s ease;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      border: 1px solid var(--divider-color);
    `;

        modalContent.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; padding-bottom: 8px; border-bottom: 1px solid var(--divider-color);">
        <h2 style="margin: 0; color: var(--primary-text-color); font-size: 1.1em; font-weight: 500;">${task.name}</h2>
        <button class="close-btn" style="
          background: none;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          padding: 6px;
          cursor: pointer;
          color: var(--secondary-text-color);
          font-size: 16px;
        ">&times;</button>
      </div>

      <div class="task-details" style="margin-bottom: 16px;">
        <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-bottom: 12px;">
          <div>
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Duration:</strong>
            <div style="color: var(--secondary-text-color); font-size: 0.8em;">${task.duration_minutes} minutes</div>
          </div>
          <div>
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Priority:</strong>
            <div style="color: var(--secondary-text-color); font-size: 0.8em;">${TaskTrackerUtils.formatPriority(task.priority)}</div>
          </div>
          <div>
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Frequency:</strong>
            <div style="color: var(--secondary-text-color); font-size: 0.8em;">${task.frequency || 'N/A'}</div>
          </div>
          <div>
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Last Completed:</strong>
            <div style="color: var(--secondary-text-color); font-size: 0.8em;">${task.last_completed ? TaskTrackerUtils.formatDate(task.last_completed) : 'Never'}</div>
          </div>
        </div>

        ${task.notes ? `
          <div style="margin-bottom: 12px;">
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Notes:</strong>
            <div style="color: var(--secondary-text-color); margin-top: 4px; font-size: 0.8em;">${task.notes}</div>
          </div>
        ` : ''}

        ${task.last_completion_notes ? `
          <div style="margin-bottom: 12px;">
            <strong style="color: var(--primary-text-color); font-size: 0.9em;">Last Completion Notes:</strong>
            <div style="color: var(--secondary-text-color); margin-top: 4px; font-size: 0.8em;">${task.last_completion_notes}</div>
          </div>
        ` : ''}
      </div>

      ${config.show_completion_notes ? `
        <div style="margin-bottom: 16px;">
          <label style="display: block; margin-bottom: 8px; color: var(--primary-text-color); font-weight: 500; font-size: 0.9em;">
            Completion Notes (optional):
          </label>
          <textarea
            class="completion-notes"
            placeholder="Add any notes about completing this task..."
            style="
              width: 100%;
              min-height: 60px;
              padding: 8px;
              border: 1px solid var(--divider-color);
              border-radius: 4px;
              background: var(--card-background-color);
              color: var(--primary-text-color);
              font-family: inherit;
              font-size: 0.8em;
              resize: vertical;
              box-sizing: border-box;
            "
          ></textarea>
        </div>
      ` : ''}

      <div style="display: flex; gap: 8px; justify-content: flex-end;">
        <button class="cancel-btn" style="
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--secondary-text-color);
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8em;
        ">Cancel</button>
        <button class="complete-btn" style="
          padding: 6px 12px;
          border: none;
          background: transparent;
          color: var(--secondary-text-color);
          border-radius: 4px;
          cursor: pointer;
          font-family: inherit;
          font-size: 0.8em;
        ">Complete</button>
      </div>
    `;

        modal.appendChild(modalContent);

        // Event listeners
        const closeBtn = modalContent.querySelector('.close-btn');
        const cancelBtn = modalContent.querySelector('.cancel-btn');
        const completeBtn = modalContent.querySelector('.complete-btn');
        const notesTextarea = modalContent.querySelector('.completion-notes');

        const closeModal = () => {
            modal.style.opacity = '0';
            setTimeout(() => {
                if (modal.parentNode) {
                    modal.parentNode.removeChild(modal);
                }
            }, 300);
        };

        closeBtn.addEventListener('click', closeModal);
        cancelBtn.addEventListener('click', closeModal);
        modal.addEventListener('click', (e) => {
            if (e.target === modal) closeModal();
        });

        completeBtn.addEventListener('click', async () => {
            const notes = notesTextarea ? notesTextarea.value.trim() : '';
            await onComplete(notes);
            closeModal();
        });

        // Style complete button on hover
        completeBtn.addEventListener('mouseenter', () => {
            completeBtn.style.background = 'var(--divider-color)';
            completeBtn.style.color = 'var(--primary-text-color)';
        });
        completeBtn.addEventListener('mouseleave', () => {
            completeBtn.style.background = 'transparent';
            completeBtn.style.color = 'var(--secondary-text-color)';
        });

        return modal;
    }

    static showModal(modal) {
        document.body.appendChild(modal);
        requestAnimationFrame(() => {
            modal.style.opacity = '1';
        });
    }

    // Configuration utilities
    static createConfigRow(label, description, inputHtml) {
        return `
      <div class="config-row">
        <label>
          ${label}
          ${description ? `<div class="config-description">${description}</div>` : ''}
        </label>
        ${inputHtml}
      </div>
    `;
    }

    static createNumberInput(value, configKey, min = null, max = null, step = null) {
        const attrs = [
            `value="${value}"`,
            `data-config-key="${configKey}"`,
            min !== null ? `min="${min}"` : '',
            max !== null ? `max="${max}"` : '',
            step !== null ? `step="${step}"` : ''
        ].filter(Boolean).join(' ');

        return `<input type="number" ${attrs} />`;
    }

    static createTextInput(value, configKey, placeholder = '') {
        return `
      <input
        type="text"
        value="${value || ''}"
        data-config-key="${configKey}"
        placeholder="${placeholder}"
      />
    `;
    }

    static createCheckboxInput(checked, configKey) {
        return `
      <input
        type="checkbox"
        ${checked ? 'checked' : ''}
        data-config-key="${configKey}"
      />
    `;
    }

    static createSelectInput(value, configKey, options) {
        const optionsHtml = options.map(option => {
            const optionValue = typeof option === 'string' ? option : option.value;
            const optionLabel = typeof option === 'string' ? option : option.label;
            const selected = value === optionValue ? 'selected' : '';
            return `<option value="${optionValue}" ${selected}>${optionLabel}</option>`;
        }).join('');

        return `<select data-config-key="${configKey}">${optionsHtml}</select>`;
    }

    static capitalize(string) {
        if (!string) return string;
        return string.charAt(0).toUpperCase() + string.slice(1);
    }

    // Common styles for cards
    static getCommonCardStyles() {
        return `
      :host {
        display: block;
      }

      .card {
        padding: 16px;
        font-family: var(--primary-font-family);
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

      .loading, .error, .no-tasks {
        text-align: center;
        padding: 24px 0;
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }

      .error {
        color: var(--error-color);
        text-align: center;
        font-style: italic;
        padding: 16px;
      }

      .no-tasks {
        color: var(--secondary-text-color);
      }

      .no-user-warning {
        color: var(--primary-text-color);
        background: var(--secondary-background-color);
        padding: 12px;
        border-radius: 4px;
        border: 1px solid var(--divider-color);
        text-align: center;
        margin-bottom: 16px;
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

      .task-item {
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

        .task-item.needs-completion {
          border-left: 2px solid var(--primary-color);
        }

        .task-item.completed {
          border-left: 2px solid var(--success-color);
        }

        .task-item:hover {
          background: var(--divider-color);
        }

        .task-item:last-child {
          margin-bottom: 0;
        }

        .task-content {
          flex: 1;
          min-width: 0;
        }

        .task-name {
          font-weight: 500;
          color: var(--primary-text-color);
          font-size: 0.95em;
          margin-bottom: 2px;
          word-wrap: break-word;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .completion-indicator {
          width: 6px;
          height: 6px;
          background: var(--primary-color);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .task-metadata {
          font-size: 0.8em;
          color: var(--secondary-text-color);
        }

      @keyframes pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.8; }
      }

      .complete-btn,
      .dispose-btn {
        background: transparent;
        border: none;
        color: var(--secondary-text-color);
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
        transition: background-color 0.2s ease;
      }

      .complete-btn:hover,
      .dispose-btn:hover {
        background: var(--divider-color);
        color: var(--primary-text-color);
      }

      .complete-btn:active,
      .dispose-btn:active {
        transform: scale(0.95);
      }

      .category {
        margin-bottom: 16px;
      }

      .category-title {
        font-size: 1.1em;
      }
    `;
    }

    // Common styles for config editors
    static getCommonConfigStyles() {
        return `
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
    `;
    }

    // Auto-refresh setup utility
    static setupAutoRefresh(refreshCallback, intervalSeconds) {
        // Validate interval before setting up the timer
        const intervalMs = intervalSeconds * 1000;
        if (isNaN(intervalMs) || intervalMs <= 0) {
            console.warn('Invalid refresh interval, skipping auto-refresh setup');
            return null;
        }

        return setInterval(refreshCallback, intervalMs);
    }

    // Array equality check utility
    static arraysEqual(arr1, arr2, compareFunction) {
        if (arr1.length !== arr2.length) return false;

        for (let i = 0; i < arr1.length; i++) {
            if (!compareFunction(arr1[i], arr2[i])) {
                return false;
            }
        }

        return true;
    }

    // Common config value change handler for card editors
    static handleConfigValueChange(ev, editorInstance, updateConfigCallback, optionalFields = ['explicit_user', 'user', 'default_user']) {
        if (!editorInstance._config || !editorInstance._hass) {
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
            const parsedValue = parseInt(target.value, 10);
            // Handle empty values or invalid numbers by using null to trigger default fallback
            value = isNaN(parsedValue) ? null : parsedValue;
        } else {
            value = target.value || null;
        }

        // Handle empty string for optional fields
        if (optionalFields.includes(configKey) && value === '') {
            value = null;
        }

        // For text inputs, debounce the config update to avoid frequent API calls
        if (target.type === 'text') {
            // Initialize debounce timers if not exists
            if (!editorInstance._debounceTimers) {
                editorInstance._debounceTimers = {};
            }

            // Clear any existing timer for this field
            if (editorInstance._debounceTimers[configKey]) {
                clearTimeout(editorInstance._debounceTimers[configKey]);
            }

            // Set a new timer to update config after user stops typing
            editorInstance._debounceTimers[configKey] = setTimeout(() => {
                updateConfigCallback(configKey, value);
                delete editorInstance._debounceTimers[configKey];
            }, 500); // Wait 500ms after user stops typing
        } else {
            // For non-text inputs (checkboxes, selects, numbers), update immediately
            updateConfigCallback(configKey, value);
        }
    }
}