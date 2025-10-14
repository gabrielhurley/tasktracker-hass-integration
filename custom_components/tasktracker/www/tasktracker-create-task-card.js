import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';
import { TaskTrackerTasksBaseCard } from './utils/task-cards-base.js';
import { TaskTrackerTaskEditor } from './utils/ui/task-editor.js';
import { TaskTrackerBaseEditor } from './utils/base-config-editor.js';

class TaskTrackerCreateTaskCard extends TaskTrackerTasksBaseCard {
  constructor() {
    super();
    this._creating = false;
    this._createdTask = null;
    this._pendingTaskType = 'RecurringTask';
    this._pendingDescription = '';
  }

  static getConfigElement() { return document.createElement('tasktracker-create-task-card-editor'); }

  static getStubConfig() {
    return {
      show_header: true,
      user_filter_mode: 'current',
      explicit_user: null,
    };
  }

  setConfig(config) {
    this._config = { ...TaskTrackerCreateTaskCard.getStubConfig(), ...config };
    this._render();
  }

  onAfterUpdate() {
    // If a created task was deleted elsewhere, clear it if it doesn't exist anymore
    // Consumers listening to task updates will cause a re-render via card refreshes in other cards
  }

  getCardTitle() { return 'Create Task'; }

  async _handleCreate() {
    if (this._creating) return;
    await this._fetchAvailableUsers();

    const taskType = this.shadowRoot.querySelector('#tt-create-type')?.value;
    const description = this.shadowRoot.querySelector('#tt-create-desc')?.value?.trim();
    this._pendingTaskType = taskType || this._pendingTaskType;
    this._pendingDescription = description || this._pendingDescription;
    const assignedTo = TaskTrackerUtils.getCurrentUsername(this._config, this._hass, this._availableUsers);

    if (!taskType || !description) {
      TaskTrackerUtils.showError('Please select a task type and enter a description');
      return;
    }

    try {
      this._creating = true;
      this._renderContent();
      const result = await TaskTrackerUtils.createTaskFromDescription(this._hass, taskType, description, assignedTo);
      const task = result?.data?.task || null;
      if (task) {
        this._createdTask = task;
        this._pendingDescription = '';
        this._pendingTaskType = 'RecurringTask';
        this._renderContent();
        // Show modal for the created task to allow edit/complete
        const modal = TaskTrackerUtils.createTaskModal(
          task,
          { ...(this._config || {}), userContext: this._userContext, user_context: this._userContext },
          async (notes, completed_at = null) => { await this._completeTask(task, notes, completed_at); },
          null,
          this._availableUsers,
          this._enhancedUsers,
          (taskToEdit) => {
            TaskTrackerTaskEditor.openEditModal(
              taskToEdit,
              { ...(this._config || {}), userContext: this._userContext, user_context: this._userContext },
              async (taskToUpdate, updates) => { await this._saveTask(taskToUpdate, updates); }
            );
          }
        );
        TaskTrackerUtils.showModal(modal);
      }
    } catch (e) {
      TaskTrackerUtils.showError(e?.message || 'Failed to create task');
    } finally {
      this._creating = false;
      this._renderContent();
    }
  }

  _renderCreatedTask() {
    if (!this._createdTask) return '';
    // Clear task data before rendering to avoid stale data
    this.clearTaskData();
    return `
      <div class="tt-mt-24">
        <div class="tt-label tt-mb-8">Created Task</div>
        ${this.renderSimpleTaskRow(this._createdTask)}
      </div>
    `;
  }

  _renderContent() {
    const container = this.shadowRoot?.querySelector('.content-container');
    if (!container) return '';

    const disabled = this._creating ? 'disabled' : '';

    const html = `
      <div class="tt-form tt-gap-16">
        <div class="tt-form-row">
          <label class="tt-label">Task Type</label>
          <select id="tt-create-type" class="tt-select">
            <option value="RecurringTask" ${this._pendingTaskType === 'RecurringTask' ? 'selected' : ''}>Recurring Task</option>
            <option value="AdHocTask" ${this._pendingTaskType === 'AdHocTask' ? 'selected' : ''}>Ad-hoc Task</option>
            <option value="SelfCareTask" ${this._pendingTaskType === 'SelfCareTask' ? 'selected' : ''}>Self-Care Task</option>
          </select>
        </div>
        <div class="tt-form-row">
          <label class="tt-label">Describe the task</label>
          <textarea id="tt-create-desc" class="tt-textarea" placeholder="e.g., Clean the kitchen every evening after dinner for 20 minutes">${this._pendingDescription || ''}</textarea>
        </div>
        <div class="tt-flex-end">
          <button class="tt-btn tt-btn--primary" id="tt-create-btn" ${disabled}>${this._creating ? 'Creating…' : 'Create Task'}</button>
        </div>
        ${this._renderCreatedTask()}
      </div>
    `;

    container.innerHTML = html;
    this._attachContentEventListeners();
    return html;
  }

