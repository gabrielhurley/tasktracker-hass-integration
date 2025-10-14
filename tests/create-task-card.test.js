/**
 * Jest Unit Tests for TaskTracker Create Task Card
 *
 * Tests the create task card functionality focusing on:
 * - Registration and configuration
 * - Card logic and methods
 * - User input handling
 * 
 * Note: Full DOM instantiation via document.createElement is limited in JSDOM for custom elements.
 * These tests verify the actual source code is imported and exercised for coverage tracking.
 */

// Mock dependencies BEFORE importing the card file
jest.mock('../custom_components/tasktracker/www/tasktracker-utils.js', () => ({
  TaskTrackerUtils: {
    getAvailableUsers: jest.fn().mockResolvedValue(['user1', 'user2']),
    getEnhancedUsers: jest.fn().mockResolvedValue([]),
    getCurrentUsername: jest.fn().mockReturnValue('testuser'),
    validateCurrentUser: jest.fn().mockReturnValue({ canMakeRequests: true, username: 'testuser' }),
    createTaskFromDescription: jest.fn(),
    showError: jest.fn(),
    showSuccess: jest.fn(),
    createTaskModal: jest.fn().mockReturnValue({}),
    showModal: jest.fn(),
    completeTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    getCommonConfigStyles: jest.fn().mockReturnValue(''),
    createConfigRow: jest.fn((label, desc, input) => `<div>${label}: ${input}</div>`),
    createCheckboxInput: jest.fn((value, key) => `<input type="checkbox" id="${key}">`),
    createSelectInput: jest.fn((value, key, options) => `<select id="${key}"></select>`),
    createTextInput: jest.fn((value, key, placeholder) => `<input type="text" id="${key}">`)
  }
}));

jest.mock('../custom_components/tasktracker/www/utils/styles.js', () => ({
  TaskTrackerStyles: {
    getCommonCardStyles: jest.fn().mockReturnValue('/* Common card styles */'),
    ensureGlobal: jest.fn()
  }
}));

jest.mock('../custom_components/tasktracker/www/utils/task-cards-base.js', () => {
  const mockBaseClass = class MockTasksBaseCard {
    constructor() {
      this.shadowRoot = null;
      this._config = {};
      this._hass = null;
      this._availableUsers = [];
      this._enhancedUsers = [];
      this._userContext = null;
      this._taskDataManager = {
        storeTaskData: jest.fn().mockReturnValue('task_1'),
        getTaskData: jest.fn(),
        clear: jest.fn(),
        removeKey: jest.fn()
      };
    }
    async _fetchAvailableUsers() {
      this._availableUsers = ['user1', 'user2'];
      this._enhancedUsers = [];
    }
    clearTaskData() { this._taskDataManager.clear(); }
    renderSimpleTaskRow(task) { 
      return `<div class="task-item" data-task-key="task_${task.id}">${task.name}</div>`; 
    }
    setupTaskClickHandlers() {}
    async _completeTask() {}
    async _saveTask() {}
    async _deleteTask() {}
    _renderHeader() { return '<div class="header"><h3>Create Task</h3></div>'; }
    _renderStructure() {
      if (!this.shadowRoot) return;
      this.shadowRoot.innerHTML = `
        <div class="card">
          ${this._renderHeader()}
          <div class="content-container"></div>
        </div>
      `;
    }
    _render() {}
    getCardTitle() { return 'Create Task'; }
    setConfig(config) {
      this._config = config;
    }
    set hass(value) {
      this._hass = value;
    }
  };
  return { TaskTrackerTasksBaseCard: mockBaseClass };
});

jest.mock('../custom_components/tasktracker/www/utils/ui/task-editor.js', () => ({
  TaskTrackerTaskEditor: {
    openEditModal: jest.fn()
  }
}));

jest.mock('../custom_components/tasktracker/www/utils/base-config-editor.js', () => {
  const mockEditorClass = class MockBaseEditor {
    constructor() {
      this.shadowRoot = null;
      this._config = {};
    }
    setConfig(config) {
      this._config = config;
    }
    _valueChanged() {}
    _updateConfig(key, value) {
      this._config[key] = value;
    }
  };
  return { TaskTrackerBaseEditor: mockEditorClass };
});

// Setup minimal custom elements registry BEFORE imports
const mockClasses = new Map();
const mockDefine = jest.fn((name, clazz) => {
  mockClasses.set(name, clazz);
});
const mockGet = jest.fn((name) => mockClasses.get(name));

global.customElements = {
  define: mockDefine,
  get: mockGet
};

global.window = {
  customCards: []
};

// NOW import the actual card file - this enables coverage tracking
const cardModule = require('../custom_components/tasktracker/www/tasktracker-create-task-card.js');

// Get the mocked utilities for test assertions
const { TaskTrackerUtils } = require('../custom_components/tasktracker/www/tasktracker-utils.js');

