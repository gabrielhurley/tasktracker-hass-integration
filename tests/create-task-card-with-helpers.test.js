/**
 * Example: TaskTracker Create Task Card Tests Using Helpers
 *
 * This demonstrates how to use the test helpers to write cleaner, more maintainable tests.
 * Compare with create-task-card.test.js to see the reduction in boilerplate.
 */

const {
  setupCardTestEnvironment,
  createCardInstance,
  mockShadowQuery,
  createMockHass,
  expectCardRegistered,
  expectStubConfig,
  expectHasConfigElement,
  createMockContentContainer,
  createMockInput,
  createMockButton
} = require('./helpers/card-test-helpers');

// Setup mocks BEFORE importing the card
setupCardTestEnvironment();

// NOW import the actual card file
require('../custom_components/tasktracker/www/tasktracker-create-task-card.js');

// Get mocked utilities for assertions
const { TaskTrackerUtils } = require('../custom_components/tasktracker/www/tasktracker-utils.js');

const CARD_TYPE = 'tasktracker-create-task-card';

describe('TaskTrackerCreateTaskCard (with helpers)', () => {
  describe('Module Registration', () => {
    test('should register in window.customCards', () => {
      expectCardRegistered(CARD_TYPE, 'TaskTracker Create Task');
    });

    test('should have correct stub config', () => {
      expectStubConfig(CARD_TYPE, {
        show_header: true,
        user_filter_mode: 'current',
        explicit_user: null
      });
    });

    test('should have config element', () => {
      expectHasConfigElement(CARD_TYPE);
    });
  });

  describe('Card Behavior', () => {
    let card;
    let mockHass;

    beforeEach(() => {
      jest.clearAllMocks();
      card = createCardInstance(CARD_TYPE);
      mockHass = createMockHass();
      card._hass = mockHass;
    });

    test('should initialize with default state', () => {
      expect(card._creating).toBe(false);
      expect(card._createdTask).toBe(null);
      expect(card._pendingTaskType).toBe('RecurringTask');
      expect(card._pendingDescription).toBe('');
    });

    test('should merge config with defaults', () => {
      card.setConfig({ show_header: false });
      expect(card._config.show_header).toBe(false);
      expect(card._config.user_filter_mode).toBe('current');
    });

    test('should render created task when present', () => {
      card._createdTask = { id: 1, name: 'Test Task', task_type: 'RecurringTask' };
      const html = card._renderCreatedTask();
      expect(html).toContain('Created Task');
      expect(html).toContain('task-item');
    });

    test('should validate required fields', async () => {
      mockShadowQuery(card, {
        '.content-container': createMockContentContainer(),
        '#tt-create-type': createMockInput(''),
        '#tt-create-desc': createMockInput('')
      });

      await card._handleCreate();

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith(
        'Please select a task type and enter a description'
      );
    });

    test('should prevent double submission', async () => {
      card._creating = true;
      await card._handleCreate();
      expect(TaskTrackerUtils.createTaskFromDescription).not.toHaveBeenCalled();
    });

    test('should call API with correct parameters', async () => {
      mockShadowQuery(card, {
        '.content-container': createMockContentContainer(),
        '#tt-create-type': createMockInput('RecurringTask'),
        '#tt-create-desc': createMockInput('Clean kitchen'),
        '#tt-create-btn': createMockButton()
      });

      TaskTrackerUtils.createTaskFromDescription.mockResolvedValue({
        data: { task: { id: 1, name: 'Clean kitchen', task_type: 'RecurringTask' } }
      });

      await card._handleCreate();

      expect(TaskTrackerUtils.createTaskFromDescription).toHaveBeenCalledWith(
        mockHass,
        'RecurringTask',
        'Clean kitchen',
        'testuser'
      );
    });

    test('should update state after successful creation', async () => {
      mockShadowQuery(card, {
        '.content-container': createMockContentContainer(),
        '#tt-create-type': createMockInput('AdHocTask'),
        '#tt-create-desc': createMockInput('New task'),
        '#tt-create-btn': createMockButton()
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
      mockShadowQuery(card, {
        '.content-container': createMockContentContainer(),
        '#tt-create-type': createMockInput('RecurringTask'),
        '#tt-create-desc': createMockInput('Task'),
        '#tt-create-btn': createMockButton()
      });

      TaskTrackerUtils.createTaskFromDescription.mockResolvedValue({
        data: { task: { id: 1, name: 'Task', task_type: 'RecurringTask' } }
      });

      await card._handleCreate();

      expect(TaskTrackerUtils.createTaskModal).toHaveBeenCalled();
      expect(TaskTrackerUtils.showModal).toHaveBeenCalled();
    });

    test('should handle errors gracefully', async () => {
      mockShadowQuery(card, {
        '.content-container': createMockContentContainer(),
        '#tt-create-type': createMockInput('RecurringTask'),
        '#tt-create-desc': createMockInput('Task'),
        '#tt-create-btn': createMockButton()
      });

      TaskTrackerUtils.createTaskFromDescription.mockRejectedValue(
        new Error('Network timeout')
      );

      await card._handleCreate();

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith('Network timeout');
      expect(card._creating).toBe(false);
    });
  });

  describe('Editor', () => {
    test('should have default config', () => {
      const EditorClass = global.customElements.get('tasktracker-create-task-card-editor');
      expect(EditorClass).toBeDefined();

      const instance = new EditorClass();
      const defaultConfig = instance.getDefaultConfig();

      expect(defaultConfig).toHaveProperty('show_header');
      expect(defaultConfig).toHaveProperty('user_filter_mode');
      expect(defaultConfig).toHaveProperty('explicit_user');
    });
  });
});
