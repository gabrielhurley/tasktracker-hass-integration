import { TaskTrackerUtils } from './tasktracker-utils.js';
import { TaskTrackerStyles } from './utils/styles.js';
import { TaskTrackerBaseCard } from './utils/base-card.js';
import { TaskTrackerBaseEditor } from './utils/base-config-editor.js';
import { ensureServiceSuccess } from './utils/error-handling.js';

/**
 * TaskTrackerGoalsCard
 *
 * Lovelace card for managing user goals and task associations.
 * Provides full CRUD operations for goals and task associations.
 */
class TaskTrackerGoalsCard extends TaskTrackerBaseCard {
  constructor() {
    super();
    this._goals = [];
    this._allTasks = [];
    this._loading = false;
    this._error = null;
    this._view = 'list'; // 'list', 'form', 'tasks'
    this._editingGoal = null; // {id, name, description, priority, is_active} or null for create
    this._selectedGoalId = null;
    this._goalTasks = [];
    this._taskFilter = '';
    this._showTaskPicker = false;
    this._availableUsers = [];
    this._enhancedUsers = [];
    this._initialLoad = true;
    this._refreshing = false;
  }

  static getStubConfig() {
    return {
      show_header: true,
      show_inactive: false,
      refresh_interval: 300,
      user_filter_mode: 'current', // 'all', 'current', 'explicit'
      explicit_user: null
    };
  }

  getCardTitle() {
    return 'Goals';
  }

  async onAutoRefresh() {
    await this._fetchGoals();
  }

  setConfig(config) {
    this._config = {
      show_header: config.show_header !== false,
      show_inactive: config.show_inactive || false,
      refresh_interval: config.refresh_interval || 300,
      user_filter_mode: config.user_filter_mode || 'current',
      explicit_user: config.explicit_user || null,
      // Legacy support for old 'user' config
      user: config.user || null,
      ...config
    };

    // Migrate legacy user config to new format
    if (this._config.user && !config.user_filter_mode) {
      this._config.user_filter_mode = 'explicit';
      this._config.explicit_user = this._config.user;
    }
  }

  onHassFirstRun() {
    this._fetchGoals();
    this._setupEventListeners();
  }

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

  _setupEventListeners() {
    if (this._eventCleanup) return;

    const goalEvents = [
      'tasktracker_goal_created',
      'tasktracker_goal_updated',
      'tasktracker_goal_deleted',
    ];

    const handler = () => {
      this._fetchGoals();
    };

    goalEvents.forEach(event => {
      this._hass.connection.subscribeEvents(handler, event);
    });

    this._eventCleanup = async () => {
      goalEvents.forEach(event => {
        this._hass.connection.subscribeEvents(() => {}, event);
      });
    };
  }

  getCardStyles() {
    return `
      .goals-table {
        width: 100%;
        border-collapse: collapse;
      }
      .goals-table th {
        text-align: left;
        padding: 8px 12px;
        border-bottom: 2px solid var(--divider-color);
        font-weight: 600;
        color: var(--primary-text-color);
      }
      .goals-table td {
        padding: 8px 12px;
        border-bottom: 1px solid var(--divider-color);
      }
      .goals-table tr:hover {
        background-color: var(--secondary-background-color);
      }
      .goal-actions {
        display: flex;
        gap: 8px;
      }
      .goal-actions button {
        padding: 4px 8px;
        font-size: 12px;
      }
      .badge {
        display: inline-block;
        padding: 2px 8px;
        border-radius: 12px;
        font-size: 11px;
        font-weight: 600;
        text-transform: uppercase;
      }
      .badge--high {
        background-color: var(--error-color, #db4437);
        color: white;
      }
      .badge--medium {
        background-color: var(--warning-color, #ffa600);
        color: white;
      }
      .badge--low {
        background-color: var(--info-color, #4285f4);
        color: white;
      }
      .badge--active {
        background-color: var(--success-color, #0f9d58);
        color: white;
      }
      .badge--inactive {
        background-color: var(--disabled-text-color, #9e9e9e);
        color: white;
      }
      .badge--recurring {
        background-color: var(--primary-color);
        color: white;
      }
      .badge--selfcare {
        background-color: var(--accent-color, #ff9800);
        color: white;
      }
      .badge--adhoc {
        background-color: var(--info-color, #4285f4);
        color: white;
      }
      .empty-state {
        text-align: center;
        padding: 40px 20px;
        color: var(--secondary-text-color);
      }
      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        margin-bottom: 16px;
        color: var(--secondary-text-color);
        font-size: 14px;
      }
      .breadcrumb button {
        color: var(--primary-color);
        text-decoration: underline;
        background: none;
        border: none;
        cursor: pointer;
        padding: 0;
      }
      .task-list-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        padding: 12px;
        border-bottom: 1px solid var(--divider-color);
      }
      .task-list-item:hover {
        background-color: var(--secondary-background-color);
      }
      .task-info {
        display: flex;
        flex-direction: column;
        gap: 4px;
      }
      .task-name {
        font-weight: 500;
      }
      .task-picker-tasks {
        max-height: 400px;
        overflow-y: auto;
      }
      .task-group-header {
        font-weight: 600;
        padding: 12px;
        background-color: var(--secondary-background-color);
        border-bottom: 1px solid var(--divider-color);
        margin-top: 8px;
      }
      .task-group-header:first-child {
        margin-top: 0;
      }
      .task-picker-item {
        padding: 12px;
        border-bottom: 1px solid var(--divider-color);
        cursor: pointer;
      }
      .task-picker-item:hover {
        background-color: var(--secondary-background-color);
      }
      .description-truncate {
        max-width: 300px;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
    `;
  }

