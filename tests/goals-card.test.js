const {
  setupCardTestEnvironment,
  createMockHass,
  expectCardRegistered,
  expectStubConfig,
} = require('./helpers/card-test-helpers');

setupCardTestEnvironment();
require('../custom_components/tasktracker/www/tasktracker-goals-card.js');
const { TaskTrackerUtils } = require('../custom_components/tasktracker/www/tasktracker-utils.js');

// Service responses come back through the HA service wrapper:
// { context, response: { success, data, user_context } }
const serviceResponse = (data) => ({ context: {}, response: { success: true, data } });

describe('TaskTrackerGoalsCard', () => {
  describe('Module Registration', () => {
    test('should register correctly', () => {
      expectCardRegistered('tasktracker-goals-card', 'TaskTracker Goals');
      expectStubConfig('tasktracker-goals-card', {
        show_header: true,
        show_inactive: true,
        refresh_interval: 300,
        user_filter_mode: 'current',
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
      card.setConfig({ show_header: true });
    });

    test('should initialize with default state', () => {
      expect(card._goals).toEqual([]);
      expect(card._goalTasks).toEqual([]);
      expect(card._loading).toBe(false);
      expect(card._selectedGoal).toBeNull();
      expect(card._modalMode).toBeNull();
      expect(card._showTaskPicker).toBe(false);
    });

    test('should merge config with defaults', () => {
      card.setConfig({ show_header: false });
      expect(card._config.show_header).toBe(false);
      expect(card._config.show_inactive).toBe(true);
      expect(card._config.user_filter_mode).toBe('current');
      expect(card._config.refresh_interval).toBe(300);
    });

    test('should render goals list HTML', () => {
      card._loading = false;
      card._goals = [
        { id: 1, name: 'Test Goal', description: 'Test description', priority: 2, is_active: true, task_count: 3 },
        { id: 2, name: 'Another Goal', description: '', priority: 1, is_active: false, task_count: 0 },
      ];
      const html = card._renderGoalsList();
      expect(html).toContain('Test Goal');
      expect(html).toContain('task-item');
      expect(html).toContain('3 tasks');
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

    test('should render priority classes correctly', () => {
      card._goals = [
        { id: 1, name: 'High Priority', priority: 1, is_active: true, task_count: 0 },
      ];
      const html = card._renderGoalRow(card._goals[0]);
      expect(html).toContain('High Priority');
      expect(html).toContain('priority-high');
    });

    test('should mark inactive goals in list rows', () => {
      const html = card._renderGoalRow({ id: 2, name: 'Paused Goal', priority: 3, is_active: false, task_count: 1 });
      expect(html).toContain('inactive');
      expect(html).toContain('Inactive');
    });

    test('should render create goal form', () => {
      const form = card._renderGoalForm(null, 'create');
      expect(form.id).toBe('goal-form');
      expect(form.innerHTML).toContain('Name *');
      expect(form.innerHTML).toContain('goal-name');
    });

    test('should render edit goal form with pre-filled data', () => {
      const form = card._renderGoalForm(
        {
          id: 1,
          name: 'Test Goal',
          description: 'Test description',
          priority: 1,
          is_active: false,
        },
        'edit'
      );
      expect(form.innerHTML).toContain('Test Goal');
      expect(form.innerHTML).toContain('Test description');
    });

    test('should call create_goal service when submitting new goal', async () => {
      const serviceSpy = jest.fn().mockResolvedValue(serviceResponse({}));
      mockHass.callService = serviceSpy;
      card._hass = mockHass;
      card._fetchGoals = jest.fn();

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
      const serviceSpy = jest.fn().mockResolvedValue(serviceResponse({}));
      mockHass.callService = serviceSpy;
      card._hass = mockHass;
      card._fetchGoals = jest.fn();

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
      const serviceSpy = jest.fn().mockResolvedValue(serviceResponse({}));
      mockHass.callService = serviceSpy;
      card._hass = mockHass;
      card._fetchGoals = jest.fn();

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

    test('should render associated goal tasks list', () => {
      card._goalTasks = [
        { id: 1, task_name: 'Task 1', task_type: 'recurringtask', task_object_id: 10 },
        { id: 2, task_name: 'Task 2', task_type: 'selfcaretask', task_object_id: 20 },
      ];
      const html = card._renderGoalTasksList();
      expect(html).toContain('Task 1');
      expect(html).toContain('Task 2');
      expect(html).toContain('data-action="remove-task"');
    });

    test('should render empty goal tasks list message', () => {
      card._goalTasks = [];
      const html = card._renderGoalTasksList();
      expect(html).toContain('No tasks associated');
    });

    test('should render task picker groups', () => {
      const html = card._renderTaskPickerGroups([
        { id: 1, name: 'Recurring Task', type: 'recurring' },
        { id: 2, name: 'Self-Care Task', type: 'selfcare' },
        { id: 3, name: 'Ad-Hoc Task', type: 'adhoc' },
      ]);
      expect(html).toContain('Recurring Tasks');
      expect(html).toContain('Recurring Task');
      expect(html).toContain('Self-Care Tasks');
      expect(html).toContain('Ad-Hoc Tasks');
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

    test('should require a filter before showing picker tasks', () => {
      card._allTasks = [
        { id: 1, name: 'Task 1', type: 'recurring' },
      ];
      card._goalTasks = [];
      card._taskFilter = '';

      expect(card._filterTasksForPicker()).toHaveLength(0);
    });

    test('should flag already associated tasks in picker', () => {
      card._allTasks = [
        { id: 1, name: 'Task 1', type: 'recurring' },
        { id: 2, name: 'Task 2', type: 'selfcare' },
      ];
      card._goalTasks = [
        { id: 7, task_name: 'Task 1', task_type: 'recurring', task_object_id: 1 },
      ];
      card._taskFilter = 'task';

      const filtered = card._filterTasksForPicker();

      expect(filtered).toHaveLength(2);
      const task1 = filtered.find(t => t.id === 1);
      const task2 = filtered.find(t => t.id === 2);
      expect(task1.isAlreadyAssociated).toBe(true);
      expect(task2.isAlreadyAssociated).toBe(false);
    });

    test('should call associate_task_with_goal service', async () => {
      const serviceSpy = jest.fn().mockResolvedValue(serviceResponse({}));
      mockHass.callService = serviceSpy;
      card._hass = mockHass;
      card._fetchGoalTasks = jest.fn();
      card._fetchGoals = jest.fn();

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
      const serviceSpy = jest.fn().mockResolvedValue(serviceResponse({}));
      mockHass.callService = serviceSpy;
      card._hass = mockHass;
      card._fetchGoalTasks = jest.fn();
      card._fetchGoals = jest.fn();

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
      const serviceSpy = jest.fn().mockResolvedValue(
        serviceResponse({
          items: [
            { id: 1, name: 'Goal 1', priority: 2, is_active: true, task_count: 0 },
          ],
          count: 1,
        })
      );
      mockHass.callService = serviceSpy;
      card._hass = mockHass;
      card._enhancedUsers = [{ username: 'testuser', display_name: 'Test', ha_user_id: null }];
      card._availableUsers = ['testuser'];
      card._renderContent = jest.fn();
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: true,
        error: null,
        username: 'testuser',
      });

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
      expect(config.show_inactive).toBe(true);
      expect(config.refresh_interval).toBe(300);
    });
  });
});