  _attachContentEventListeners() {
    const btn = this.shadowRoot.querySelector('#tt-create-btn');
    if (btn) btn.addEventListener('click', (e) => { e.preventDefault(); this._handleCreate(); });

    const typeSel = this.shadowRoot.querySelector('#tt-create-type');
    if (typeSel) typeSel.addEventListener('change', (e) => { this._pendingTaskType = e.target.value; });

    const descEl = this.shadowRoot.querySelector('#tt-create-desc');
    if (descEl) descEl.addEventListener('input', (e) => { this._pendingDescription = e.target.value; });

    // Setup task click handlers using the base class helper
    this.setupTaskClickHandlers(
      (task, taskType) => {
        // Task click handler - show modal
        const modal = TaskTrackerUtils.createTaskModal(
          task,
          { ...(this._config || {}), userContext: this._userContext, user_context: this._userContext },
          async (notes, completed_at = null) => { await this._completeTask(task, notes, completed_at); },
          null,
          this._availableUsers,
          this._enhancedUsers,
          (taskToEdit) => {
            TaskTrackerTaskEditor.openEditModal(taskToEdit, { ...(this._config || {}), userContext: this._userContext, user_context: this._userContext }, async (taskToUpdate, updates) => { await this._saveTask(taskToUpdate, updates); });
          },
          null,
          async () => {
            await this._deleteTask(task);
            this._createdTask = null;
            this._renderContent();
          }
        );
        TaskTrackerUtils.showModal(modal);
      }
    );
  }
}

if (!customElements.get('tasktracker-create-task-card')) {
  customElements.define('tasktracker-create-task-card', TaskTrackerCreateTaskCard);
}

class TaskTrackerCreateTaskCardEditor extends TaskTrackerBaseEditor {
  constructor() {
    super();
  }

  getDefaultConfig() { return { ...TaskTrackerCreateTaskCard.getStubConfig() }; }

  _render() {
    if (!this.shadowRoot) return;
    this.shadowRoot.innerHTML = `
      <style>${TaskTrackerUtils.getCommonConfigStyles()}</style>
      <div class="card-config">
        <div class="section-title">Display</div>
        ${TaskTrackerUtils.createConfigRow(
          'Show Header',
          'Display card header with title',
          TaskTrackerUtils.createCheckboxInput(this._config.show_header, 'show_header')
        )}

        <div class="section-title">User</div>
        ${TaskTrackerUtils.createConfigRow(
          'User Mode',
          'Who to assign created tasks to',
          TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
            { value: 'current', label: 'Current User' },
            { value: 'explicit', label: 'Specific User' },
          ])
        )}
        <div class="explicit-user-row ${this._config.user_filter_mode === 'explicit' ? '' : 'tt-hidden'}">
          ${TaskTrackerUtils.createConfigRow(
            'Username',
            'TaskTracker username to assign new tasks to',
            TaskTrackerUtils.createTextInput(this._config.explicit_user || '', 'explicit_user', 'e.g., alice')
          )}
        </div>
      </div>
    `;

    this.shadowRoot.querySelectorAll('input, select').forEach(input => {
      input.addEventListener('change', this._valueChanged.bind(this));
      if (input.type === 'text') input.addEventListener('input', this._valueChanged.bind(this));
    });
  }

  _updateConfig(configKey, value) {
    super._updateConfig(configKey, value);
    if (configKey === 'user_filter_mode') this._render();
  }
}

if (!customElements.get('tasktracker-create-task-card-editor')) {
  customElements.define('tasktracker-create-task-card-editor', TaskTrackerCreateTaskCardEditor);
}

window.customCards = window.customCards || [];
if (!window.customCards.find(card => card.type === 'tasktracker-create-task-card')) {
  window.customCards.push({
    type: 'tasktracker-create-task-card',
    name: 'TaskTracker Create Task',
    description: 'Create a task from a free-form description using AI. Shows the created task row.',
    preview: true,
    documentationURL: 'https://github.com/gabrielhurley/TaskTracker',
  });
}