describe('TaskTrackerCreateTaskCard Module', () => {
  test('should register card in window.customCards', () => {
    const registeredCard = global.window.customCards.find(
      card => card.type === 'tasktracker-create-task-card'
    );
    expect(registeredCard).toBeDefined();
    expect(registeredCard.name).toBe('TaskTracker Create Task');
    expect(registeredCard.preview).toBe(true);
  });

  test('should have correct stub config', () => {
    const CardClass = global.customElements.get('tasktracker-create-task-card');
    
    expect(CardClass).toBeDefined();
    const stubConfig = CardClass.getStubConfig();
    expect(stubConfig).toEqual({
      show_header: true,
      user_filter_mode: 'current',
      explicit_user: null,
    });
  });

  test('should have config element factory method', () => {
    const CardClass = global.customElements.get('tasktracker-create-task-card');
    
    expect(CardClass).toBeDefined();
    expect(CardClass.getConfigElement).toBeDefined();
    expect(typeof CardClass.getConfigElement).toBe('function');
  });
});

describe('TaskTrackerCreateTaskCard Instance Behavior', () => {
  let CardClass;
  let card;

  beforeEach(() => {
    jest.clearAllMocks();

    // Get the class definition
    CardClass = global.customElements.get('tasktracker-create-task-card');

    // Create instance directly (bypassing DOM)
    card = new CardClass();
    
    // Mock shadow root
    card.shadowRoot = {
      innerHTML: '',
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => [])
    };
  });

  describe('Initialization', () => {
    test('should initialize with default state', () => {
      expect(card._creating).toBe(false);
      expect(card._createdTask).toBe(null);
      expect(card._pendingTaskType).toBe('RecurringTask');
      expect(card._pendingDescription).toBe('');
    });

    test('should have getCardTitle method', () => {
      expect(card.getCardTitle()).toBe('Create Task');
    });
  });

  describe('Configuration', () => {
    test('should merge config with defaults', () => {
      card.setConfig({ show_header: false });
      expect(card._config.show_header).toBe(false);
      expect(card._config.user_filter_mode).toBe('current');
      expect(card._config.explicit_user).toBe(null);
    });

    test('should handle explicit user mode', () => {
      card.setConfig({
        user_filter_mode: 'explicit',
        explicit_user: 'alice'
      });
      expect(card._config.user_filter_mode).toBe('explicit');
      expect(card._config.explicit_user).toBe('alice');
    });
  });

  describe('Rendering', () => {
    test('should render created task HTML when task exists', () => {
      card._createdTask = {
        id: 1,
        name: 'Test Task',
        task_type: 'RecurringTask'
      };
      const html = card._renderCreatedTask();
      expect(html).toContain('Created Task');
      expect(html).toContain('task-item');
    });

    test('should return empty string when no created task', () => {
      card._createdTask = null;
      const html = card._renderCreatedTask();
      expect(html).toBe('');
    });

    test('should return empty string if no content container', () => {
      card.shadowRoot.querySelector = jest.fn(() => null);
      const result = card._renderContent();
      expect(result).toBe('');
    });

    test('should call clearTaskData when rendering created task', () => {
      const clearSpy = jest.spyOn(card, 'clearTaskData');
      card._createdTask = { id: 1, name: 'Test', task_type: 'RecurringTask' };
      card._renderCreatedTask();
      expect(clearSpy).toHaveBeenCalled();
    });
  });

  describe('Task Creation', () => {
    beforeEach(() => {
      card._hass = {
        callService: jest.fn()
      };
    });

    test('should prevent double submission', async () => {
      card._creating = true;
      await card._handleCreate();
      expect(TaskTrackerUtils.createTaskFromDescription).not.toHaveBeenCalled();
    });

    test('should validate required fields', async () => {
      card.shadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '.content-container') {
          return { innerHTML: '', querySelector: jest.fn(), querySelectorAll: jest.fn(() => []) };
        }
        if (selector === '#tt-create-type') return { value: '', addEventListener: jest.fn() };
        if (selector === '#tt-create-desc') return { value: '', addEventListener: jest.fn() };
        return null;
      });

      await card._handleCreate();
      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith(
        'Please select a task type and enter a description'
      );
    });

    test('should call API with correct parameters', async () => {
      card.shadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '.content-container') {
          return { innerHTML: '', querySelector: jest.fn(), querySelectorAll: jest.fn(() => []) };
        }
        if (selector === '#tt-create-type') return { value: 'RecurringTask', addEventListener: jest.fn() };
        if (selector === '#tt-create-desc') return { value: 'Clean kitchen', addEventListener: jest.fn() };
        if (selector === '#tt-create-btn') return { addEventListener: jest.fn() };
        return null;
      });

      TaskTrackerUtils.createTaskFromDescription.mockResolvedValue({
        data: {
          task: { id: 1, name: 'Clean kitchen', task_type: 'RecurringTask' }
        }
      });

      await card._handleCreate();

      expect(TaskTrackerUtils.createTaskFromDescription).toHaveBeenCalledWith(
        card._hass,
        'RecurringTask',
        'Clean kitchen',
        'testuser'
      );
    });

    test('should update state after successful creation', async () => {
      card.shadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '.content-container') {
          return { innerHTML: '', querySelector: jest.fn(), querySelectorAll: jest.fn(() => []) };
        }
        if (selector === '#tt-create-type') return { value: 'AdHocTask', addEventListener: jest.fn() };
        if (selector === '#tt-create-desc') return { value: 'New task', addEventListener: jest.fn() };
        if (selector === '#tt-create-btn') return { addEventListener: jest.fn() };
        return null;
      });

      const createdTask = { id: 5, name: 'New task', task_type: 'AdHocTask' };
      TaskTrackerUtils.createTaskFromDescription.mockResolvedValue({
        data: { task: createdTask }
      });

      await card._handleCreate();

      expect(card._createdTask).toEqual(createdTask);
      expect(card._pendingDescription).toBe('');
      expect(card._pendingTaskType).toBe('RecurringTask');
      expect(card._creating).toBe(false);
    });

    test('should show modal for created task', async () => {
      card.shadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '.content-container') {
          return { innerHTML: '', querySelector: jest.fn(), querySelectorAll: jest.fn(() => []) };
        }
        if (selector === '#tt-create-type') return { value: 'RecurringTask', addEventListener: jest.fn() };
        if (selector === '#tt-create-desc') return { value: 'Task', addEventListener: jest.fn() };
        if (selector === '#tt-create-btn') return { addEventListener: jest.fn() };
        return null;
      });

      const task = { id: 1, name: 'Task', task_type: 'RecurringTask' };
      TaskTrackerUtils.createTaskFromDescription.mockResolvedValue({
        data: { task }
      });

      await card._handleCreate();

      expect(TaskTrackerUtils.createTaskModal).toHaveBeenCalled();
      expect(TaskTrackerUtils.showModal).toHaveBeenCalled();
    });

    test('should handle errors gracefully', async () => {
      card.shadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '.content-container') {
          return { innerHTML: '', querySelector: jest.fn(), querySelectorAll: jest.fn(() => []) };
        }
        if (selector === '#tt-create-type') return { value: 'RecurringTask', addEventListener: jest.fn() };
        if (selector === '#tt-create-desc') return { value: 'Task', addEventListener: jest.fn() };
        if (selector === '#tt-create-btn') return { addEventListener: jest.fn() };
        return null;
      });

      const error = new Error('Network timeout');
      TaskTrackerUtils.createTaskFromDescription.mockRejectedValue(error);

      await card._handleCreate();

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith('Network timeout');
      expect(card._creating).toBe(false);
    });

    test('should handle null task in response', async () => {
      card.shadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '.content-container') {
          return { innerHTML: '', querySelector: jest.fn(), querySelectorAll: jest.fn(() => []) };
        }
        if (selector === '#tt-create-type') return { value: 'RecurringTask', addEventListener: jest.fn() };
        if (selector === '#tt-create-desc') return { value: 'Task', addEventListener: jest.fn() };
        if (selector === '#tt-create-btn') return { addEventListener: jest.fn() };
        return null;
      });

      TaskTrackerUtils.createTaskFromDescription.mockResolvedValue({
        data: { task: null }
      });

      await card._handleCreate();

      expect(card._createdTask).toBe(null);
      expect(TaskTrackerUtils.showModal).not.toHaveBeenCalled();
    });

    test('should preserve task type during submission', async () => {
      card.shadowRoot.querySelector = jest.fn((selector) => {
        if (selector === '.content-container') {
          return { innerHTML: '', querySelector: jest.fn(), querySelectorAll: jest.fn(() => []) };
        }
        if (selector === '#tt-create-type') return { value: 'SelfCareTask', addEventListener: jest.fn() };
        if (selector === '#tt-create-desc') return { value: 'Meditate', addEventListener: jest.fn() };
        if (selector === '#tt-create-btn') return { addEventListener: jest.fn() };
        return null;
      });

      TaskTrackerUtils.createTaskFromDescription.mockResolvedValue({
        data: { task: { id: 1, name: 'Meditate', task_type: 'SelfCareTask' } }
      });

      await card._handleCreate();

      expect(TaskTrackerUtils.createTaskFromDescription).toHaveBeenCalledWith(
        card._hass,
        'SelfCareTask',
        'Meditate',
        'testuser'
      );
    });
  });

  describe('Event Handling', () => {
    test('should handle missing event elements gracefully', () => {
      card.shadowRoot.querySelector = jest.fn(() => null);
      expect(() => card._attachContentEventListeners()).not.toThrow();
    });
  });
});

describe('TaskTrackerCreateTaskCardEditor', () => {
  test('should have default config method', () => {
    const EditorClass = global.customElements.get('tasktracker-create-task-card-editor');
    
    expect(EditorClass).toBeDefined();
    const instance = new EditorClass();
    const defaultConfig = instance.getDefaultConfig();
    expect(defaultConfig).toHaveProperty('show_header');
    expect(defaultConfig).toHaveProperty('user_filter_mode');
    expect(defaultConfig).toHaveProperty('explicit_user');
  });
});