  _renderContent() {
    const container = this.shadowRoot.querySelector('.content-container');
    if (!container) return;

    let html = '';

    if (this._loading) {
      html = '<div class="tt-text-center tt-p-40">Loading...</div>';
    } else if (this._error) {
      html = `<div class="error-message">${this._error}</div>`;
    } else {
      switch (this._view) {
        case 'form':
          html = this._renderGoalForm();
          break;
        case 'tasks':
          html = this._renderGoalTasksView();
          break;
        case 'list':
        default:
          html = this._renderGoalsList();
          break;
      }
    }

    container.innerHTML = html;
    this._attachContentEventListeners();
  }

  _renderGoalsList() {
    const visibleGoals = this._config.show_inactive
      ? this._goals
      : this._goals.filter(g => g.is_active);

    if (visibleGoals.length === 0) {
      return `
        <div class="empty-state">
          <p>No goals yet. Create one to get started!</p>
          <button class="tt-btn tt-btn--primary" data-action="create">Create Goal</button>
        </div>
      `;
    }

    return `
      <div class="tt-flex-row tt-justify-between tt-mb-16">
        <button class="tt-btn tt-btn--primary" data-action="create">Create Goal</button>
      </div>
      <table class="goals-table">
        <thead>
          <tr>
            <th>Name</th>
            <th>Description</th>
            <th>Priority</th>
            <th>Tasks</th>
            <th>Status</th>
            <th>Actions</th>
          </tr>
        </thead>
        <tbody>
          ${visibleGoals.map(goal => this._renderGoalRow(goal)).join('')}
        </tbody>
      </table>
    `;
  }

  _renderGoalRow(goal) {
    const priorityLabels = { 1: 'High', 2: 'Medium', 3: 'Low' };
    const priorityClasses = { 1: 'high', 2: 'medium', 3: 'low' };
    const priorityLabel = priorityLabels[goal.priority] || 'Medium';
    const priorityClass = priorityClasses[goal.priority] || 'medium';
    const taskCount = goal.task_count || 0;
    const description = goal.description || '';
    const truncatedDesc = description.length > 50
      ? description.substring(0, 50) + '...'
      : description;

    return `
      <tr>
        <td><strong>${goal.name}</strong></td>
        <td><span class="description-truncate" title="${description}">${truncatedDesc}</span></td>
        <td><span class="badge badge--${priorityClass}">${priorityLabel}</span></td>
        <td>${taskCount}</td>
        <td><span class="badge badge--${goal.is_active ? 'active' : 'inactive'}">${goal.is_active ? 'Active' : 'Inactive'}</span></td>
        <td>
          <div class="goal-actions">
            <button class="tt-btn" data-action="edit" data-goal-id="${goal.id}">Edit</button>
            <button class="tt-btn" data-action="manage-tasks" data-goal-id="${goal.id}">Manage Tasks</button>
            <button class="tt-btn" data-action="delete" data-goal-id="${goal.id}">Delete</button>
          </div>
        </td>
      </tr>
    `;
  }

