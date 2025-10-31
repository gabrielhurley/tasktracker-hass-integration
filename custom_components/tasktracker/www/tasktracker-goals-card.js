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
    this._selectedGoal = null; // Currently selected goal for modal
    this._modalMode = null; // null, 'view', 'edit', 'create', 'tasks'
    this._goalTasks = [];
    this._taskFilter = '';
    this._showTaskPicker = false;
    this._availableUsers = [];
    this._enhancedUsers = [];
    this._initialLoad = true;
    this._refreshing = false;
    this._contentListenerAttached = false;
    this._filterDebounceTimer = null;
  }

  static getStubConfig() {
    return {
      show_header: true,
      show_inactive: true,
      refresh_interval: 300,
      user_filter_mode: 'current', // 'all', 'current', 'explicit'
      explicit_user: null
    };
  }

  getCardTitle() {
    return 'Goals';
  }

  getHeaderActions() {
    return `
      <button class="tt-btn tt-btn--link" data-action="create-goal" title="Create Goal">+</button>
    `;
  }

  async onAutoRefresh() {
    await this._fetchGoals();
  }

  setConfig(config) {
    this._config = {
      show_header: config.show_header !== false,
      show_inactive: config.show_inactive !== false, // Default to true
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

  _renderContent() {
    const container = this.shadowRoot.querySelector('.content-container');
    if (!container) return;

    let html = '';

    if (this._loading) {
      html = '<div class="tt-text-center tt-p-40">Loading...</div>';
    } else if (this._error) {
      html = `<div class="error">${this._error}</div>`;
    } else {
      html = this._renderGoalsList();
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
        <div class="no-tasks">
          <p>No goals yet. Click + to create one.</p>
        </div>
      `;
    }

    return visibleGoals.map(goal => this._renderGoalRow(goal)).join('');
  }

  _renderGoalRow(goal) {
    const priorityClasses = { 1: 'priority-high', 2: 'priority-medium', 3: 'priority-low' };
    const priorityClass = priorityClasses[goal.priority] || 'priority-medium';
    const taskCount = goal.task_count || 0;
    const inactiveClass = goal.is_active ? '' : 'inactive';

    return `
      <div class="task-item ${priorityClass} ${inactiveClass}" data-action="view-goal" data-goal-id="${goal.id}">
        <div class="task-content">
          <div class="task-name">${goal.name}</div>
          <div class="task-metadata">
            ${taskCount} task${taskCount !== 1 ? 's' : ''}
            ${goal.is_active ? '' : ' • Inactive'}
          </div>
        </div>
      </div>
    `;
  }

  _showGoalModal(goalId = null, mode = 'view') {
    TaskTrackerStyles.ensureGlobal();

    let goal = null;
    if (goalId) {
      goal = this._goals.find(g => g.id === goalId);
      if (!goal && mode !== 'create') {
        TaskTrackerUtils.showError('Goal not found');
        return;
      }
    }

    this._selectedGoal = goal;
    this._modalMode = mode;

    const modal = this._renderGoalModal(goal, mode);
    TaskTrackerUtils.showModal(modal);
  }

  _renderGoalModal(goal, mode) {
    const modal = document.createElement('div');
    modal.className = 'tt-modal tt-modal--visible';

    const modalContent = document.createElement('div');
    modalContent.className = 'tt-modal__content tt-modal__content--w-600';

    // Header
    const header = document.createElement('div');
    header.className = 'tt-modal__header';
    const title = document.createElement('h3');
    title.className = 'tt-modal__title';

    if (mode === 'create') {
      title.textContent = 'Create Goal';
    } else if (mode === 'edit') {
      title.textContent = `Edit: ${goal.name}`;
    } else {
      title.textContent = goal.name;
    }

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'tt-modal__close';
    header.appendChild(title);
    header.appendChild(closeButton);

    // Body
    const body = document.createElement('div');
    body.className = 'tt-modal__body';

    if (mode === 'view') {
      body.appendChild(this._renderGoalDetails(goal));
    } else {
      body.appendChild(this._renderGoalForm(goal, mode));
    }

    // Footer
    const footer = document.createElement('div');
    footer.className = 'tt-modal__footer';
    footer.appendChild(this._renderGoalModalFooter(goal, mode));

    modalContent.appendChild(header);
    modalContent.appendChild(body);
    modalContent.appendChild(footer);
    modal.appendChild(modalContent);

    // Event listeners
    const closeModal = () => {
      modal.classList.remove('tt-modal--visible');
      setTimeout(() => modal.remove(), 200);
      this._selectedGoal = null;
      this._modalMode = null;
      this._goalTasks = [];
      this._showTaskPicker = false;
      this._taskFilter = '';
      this._currentModal = null;
    };

    closeButton.addEventListener('click', closeModal);
    modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });

    this._attachModalEventListeners(modal, goal, mode, closeModal);

    return modal;
  }

  _renderGoalDetails(goal) {
    const container = document.createElement('div');
    container.className = 'tt-form';

    // Basic Details Section
    const basicSection = document.createElement('div');
    basicSection.className = 'modal-section';
    const basicTitle = document.createElement('div');
    basicTitle.className = 'modal-section-title';
    basicTitle.textContent = 'Basic Information';
    basicSection.appendChild(basicTitle);

    const priorityLabels = { 1: 'High', 2: 'Medium', 3: 'Low' };
    const priorityLabel = priorityLabels[goal.priority] || 'Medium';

    basicSection.innerHTML += `
      <div class="detail-row">
        <div class="detail-label">Priority:</div>
        <div class="detail-value">${priorityLabel}</div>
      </div>
      <div class="detail-row">
        <div class="detail-label">Status:</div>
        <div class="detail-value">${goal.is_active ? 'Active' : 'Inactive'}</div>
      </div>
      ${goal.description ? `
        <div class="detail-row">
          <div class="detail-label">Description:</div>
          <div class="detail-value">${goal.description}</div>
        </div>
      ` : ''}
    `;
    container.appendChild(basicSection);

    // Associated Tasks Section
    const tasksSection = document.createElement('div');
    tasksSection.className = 'modal-section';
    tasksSection.id = 'tasks-section';
    const tasksTitle = document.createElement('div');
    tasksTitle.className = 'modal-section-title';
    tasksTitle.textContent = 'Associated Tasks';
    tasksSection.appendChild(tasksTitle);

    const tasksContainer = document.createElement('div');
    tasksContainer.id = 'tasks-container';
    if (this._goalTasks.length === 0) {
      tasksContainer.innerHTML = '<div class="tt-text-muted">Loading tasks...</div>';
      // Fetch tasks when modal opens
      this._fetchGoalTasks(goal.id).then(() => {
        tasksContainer.innerHTML = this._renderGoalTasksList();
      });
    } else {
      tasksContainer.innerHTML = this._renderGoalTasksList();
    }
    tasksSection.appendChild(tasksContainer);
    container.appendChild(tasksSection);

    return container;
  }

  _renderGoalTasksList() {
    if (this._goalTasks.length === 0) {
      return '<div class="tt-text-muted">No tasks associated with this goal.</div>';
    }

    const typeLabels = { recurringtask: 'Recurring', selfcaretask: 'Self-Care', adhoctask: 'Ad-Hoc' };

    return this._goalTasks.map(assoc => {
      const taskType = assoc.task_type || 'unknown';
      const typeLabel = typeLabels[taskType] || taskType;

      return `
        <div class="task-item">
          <div class="task-content">
            <div class="task-name">${assoc.task_name}</div>
            <div class="task-metadata">
              <span class="badge badge--${taskType}">${typeLabel}</span>
            </div>
          </div>
          <button class="tt-btn" data-action="remove-task" data-association-id="${assoc.id}">Remove</button>
        </div>
      `;
    }).join('');
  }

  _renderGoalForm(goal, mode) {
    const container = document.createElement('form');
    container.className = 'tt-form';
    container.id = 'goal-form';

    const name = goal?.name || '';
    const description = goal?.description || '';
    const priority = goal?.priority || 2;
    const isActive = goal?.is_active !== undefined ? goal.is_active : true;

    container.innerHTML = `
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
    `;

    return container;
  }

  _renderGoalModalFooter(goal, mode) {
    const footer = document.createElement('div');
    footer.className = 'tt-flex-end tt-gap-12';

    if (mode === 'view') {
      footer.innerHTML = `
        <button class="tt-btn" data-action="delete-goal">Delete</button>
        <button class="tt-btn" data-action="edit-goal">Edit</button>
        <button class="tt-btn tt-btn--primary" data-action="add-task-to-goal">Add Task</button>
        <button class="tt-btn" data-action="close-modal">Close</button>
      `;
    } else {
      footer.innerHTML = `
        <button class="tt-btn" data-action="close-modal">Cancel</button>
        <button class="tt-btn tt-btn--primary" data-action="save-goal">Save</button>
      `;
    }

    return footer;
  }

  _attachModalEventListeners(modal, goal, mode, closeModal) {
    const content = modal.querySelector('.tt-modal__content');

    content.addEventListener('click', async (e) => {
      const target = e.target.closest('[data-action]');
      if (!target) return;

      const action = target.dataset.action;

      switch (action) {
        case 'close-modal':
          closeModal();
          break;

        case 'edit-goal':
          closeModal();
          setTimeout(() => this._showGoalModal(goal.id, 'edit'), 200);
          break;

        case 'save-goal':
          e.preventDefault();
          await this._handleGoalFormSubmit(modal, goal, mode);
          closeModal();
          break;

        case 'delete-goal':
          if (confirm(`Delete goal "${goal.name}"?`)) {
            await this._deleteGoal(goal.id);
            closeModal();
          }
          break;

        case 'add-task-to-goal':
          await this._fetchAllTasks();
          this._showTaskPicker = true;
          this._renderTaskPickerInModal(modal, goal);
          break;

        case 'close-picker':
          this._showTaskPicker = false;
          this._taskFilter = '';
          this._removeTaskPickerFromModal(modal);
          break;

        case 'select-task':
          const taskType = target.dataset.taskType;
          const taskId = parseInt(target.dataset.taskId);
          await this._associateTask(goal.id, taskType, taskId);
          this._removeTaskPickerFromModal(modal);
          // Refresh task list in modal
          const tasksContainer = modal.querySelector('#tasks-container');
          if (tasksContainer) {
            tasksContainer.innerHTML = this._renderGoalTasksList();
          }
          break;

        case 'remove-task':
          const associationId = parseInt(target.dataset.associationId);
          await this._removeTask(goal.id, associationId);
          // Refresh task list in modal
          const container = modal.querySelector('#tasks-container');
          if (container) {
            container.innerHTML = this._renderGoalTasksList();
          }
          break;
      }
    });

    // Handle form submission
    const form = modal.querySelector('#goal-form');
    if (form) {
      form.addEventListener('submit', async (e) => {
        e.preventDefault();
        await this._handleGoalFormSubmit(modal, goal, mode);
        closeModal();
      });
    }
  }

  _renderTaskPickerInModal(modal, goal) {
    const body = modal.querySelector('.tt-modal__body .tt-form');
    if (!body) return;

    let pickerSection = modal.querySelector('#task-picker-section');
    if (!pickerSection) {
      pickerSection = document.createElement('div');
      pickerSection.id = 'task-picker-section';
      pickerSection.className = 'modal-section';
      body.appendChild(pickerSection);
    }

    const initialContent = this._taskFilter
      ? this._renderTaskPickerGroups(this._filterTasksForPicker())
      : '<div class="tt-text-muted tt-text-center tt-p-40">Start typing to search for tasks...</div>';

    pickerSection.innerHTML = `
      <div class="modal-section-title">Select Task</div>
      <div class="tt-form-row">
        <input type="text" class="tt-input" id="task-filter" placeholder="Search tasks..." value="${this._taskFilter}" />
      </div>
      <div class="task-picker-tasks" id="task-picker-results">
        ${initialContent}
      </div>
      <div class="tt-flex-end tt-mt-12">
        <button class="tt-btn" data-action="close-picker">Cancel</button>
      </div>
    `;

    // Add input listener for filter
    const filterInput = pickerSection.querySelector('#task-filter');
    if (filterInput) {
      // Store reference to modal for filter updates
      this._currentModal = modal;

      filterInput.addEventListener('input', (e) => {
        this._taskFilter = e.target.value;

        // Directly update the results in the modal
        const resultsContainer = modal.querySelector('#task-picker-results');
        if (resultsContainer) {
          if (this._taskFilter) {
            resultsContainer.innerHTML = this._renderTaskPickerGroups(this._filterTasksForPicker());
          } else {
            resultsContainer.innerHTML = '<div class="tt-text-muted tt-text-center tt-p-40">Start typing to search for tasks...</div>';
          }
        }
      });

      // Auto-focus the input
      filterInput.focus();
    }
  }

  _removeTaskPickerFromModal(modal) {
    const pickerSection = modal.querySelector('#task-picker-section');
    if (pickerSection) {
      pickerSection.remove();
    }
    // Clear filter state
    this._taskFilter = '';
    this._currentModal = null;
  }

  async _handleGoalFormSubmit(modal, goal, mode) {
    const nameInput = modal.querySelector('#goal-name');
    const descriptionInput = modal.querySelector('#goal-description');
    const priorityInput = modal.querySelector('#goal-priority');
    const activeInput = modal.querySelector('#goal-active');

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

    if (mode === 'edit' && goal && goal.id) {
      await this._updateGoal(goal.id, data);
    } else {
      await this._createGoal(data);
    }
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
      html = '<div class="no-tasks">No matching tasks found. Tasks already associated with this goal or not assigned to you are filtered out.</div>';
    }

    return html;
  }

  _renderTaskPickerItem(task) {
    const typeLabels = { recurring: 'Recurring', selfcare: 'Self-Care', adhoc: 'Ad-Hoc' };
    const taskType = task.type || 'unknown';
    const typeLabel = typeLabels[taskType] || taskType;
    const isAssociated = task.isAlreadyAssociated;

    // If already associated, make it non-clickable and add indicator
    const itemClass = isAssociated ? 'task-picker-item task-picker-item--disabled' : 'task-picker-item';
    const action = isAssociated ? '' : `data-action="select-task" data-task-type="${task.type}" data-task-id="${task.id}"`;

    return `
      <div class="${itemClass}" ${action}>
        <div class="task-name">${task.name}</div>
        <div class="task-metadata">
          <span class="badge badge--${taskType}">${typeLabel}</span>
          ${isAssociated ? '<span class="badge badge--associated">Already Associated</span>' : ''}
        </div>
      </div>
    `;
  }

  _filterTasksForPicker() {
    const filter = this._taskFilter.toLowerCase();

    // Normalize task_type from API to match our internal format
    const normalizeTaskType = (apiType) => {
      const typeMap = {
        'recurringtask': 'recurring',
        'selfcaretask': 'selfcare',
        'adhoctask': 'adhoc'
      };
      return typeMap[apiType.toLowerCase()] || apiType;
    };

    // Build set of associated task keys using task_object_id (not task_id or id)
    const associatedTaskIds = new Set(
      this._goalTasks.map(t => {
        const normalizedType = normalizeTaskType(t.task_type);
        const key = `${normalizedType}:${t.task_object_id}`;
        return key;
      })
    );

    const currentUsername = this._getCurrentUsername();

    return this._allTasks
      .filter(task => {
        const key = `${task.type}:${task.id}`;

        // Filter out tasks not assigned to current user
        if (currentUsername && task.assigned_users && !task.assigned_users.includes(currentUsername)) {
          return false;
        }

        // Filter out completed or inactive ad hoc tasks
        if (task.type === 'adhoc') {
          if (task.is_completed || task.is_active === false) {
            return false;
          }
        }

        // If no filter text, don't show any tasks (user must type to search)
        if (!filter) return false;

        // Filter by name
        return task.name.toLowerCase().includes(filter);
      })
      .map(task => {
        // Mark tasks that are already associated
        const key = `${task.type}:${task.id}`;
        const isAssociated = associatedTaskIds.has(key);

        return {
          ...task,
          isAlreadyAssociated: isAssociated
        };
      });
  }

  /**
   * Update only the task picker results without re-rendering the entire modal.
   * This prevents focus loss on the search input.
   */
  _updateTaskPickerResults() {
    const resultsContainer = this.shadowRoot.querySelector('.task-picker-tasks');
    if (!resultsContainer) {
      console.warn('[Goals Card] Results container not found');
      return;
    }

    const filteredTasks = this._filterTasksForPicker();
    resultsContainer.innerHTML = this._renderTaskPickerGroups(filteredTasks);
  }

  /**
   * Handle task filter input with debouncing to prevent excessive updates.
   */
  _handleTaskFilterInput(value) {
    this._taskFilter = value;

    // Clear existing timer
    if (this._filterDebounceTimer) {
      clearTimeout(this._filterDebounceTimer);
    }

    // Debounce the update by 150ms
    this._filterDebounceTimer = setTimeout(() => {
      this._updateTaskPickerResults();
      this._filterDebounceTimer = null;
    }, 150);
  }

  _attachContentEventListeners() {
    const container = this.shadowRoot.querySelector('.content-container');
    if (!container) return;

    // Attach persistent container listener only once
    if (!this._contentListenerAttached) {
      // Handle clicks via event delegation
      container.addEventListener('click', async (e) => {
        const target = e.target.closest('[data-action]');
        if (!target) return;

        const action = target.dataset.action;
        const goalId = target.dataset.goalId ? parseInt(target.dataset.goalId) : null;

        switch (action) {
          case 'view-goal':
            this._showGoalModal(goalId, 'view');
            break;

          case 'create-goal':
            this._showGoalModal(null, 'create');
            break;
        }
      });

      this._contentListenerAttached = true;
    }
  }

  _attachHeaderEventListeners() {
    super._attachHeaderEventListeners();

    // Add listener for create button in header
    const createBtn = this.shadowRoot.querySelector('[data-action="create-goal"]');
    if (createBtn) {
      createBtn.addEventListener('click', () => this._showGoalModal(null, 'create'));
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

      // API returns: { success: true, data: { items: [...], count: N }, user_context: {...} }
      const newGoals = result.data && result.data.items ? result.data.items : [];

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
        g1.is_active === g2.is_active &&
        g1.task_count === g2.task_count;
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
      await this._fetchGoals();
    } catch (error) {
      console.error('Failed to create goal:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to create goal');
      throw error;
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
      await this._fetchGoals();
    } catch (error) {
      console.error('Failed to update goal:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to update goal');
      throw error;
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
      throw error;
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

      // API returns: { success: true, data: { items: [...], count: N }, user_context: {...} }
      if (result.data && result.data.items && Array.isArray(result.data.items)) {
        this._goalTasks = result.data.items;
      } else {
        this._goalTasks = [];
      }
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

      // Handle Home Assistant service response wrapper
      // Response structure: { context: {...}, response: { success: bool, data: {...}, user_context: {...} } }
      let data;
      if (response.response && response.response.data) {
        data = response.response.data;
      } else if (response.response) {
        data = response.response;
      } else {
        data = response;
      }

      // Server API returns paginated response: { items: [...], count: N }
      // Backend now returns all task types with task_type field
      let tasks = [];
      if (data.items && Array.isArray(data.items)) {
        // Map task_type from backend to frontend type
        tasks = data.items.map(t => {
          let type = 'recurring'; // Default
          if (t.task_type === 'SelfCareTask') {
            type = 'selfcare';
          } else if (t.task_type === 'AdHocTask') {
            type = 'adhoc';
          } else if (t.task_type === 'RecurringTask') {
            type = 'recurring';
          }
          return { ...t, type };
        });
      } else {
        // Fallback to old structure (should not be reached)
        console.warn('[Goals Card] Unexpected API response structure, using fallback');
        const recurring = (data.recurring_tasks || []).map(t => ({ ...t, type: 'recurring' }));
        const selfcare = (data.selfcare_tasks || []).map(t => ({ ...t, type: 'selfcare' }));
        const adhoc = (data.adhoc_tasks || []).map(t => ({ ...t, type: 'adhoc' }));
        tasks = [...recurring, ...selfcare, ...adhoc];
      }

      this._allTasks = tasks;
    } catch (error) {
      console.error('[Goals Card] Failed to fetch all tasks:', error);
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
    } catch (error) {
      console.error('Failed to associate task:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to associate task');
      throw error;
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
    } catch (error) {
      console.error('Failed to remove task:', error);
      TaskTrackerUtils.showError(error.message || 'Failed to remove task');
      throw error;
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
    return {
      show_header: true,
      show_inactive: true,
      refresh_interval: 300,
      user_filter_mode: 'current',
      explicit_user: null
    };
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
          'When checked, inactive goals appear with reduced opacity. When unchecked, they are hidden.',
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
