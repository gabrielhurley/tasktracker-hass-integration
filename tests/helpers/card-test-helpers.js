/**
 * Test Helpers for TaskTracker Custom Lovelace Cards
 *
 * Provides reusable setup and utilities for testing custom cards in Jest.
 * Handles common mocking patterns, shadow DOM setup, and test assertions.
 */

/**
 * Setup global mocks for card testing
 * Call this BEFORE importing any card files
 *
 * @returns {Object} Mock instances and utilities
 */
function setupCardTestEnvironment() {
  // Mock TaskTrackerUtils
  const mockUtils = {
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
  };

  jest.mock('../../custom_components/tasktracker/www/tasktracker-utils.js', () => ({
    TaskTrackerUtils: mockUtils
  }));

  // Mock TaskTrackerStyles
  const mockStyles = {
    getCommonCardStyles: jest.fn().mockReturnValue('/* Common card styles */'),
    ensureGlobal: jest.fn()
  };

  jest.mock('../../custom_components/tasktracker/www/utils/styles.js', () => ({
    TaskTrackerStyles: mockStyles
  }));

  // Mock TaskTrackerTasksBaseCard
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
    _renderHeader() { return '<div class="header"><h3>Test Card</h3></div>'; }
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
    getCardTitle() { return 'Test Card'; }
    setConfig(config) {
      this._config = config;
    }
    set hass(value) {
      this._hass = value;
    }
  };

  jest.mock('../../custom_components/tasktracker/www/utils/task-cards-base.js', () => ({
    TaskTrackerTasksBaseCard: mockBaseClass
  }));

  // Mock TaskTrackerTaskEditor
  jest.mock('../../custom_components/tasktracker/www/utils/ui/task-editor.js', () => ({
    TaskTrackerTaskEditor: {
      openEditModal: jest.fn()
    }
  }));

  // Mock TaskTrackerBaseEditor
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

  jest.mock('../../custom_components/tasktracker/www/utils/base-config-editor.js', () => ({
    TaskTrackerBaseEditor: mockEditorClass
  }));

  // Setup custom elements registry
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

  return {
    mockUtils,
    mockStyles,
    mockBaseClass,
    mockEditorClass,
    mockDefine,
    mockGet,
    mockClasses
  };
}

/**
 * Create a card instance with mocked shadow root
 *
 * @param {string} cardType - The custom element name (e.g., 'tasktracker-daily-plan-card')
 * @returns {Object} Card instance with mocked shadowRoot
 */
function createCardInstance(cardType) {
  const CardClass = global.customElements.get(cardType);
  if (!CardClass) {
    throw new Error(`Card type "${cardType}" not found in custom elements registry`);
  }

  const card = new CardClass();

  // Mock shadow root with common query methods
  card.shadowRoot = {
    innerHTML: '',
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => [])
  };

  return card;
}

/**
 * Setup querySelector mock with a selector map
 *
 * @param {Object} card - The card instance
 * @param {Object} selectorMap - Map of selector strings to mock elements
 *
 * @example
 * mockShadowQuery(card, {
 *   '#submit-btn': { value: 'test', addEventListener: jest.fn() },
 *   '.content-container': { innerHTML: '', querySelector: jest.fn() },
 *   '#input-field': { value: '', addEventListener: jest.fn() }
 * });
 */
function mockShadowQuery(card, selectorMap) {
  card.shadowRoot.querySelector = jest.fn((selector) => {
    return selectorMap[selector] || null;
  });
}

/**
 * Create a mock HASS object
 *
 * @param {Object} overrides - Optional overrides for specific properties
 * @returns {Object} Mock HASS instance
 */
function createMockHass(overrides = {}) {
  return {
    callService: jest.fn(),
    states: {},
    connection: {
      subscribeMessage: jest.fn(() => Promise.resolve(() => {}))
    },
    ...overrides
  };
}

/**
 * Common assertion: Check if card is registered in window.customCards
 *
 * @param {string} cardType - The custom element name
 * @param {string} expectedName - Expected display name
 */
function expectCardRegistered(cardType, expectedName) {
  const registeredCard = global.window.customCards.find(
    card => card.type === cardType
  );
  expect(registeredCard).toBeDefined();
  expect(registeredCard.name).toBe(expectedName);
  expect(registeredCard.preview).toBe(true);
}

/**
 * Common assertion: Check stub config structure
 *
 * @param {string} cardType - The custom element name
 * @param {Object} expectedConfig - Expected default configuration
 */
function expectStubConfig(cardType, expectedConfig) {
  const CardClass = global.customElements.get(cardType);
  expect(CardClass).toBeDefined();
  const stubConfig = CardClass.getStubConfig();
  expect(stubConfig).toMatchObject(expectedConfig);
}

/**
 * Common assertion: Check if card has config element
 *
 * @param {string} cardType - The custom element name
 */
function expectHasConfigElement(cardType) {
  const CardClass = global.customElements.get(cardType);
  expect(CardClass).toBeDefined();
  expect(CardClass.getConfigElement).toBeDefined();
  expect(typeof CardClass.getConfigElement).toBe('function');
}

/**
 * Create a mock content container element
 * Useful for cards that render into .content-container
 *
 * @returns {Object} Mock container element
 */
function createMockContentContainer() {
  return {
    innerHTML: '',
    querySelector: jest.fn(),
    querySelectorAll: jest.fn(() => [])
  };
}

/**
 * Create a mock input element
 *
 * @param {string} initialValue - Initial value of the input
 * @returns {Object} Mock input element
 */
function createMockInput(initialValue = '') {
  return {
    value: initialValue,
    addEventListener: jest.fn()
  };
}

/**
 * Create a mock button element
 *
 * @returns {Object} Mock button element
 */
function createMockButton() {
  return {
    addEventListener: jest.fn(),
    disabled: false
  };
}

/**
 * Wait for all promises to resolve
 * Useful for testing async operations
 *
 * @returns {Promise<void>}
 */
async function flushPromises() {
  return new Promise(resolve => setImmediate(resolve));
}

module.exports = {
  // Setup
  setupCardTestEnvironment,
  createCardInstance,
  mockShadowQuery,
  createMockHass,

  // Assertions
  expectCardRegistered,
  expectStubConfig,
  expectHasConfigElement,

  // Mock creators
  createMockContentContainer,
  createMockInput,
  createMockButton,

  // Utilities
  flushPromises
};