  _renderGoalForm() {
    const isEdit = this._editingGoal && this._editingGoal.id;
    const title = isEdit ? `Edit Goal: ${this._editingGoal.name}` : 'Create Goal';
    const name = this._editingGoal?.name || '';
    const description = this._editingGoal?.description || '';
    const priority = this._editingGoal?.priority || 2;
    const isActive = this._editingGoal?.is_active !== undefined ? this._editingGoal.is_active : true;

    return `
      <div class="tt-section">
        <h4>${title}</h4>
        <form id="goal-form">
          <div class="tt-form-row">
            <label class="tt-label">Name *</label>
            <input type="text" class="tt-input" id="goal-name" value="${name}" required />
          </div>
          <div class="tt-form-row">
            <label class="tt-label">Description</label>
            <textarea class="tt-textarea" id="goal-description" rows="3">${description}</textarea>
          </div>
          <div class="tt-form-row">
            <label class="tt-label">Priority</label>
            <select class="tt-select" id="goal-priority">
              <option value="1" ${priority === 1 ? 'selected' : ''}>High</option>
              <option value="2" ${priority === 2 ? 'selected' : ''}>Medium</option>
              <option value="3" ${priority === 3 ? 'selected' : ''}>Low</option>
            </select>
          </div>
          <div class="tt-form-row">
            <label class="tt-label">
              <input type="checkbox" class="tt-checkbox" id="goal-active" ${isActive ? 'checked' : ''} />
              Active
            </label>
          </div>
          <div class="tt-flex-row tt-gap-8">
            <button type="submit" class="tt-btn tt-btn--primary">Save</button>
            <button type="button" class="tt-btn" data-action="cancel">Cancel</button>
          </div>
        </form>
      </div>
    `;
  }

  _renderGoalTasksView() {
    const goal = this._goals.find(g => g.id === this._selectedGoalId);
    if (!goal) {
      return '<div class="error-message">Goal not found</div>';
    }

    return `
      <div class="breadcrumb">
        <button data-action="back-to-list">Goals</button>
        <span>/</span>
        <span>${goal.name}</span>
        <span>/</span>
        <span>Tasks</span>
      </div>
      <div class="tt-flex-row tt-justify-between tt-mb-16">
        <h4>Associated Tasks</h4>
        <button class="tt-btn tt-btn--primary" data-action="add-task">Add Task</button>
      </div>
      ${this._goalTasks.length === 0 ? `
        <div class="empty-state">
          <p>No tasks associated with this goal yet.</p>
        </div>
      ` : `
        <div>
          ${this._goalTasks.map(assoc => this._renderGoalTaskItem(assoc)).join('')}
        </div>
      `}
      ${this._showTaskPicker ? this._renderTaskPickerModal() : ''}
    `;
  }

  _renderGoalTaskItem(assoc) {
    const typeLabels = { recurring: 'Recurring', selfcare: 'Self-Care', adhoc: 'Ad-Hoc' };
    const taskType = assoc.task_type || 'unknown';
    const typeLabel = typeLabels[taskType] || taskType;

    return `
      <div class="task-list-item">
        <div class="task-info">
          <div class="task-name">${assoc.task_name}</div>
          <span class="badge badge--${taskType}">${typeLabel}</span>
        </div>
        <button class="tt-btn" data-action="remove-task" data-association-id="${assoc.id}">Remove</button>
      </div>
    `;
  }

  _renderTaskPickerModal() {
    const filteredTasks = this._filterTasksForPicker();

    return `
      <div class="tt-modal tt-modal--visible">
        <div class="tt-modal__content tt-modal__content--w-600">
          <div class="tt-flex-row tt-justify-between tt-mb-16">
            <h4>Select Task</h4>
            <button class="tt-btn" data-action="close-picker">Close</button>
          </div>
          <div class="tt-form-row">
            <input type="text" class="tt-input" id="task-filter" placeholder="Search tasks..." value="${this._taskFilter}" />
          </div>
          <div class="task-picker-tasks">
            ${this._renderTaskPickerGroups(filteredTasks)}
          </div>
        </div>
      </div>
    `;
  }

