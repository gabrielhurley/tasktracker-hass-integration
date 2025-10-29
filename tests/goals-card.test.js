const {
  setupCardTestEnvironment,
  createCardInstance,
  mockShadowQuery,
  createMockHass,
  expectCardRegistered,
  expectStubConfig,
  createMockInput,
  createMockButton,
  createMockSelect,
  createMockTextarea,
  createMockCheckbox,
} = require('./helpers/card-test-helpers');

setupCardTestEnvironment();
require('../custom_components/tasktracker/www/tasktracker-goals-card.js');
const { TaskTrackerUtils } = require('../custom_components/tasktracker/www/tasktracker-utils.js');

describe('TaskTrackerGoalsCard', () => {
  describe('Module Registration', () => {
    test('should register correctly', () => {
      expectCardRegistered('tasktracker-goals-card', 'TaskTracker Goals');
      expectStubConfig('tasktracker-goals-card', {
        show_header: true,
        show_inactive: false,
        refresh_interval: 300,
      });
    });
  });

  describe('Card Behavior', () => {
    let card, mockHass;

    beforeEach(() => {
      jest.clearAllMocks();
      card = document.createElement('tasktracker-goals-card');
      mockHass = createMockHass();
      card._hass = mockHass;
      card.setConfig({ show_header: true, show_inactive: false });
    });

    test('should initialize with default state', () => {
      expect(card._goals).toEqual([]);
      expect(card._view).toBe('list');
      expect(card._loading).toBe(false);
      expect(card._editingGoal).toBeNull();
    });

    test('should merge config with defaults', () => {
      card.setConfig({ show_header: false });
      expect(card._config.show_header).toBe(false);
      expect(card._config.show_inactive).toBe(false);
    });

    test('should render goals list HTML', () => {
      card._loading = false;
      card._goals = [
        { id: 1, name: 'Test Goal', description: 'Test description', priority: 2, is_active: true, task_count: 3 },
        { id: 2, name: 'Another Goal', description: '', priority: 1, is_active: false, task_count: 0 },
      ];
      card._view = 'list';
      const html = card._renderGoalsList();
      expect(html).toContain('Test Goal');
      expect(html).toContain('goals-table');
    });

    test('should filter inactive goals when config is set', () => {
      card._config = { show_inactive: false };
      card._goals = [
        { id: 1, name: 'Active Goal', priority: 2, is_active: true, task_count: 0 },
        { id: 2, name: 'Inactive Goal', priority: 1, is_active: false, task_count: 0 },
      ];
      const html = card._renderGoalsList();
      expect(html).toContain('Active Goal');
      expect(html).not.toContain('Inactive Goal');
    });

    test('should show inactive goals when config is set', () => {
      card._config = { show_inactive: true };
      card._goals = [
        { id: 1, name: 'Active Goal', priority: 2, is_active: true, task_count: 0 },
        { id: 2, name: 'Inactive Goal', priority: 1, is_active: false, task_count: 0 },
      ];
      const html = card._renderGoalsList();
      expect(html).toContain('Active Goal');
      expect(html).toContain('Inactive Goal');
    });

    test('should render priority badges correctly', () => {
      card._goals = [
        { id: 1, name: 'High Priority', priority: 1, is_active: true, task_count: 0 },
      ];
      const html = card._renderGoalRow(card._goals[0]);
      expect(html).toContain('High');
      expect(html).toContain('badge--high');
    });

    test('should render create goal form', () => {
      card._editingGoal = null;
      const html = card._renderGoalForm();
      expect(html).toContain('Create Goal');
      expect(html).toContain('goal-form');
    });

    test('should render edit goal form with pre-filled data', () => {
      card._editingGoal = {
        id: 1,
        name: 'Test Goal',
        description: 'Test description',
        priority: 1,
        is_active: false,
      };
      const html = card._renderGoalForm();
      expect(html).toContain('Edit Goal');
      expect(html).toContain('Test Goal');
      expect(html).toContain('Test description');
    });

    test('should call create_goal service when submitting new goal', async () => {
      const serviceSpy = jest.fn().mockResolvedValue({});
      mockHass.callService = serviceSpy;
      card._hass = mockHass;

      await card._createGoal({
        name: 'New Goal',
        description: 'New description',
        priority: 2,
        is_active: true,
      });

      expect(serviceSpy).toHaveBeenCalledWith(
        'tasktracker',
        'create_goal',
        {
          name: 'New Goal',
          description: 'New description',
          priority: 2,
          is_active: true,
        },
        {},
        true,
        true
      );
    });

    test('should call update_goal service when submitting edited goal', async () => {
      const serviceSpy = jest.fn().mockResolvedValue({});
      mockHass.callService = serviceSpy;
      card._hass = mockHass;

      await card._updateGoal(1, {
        name: 'Updated Goal',
        description: 'Updated description',
        priority: 1,
        is_active: false,
      });

      expect(serviceSpy).toHaveBeenCalledWith(
        'tasktracker',
        'update_goal',
        {
          goal_id: 1,
          name: 'Updated Goal',
          description: 'Updated description',
          priority: 1,
          is_active: false,
        },
        {},
        true,
        true
      );
    });

    test('should call delete_goal service when deleting', async () => {
      const serviceSpy = jest.fn().mockResolvedValue({});
      mockHass.callService = serviceSpy;
      card._hass = mockHass;

      await card._deleteGoal(1);

      expect(serviceSpy).toHaveBeenCalledWith(
        'tasktracker',
        'delete_goal',
        { goal_id: 1 },
        {},
        true,
        true
      );
    });

    test('should render goal tasks view', () => {
      card._goals = [{ id: 1, name: 'Test Goal', priority: 2, is_active: true, task_count: 0 }];
      card._selectedGoalId = 1;
      card._goalTasks = [
        { id: 1, task_name: 'Task 1', task_type: 'recurring', task_id: 10 },
        { id: 2, task_name: 'Task 2', task_type: 'selfcare', task_id: 20 },
      ];
      const html = card._renderGoalTasksView();
      expect(html).toContain('Test Goal');
      expect(html).toContain('Task 1');
      expect(html).toContain('Task 2');
    });

    test('should render task picker modal', () => {
      card._goals = [{ id: 1, name: 'Test Goal', priority: 2, is_active: true, task_count: 0 }];
      card._selectedGoalId = 1;
      card._goalTasks = [];
      card._allTasks = [
        { id: 1, name: 'Recurring Task', type: 'recurring' },
        { id: 2, name: 'Self-Care Task', type: 'selfcare' },
        { id: 3, name: 'Ad-Hoc Task', type: 'adhoc' },
      ];
      card._showTaskPicker = true;
      const html = card._renderTaskPickerModal();
      expect(html).toContain('tt-modal');
      expect(html).toContain('Recurring Task');
    });

    test('should filter tasks in picker', () => {
      card._allTasks = [
        { id: 1, name: 'Morning Routine', type: 'recurring' },
        { id: 2, name: 'Evening Routine', type: 'recurring' },
        { id: 3, name: 'Exercise', type: 'selfcare' },
      ];
      card._goalTasks = [];
      card._taskFilter = 'routine';

      const filtered = card._filterTasksForPicker();

      expect(filtered.length).toBe(2);
      expect(filtered[0].name).toContain('Routine');
      expect(filtered[1].name).toContain('Routine');
    });

    test('should exclude already associated tasks from picker', () => {
      card._allTasks = [
        { id: 1, name: 'Task 1', type: 'recurring' },
        { id: 2, name: 'Task 2', type: 'selfcare' },
      ];
      card._goalTasks = [
        { id: 1, task_name: 'Task 1', task_type: 'recurring', task_id: 1 },
      ];
      card._taskFilter = '';

      const filtered = card._filterTasksForPicker();

      expect(filtered.length).toBe(1);
      expect(filtered[0].name).toBe('Task 2');
    });

    test('should call associate_task_with_goal service', async () => {
      const serviceSpy = jest.fn().mockResolvedValue({});
      mockHass.callService = serviceSpy;
      card._hass = mockHass;

      await card._associateTask(1, 'recurring', 10);

      expect(serviceSpy).toHaveBeenCalledWith(
        'tasktracker',
        'associate_task_with_goal',
        { goal_id: 1, task_type: 'recurring', task_id: 10 },
        {},
        true,
        true
      );
    });

    test('should call remove_task_from_goal service', async () => {
      const serviceSpy = jest.fn().mockResolvedValue({});
      mockHass.callService = serviceSpy;
      card._hass = mockHass;

      await card._removeTask(1, 5);

      expect(serviceSpy).toHaveBeenCalledWith(
        'tasktracker',
        'remove_task_from_goal',
        { goal_id: 1, association_id: 5 },
        {},
        true,
        true
      );
    });

    test('should call list_goals service', async () => {
      const serviceSpy = jest.fn().mockResolvedValue({
        context: {},
        response: {
          success: true,
          data: {
            goals: [
              { id: 1, name: 'Goal 1', priority: 2, is_active: true, task_count: 0 },
            ],
            count: 1
          }
        }
      });
      mockHass.callService = serviceSpy;
      card._hass = mockHass;

      await card._fetchGoals();

      expect(serviceSpy).toHaveBeenCalledWith(
        'tasktracker',
        'list_goals',
        {},
        {},
        true,
        true
      );
      expect(card._goals).toHaveLength(1);
    });
  });

  describe('Editor', () => {
    test('should have default config', () => {
      const editorClass = customElements.get('tasktracker-goals-card-editor');
      const editor = new editorClass();
      const config = editor.getDefaultConfig();
      expect(config.show_header).toBe(true);
      expect(config.show_inactive).toBe(false);
      expect(config.refresh_interval).toBe(300);
    });
  });
});