  _renderTaskPickerGroups(tasks) {
    const groups = {
      recurring: tasks.filter(t => t.type === 'recurring'),
      selfcare: tasks.filter(t => t.type === 'selfcare'),
      adhoc: tasks.filter(t => t.type === 'adhoc'),
    };

    let html = '';

    if (groups.recurring.length > 0) {
      html += '<div class="task-group-header">Recurring Tasks</div>';
      html += groups.recurring.map(t => this._renderTaskPickerItem(t)).join('');
    }

    if (groups.selfcare.length > 0) {
      html += '<div class="task-group-header">Self-Care Tasks</div>';
      html += groups.selfcare.map(t => this._renderTaskPickerItem(t)).join('');
    }

    if (groups.adhoc.length > 0) {
      html += '<div class="task-group-header">Ad-Hoc Tasks</div>';
      html += groups.adhoc.map(t => this._renderTaskPickerItem(t)).join('');
    }

    if (html === '') {
      html = '<div class="empty-state">No tasks found</div>';
    }

    return html;
  }

  _renderTaskPickerItem(task) {
    return `
      <div class="task-picker-item" data-action="select-task" data-task-type="${task.type}" data-task-id="${task.id}">
        ${task.name}
      </div>
    `;
  }

  _filterTasksForPicker() {
    const filter = this._taskFilter.toLowerCase();
    const associatedTaskIds = new Set(this._goalTasks.map(t => `${t.task_type}:${t.task_id}`));

    return this._allTasks.filter(task => {
      const key = `${task.type}:${task.id}`;
      if (associatedTaskIds.has(key)) return false;
      if (!filter) return true;
      return task.name.toLowerCase().includes(filter);
    });
  }

  _attachContentEventListeners() {
    const container = this.shadowRoot.querySelector('.content-container');
    if (!container) return;

    container.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;
      const goalId = target.dataset.goalId ? parseInt(target.dataset.goalId) : null;
      const associationId = target.dataset.associationId ? parseInt(target.dataset.associationId) : null;
      const taskType = target.dataset.taskType;
      const taskId = target.dataset.taskId ? parseInt(target.dataset.taskId) : null;

      switch (action) {
        case 'create':
          this._view = 'form';
          this._editingGoal = null;
          this._renderContent();
          break;

        case 'edit':
          const goal = this._goals.find(g => g.id === goalId);
          if (goal) {
            this._view = 'form';
            this._editingGoal = { ...goal };
            this._renderContent();
          }
          break;

        case 'delete':
          if (confirm('Are you sure you want to delete this goal?')) {
            await this._deleteGoal(goalId);
          }
          break;

        case 'manage-tasks':
          this._selectedGoalId = goalId;
          this._view = 'tasks';
          await this._fetchGoalTasks(goalId);
          this._renderContent();
          break;

        case 'cancel':
        case 'back-to-list':
          this._view = 'list';
          this._editingGoal = null;
          this._selectedGoalId = null;
          this._goalTasks = [];
          this._showTaskPicker = false;
          this._taskFilter = '';
          this._renderContent();
          break;

        case 'add-task':
          await this._fetchAllTasks();
          this._showTaskPicker = true;
          this._renderContent();
          break;

        case 'close-picker':
          this._showTaskPicker = false;
          this._taskFilter = '';
          this._renderContent();
          break;

        case 'select-task':
          await this._associateTask(this._selectedGoalId, taskType, taskId);
          break;

        case 'remove-task':
          if (confirm('Remove this task from the goal?')) {
            await this._removeTask(this._selectedGoalId, associationId);
          }
          break;
      }
    });

    // Handle form submission
    const form = container.querySelector('#goal-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this._handleFormSubmit();
      });
    }

    // Handle task filter input
    const filterInput = container.querySelector('#task-filter');
    if (filterInput) {
      filterInput.addEventListener('input', (e) => {
        this._taskFilter = e.target.value;
        this._renderContent();
      });
    }
  }

  async _handleFormSubmit() {
    const nameInput = this.shadowRoot.querySelector('#goal-name');
    const descriptionInput = this.shadowRoot.querySelector('#goal-description');
    const priorityInput = this.shadowRoot.querySelector('#goal-priority');
    const activeInput = this.shadowRoot.querySelector('#goal-active');

    const name = nameInput.value.trim();
    if (!name) {
      TaskTrackerUtils.showError('Name is required');
      return;
    }

    const data = {
      name,
      description: descriptionInput.value.trim(),
      priority: parseInt(priorityInput.value),
      is_active: activeInput.checked,
    };

    if (this._editingGoal && this._editingGoal.id) {
      await this._updateGoal(this._editingGoal.id, data);
    } else {
      await this._createGoal(data);
    }
  }

  async _fetchGoals() {
    // Fetch available users if not already loaded
    if (!this._availableUsers || this._availableUsers.length === 0 ||
        !this._enhancedUsers || this._enhancedUsers.length === 0) {
      await this._fetchAvailableUsers();
    }

    // Validate current user configuration before making API calls
    const userValidation = TaskTrackerUtils.validateCurrentUser(this._config, this._hass, this._enhancedUsers);

    if (!userValidation.canMakeRequests) {
      this._error = userValidation.error;
      this._goals = [];
      this._loading = false;
      this._refreshing = false;
      this._initialLoad = false;
      this._renderContent();
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
    this._renderContent();

    try {
      const params = {};

      // Note: Goals API might not support username filtering yet
      // If it does in the future, add: if (userValidation.username) params.username = userValidation.username;

      const response = await this._hass.callService(
        'tasktracker',
        'list_goals',
        params,
        {},
        true,
        true
      );
      const result = ensureServiceSuccess(response, 'Failed to load goals');

      // API returns {goals: [...], count: N}
      const newGoals = result.data && result.data.goals ? result.data.goals : [];

      // Always update goals and re-render on initial load
      if (this._initialLoad || !this._goalsEqual(this._goals, newGoals)) {
        this._goals = newGoals;
        this._loading = false;
        this._refreshing = false;
        this._initialLoad = false;
        this._renderContent();
      } else {
        // Data didn't change, just clear the refreshing state
        this._loading = false;
        this._refreshing = false;
        this._renderContent();
      }
    } catch (error) {
      console.error('Failed to fetch goals:', error);
      this._error = `Failed to load goals: ${error.message}`;
      this._goals = [];
      this._loading = false;
      this._refreshing = false;
      this._initialLoad = false;
      this._renderContent();
    }
  }

  _goalsEqual(goals1, goals2) {
    return TaskTrackerUtils.arraysEqual(goals1, goals2, (g1, g2) => {
      return g1.id === g2.id &&
        g1.name === g2.name &&
        g1.description === g2.description &&
        g1.priority === g2.priority &&
        g1.is_active === g2.is_active;
    });
  }

  async _createGoal(data) {
    try {
      const response = await this._hass.callService(
        'tasktracker',
        'create_goal',
        data,
        {},
        true,
        true
      );
      ensureServiceSuccess(response, 'Failed to create goal');

      TaskTrackerUtils.showSuccess('Goal created');
      this._view = 'list';
      this._editingGoal = null;
      await this._fetchGoals();
    } catch (error) {
      console.error('Failed to create goal:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to create goal');
    }
  }

  async _updateGoal(goalId, data) {
    try {
      const response = await this._hass.callService(
        'tasktracker',
        'update_goal',
        { goal_id: goalId, ...data },
        {},
        true,
        true
      );
      ensureServiceSuccess(response, 'Failed to update goal');

      TaskTrackerUtils.showSuccess('Goal updated');
      this._view = 'list';
      this._editingGoal = null;
      await this._fetchGoals();
    } catch (error) {
      console.error('Failed to update goal:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to update goal');
    }
  }

  async _deleteGoal(goalId) {
    try {
      const response = await this._hass.callService(
        'tasktracker',
        'delete_goal',
        { goal_id: goalId },
        {},
        true,
        true
      );
      ensureServiceSuccess(response, 'Failed to delete goal');

      TaskTrackerUtils.showSuccess('Goal deleted');
      await this._fetchGoals();
    } catch (error) {
      console.error('Failed to delete goal:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to delete goal');
    }
  }

  async _fetchGoalTasks(goalId) {
    try {
      const response = await this._hass.callService(
        'tasktracker',
        'list_goal_tasks',
        { goal_id: goalId },
        {},
        true,
        true
      );
      const result = ensureServiceSuccess(response, 'Failed to load goal tasks');

      this._goalTasks = Array.isArray(result.data) ? result.data : [];
    } catch (error) {
      console.error('Failed to fetch goal tasks:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to load goal tasks');
      this._goalTasks = [];
    }
  }

  async _fetchAllTasks() {
    try {
      const response = await this._hass.callService(
        'tasktracker',
        'get_all_tasks',
        {},
        {},
        true,
        true
      );

      const recurring = (response.recurring_tasks || []).map(t => ({ ...t, type: 'recurring' }));
      const selfcare = (response.selfcare_tasks || []).map(t => ({ ...t, type: 'selfcare' }));
      const adhoc = (response.adhoc_tasks || []).map(t => ({ ...t, type: 'adhoc' }));

      this._allTasks = [...recurring, ...selfcare, ...adhoc];
    } catch (error) {
      console.error('Failed to fetch all tasks:', error);
      this._allTasks = [];
    }
  }

  async _associateTask(goalId, taskType, taskId) {
    try {
      const response = await this._hass.callService(
        'tasktracker',
        'associate_task_with_goal',
        { goal_id: goalId, task_type: taskType, task_id: taskId },
        {},
        true,
        true
      );
      ensureServiceSuccess(response, 'Failed to associate task');

      TaskTrackerUtils.showSuccess('Task associated');
      this._showTaskPicker = false;
      this._taskFilter = '';
      await this._fetchGoalTasks(goalId);
      this._renderContent();
    } catch (error) {
      console.error('Failed to associate task:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to associate task');
    }
  }

  async _removeTask(goalId, associationId) {
    try {
      const response = await this._hass.callService(
        'tasktracker',
        'remove_task_from_goal',
        { goal_id: goalId, association_id: associationId },
        {},
        true,
        true
      );
      ensureServiceSuccess(response, 'Failed to remove task');

      TaskTrackerUtils.showSuccess('Task removed');
      await this._fetchGoalTasks(goalId);
      this._renderContent();
    } catch (error) {
      console.error('Failed to remove task:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to remove task');
    }
  }

  static getConfigElement() {
    return document.createElement('tasktracker-goals-card-editor');
  }
}

/**
 * TaskTrackerGoalsCardEditor
 *
 * Config editor for the Goals Management card.
 */
class TaskTrackerGoalsCardEditor extends TaskTrackerBaseEditor {
  constructor() {
    super();
    this._debounceTimers = {};
  }

  getDefaultConfig() {
    return { ...TaskTrackerGoalsCard.getStubConfig() };
  }

  _render() {
    this.shadowRoot.innerHTML = `
      <style>
        ${TaskTrackerUtils.getCommonConfigStyles()}
      </style>

      <div class="card-config">
        <div class="section-title">Display Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'Show Header',
          'Display card header with title and refresh button',
          TaskTrackerUtils.createCheckboxInput(this._config.show_header, 'show_header')
        )}

        ${TaskTrackerUtils.createConfigRow(
          'Show Inactive Goals',
          'Display inactive goals in the list',
          TaskTrackerUtils.createCheckboxInput(this._config.show_inactive, 'show_inactive')
        )}

        <div class="section-title">User Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'User Filter Mode',
          'Which user\'s goals to display',
          TaskTrackerUtils.createSelectInput(this._config.user_filter_mode, 'user_filter_mode', [
            { value: 'all', label: 'All Users' },
            { value: 'current', label: 'Current User' },
            { value: 'explicit', label: 'Specific User' }
          ])
        )}

        ${this._config.user_filter_mode === 'explicit' ? TaskTrackerUtils.createConfigRow(
          'Username',
          'Specific username to filter goals',
          TaskTrackerUtils.createTextInput(this._config.explicit_user, 'explicit_user', 'Enter username')
        ) : ''}

        <div class="section-title">Behavior Settings</div>

        ${TaskTrackerUtils.createConfigRow(
          'Refresh Interval (seconds)',
          'How often to automatically refresh goal data',
          TaskTrackerUtils.createNumberInput(this._config.refresh_interval, 'refresh_interval', 10, 3600, 10)
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

  _updateConfig(configKey, value) {
    super._updateConfig(configKey, value);
    if (configKey === 'user_filter_mode') {
      this._render();
    }
  }
}

// Register the custom elements
customElements.define('tasktracker-goals-card', TaskTrackerGoalsCard);
customElements.define('tasktracker-goals-card-editor', TaskTrackerGoalsCardEditor);

// Register with window for Home Assistant
window.customCards = window.customCards || [];
window.customCards.push({
  type: 'tasktracker-goals-card',
  name: 'TaskTracker Goals',
  description: 'Manage user goals and task associations',
  preview: true,
});

console.info(
  '%c TaskTracker Goals Card %c Loaded ',
  'color: white; background: #0f9d58; font-weight: 700;',
  'color: #0f9d58; background: white; font-weight: 700;'
);
