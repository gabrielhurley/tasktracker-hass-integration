/**
 * Tests for TaskTrackerTasksBaseCard
 *
 * Base class for all task-displaying cards. Tests core functionality like
 * task completion, snoozing, deletion, and rendering utilities.
 */

// Mock dependencies before importing
jest.mock('../custom_components/tasktracker/www/utils/base-card.js', () => ({
  TaskTrackerBaseCard: class MockBaseCard {
    constructor() {
      this.shadowRoot = null;
      this._config = {};
      this._hass = null;
    }
  }
}));

jest.mock('../custom_components/tasktracker/www/tasktracker-utils.js', () => ({
  TaskTrackerUtils: {
    getAvailableUsers: jest.fn(),
    getEnhancedUsers: jest.fn(),
    getCurrentUsername: jest.fn(),
    validateCurrentUser: jest.fn(),
    completeTask: jest.fn(),
    updateTask: jest.fn(),
    deleteTask: jest.fn(),
    snoozeTask: jest.fn(),
    showError: jest.fn(),
    showSuccess: jest.fn(),
    formatDuration: jest.fn((minutes) => `${minutes}m`),
    formatPriority: jest.fn((priority) => `Priority ${priority}`),
    formatDueDate: jest.fn((date) => date),
    getTaskBorderStyle: jest.fn(() => ({
      cssClasses: { needsCompletion: false, overdue: false, dueToday: false },
      borderClass: '',
      borderStyle: ''
    }))
  }
}));

jest.mock('../custom_components/tasktracker/www/utils/datetime-utils.js', () => ({
  TaskTrackerDateTime: {
    calculateDaysOverdue: jest.fn(() => 0)
  }
}));

jest.mock('../custom_components/tasktracker/www/utils/styles.js', () => ({
  TaskTrackerStyles: {
    getCommonCardStyles: jest.fn().mockReturnValue('/* styles */')
  }
}));

jest.mock('../custom_components/tasktracker/www/utils/task-data-manager.js', () => ({
  TaskDataManager: jest.fn().mockImplementation(() => ({
    storeTaskData: jest.fn((task) => `task_${task.id}`),
    getTaskData: jest.fn(),
    clear: jest.fn(),
    removeKey: jest.fn()
  }))
}));

const { TaskTrackerTasksBaseCard } = require('../custom_components/tasktracker/www/utils/task-cards-base.js');
const { TaskTrackerUtils } = require('../custom_components/tasktracker/www/tasktracker-utils.js');

describe('TaskTrackerTasksBaseCard', () => {
  let card;
  let mockHass;

  beforeEach(() => {
    jest.clearAllMocks();

    card = new TaskTrackerTasksBaseCard();
    card.shadowRoot = {
      innerHTML: '',
      querySelector: jest.fn(),
      querySelectorAll: jest.fn(() => [])
    };

    mockHass = {
      callService: jest.fn()
    };
    card._hass = mockHass;
    card._config = {};
  });

  describe('initialization', () => {
    test('should initialize with default state', () => {
      const newCard = new TaskTrackerTasksBaseCard();

      expect(newCard._tasks).toEqual([]);
      expect(newCard._userContext).toBe(null);
      expect(newCard._availableUsers).toEqual([]);
      expect(newCard._enhancedUsers).toEqual([]);
      expect(newCard._loading).toBe(false);
      expect(newCard._initialLoad).toBe(true);
      expect(newCard._refreshing).toBe(false);
      expect(newCard._error).toBe(null);
      expect(newCard._taskDataManager).toBeDefined();
    });
  });

  describe('_fetchAvailableUsers', () => {
    test('should fetch available and enhanced users', async () => {
      TaskTrackerUtils.getAvailableUsers.mockResolvedValue(['user1', 'user2']);
      TaskTrackerUtils.getEnhancedUsers.mockResolvedValue([
        { username: 'user1', display_name: 'User One' }
      ]);

      await card._fetchAvailableUsers();

      expect(TaskTrackerUtils.getAvailableUsers).toHaveBeenCalledWith(mockHass);
      expect(TaskTrackerUtils.getEnhancedUsers).toHaveBeenCalledWith(mockHass);
      expect(card._availableUsers).toEqual(['user1', 'user2']);
      expect(card._enhancedUsers).toEqual([
        { username: 'user1', display_name: 'User One' }
      ]);
    });

    test('should handle errors gracefully', async () => {
      const consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation();
      TaskTrackerUtils.getAvailableUsers.mockRejectedValue(new Error('Network error'));

      await card._fetchAvailableUsers();

      expect(card._availableUsers).toEqual([]);
      expect(card._enhancedUsers).toEqual([]);
      consoleWarnSpy.mockRestore();
    });
  });

  describe('_getCurrentUsername', () => {
    test('should get current username from utils', () => {
      card._availableUsers = ['user1', 'user2'];
      card._enhancedUsers = [{ username: 'user1' }];
      TaskTrackerUtils.getCurrentUsername.mockReturnValue('user1');

      const username = card._getCurrentUsername();

      expect(TaskTrackerUtils.getCurrentUsername).toHaveBeenCalledWith(
        card._config,
        mockHass,
        card._availableUsers,
        card._enhancedUsers
      );
      expect(username).toBe('user1');
    });
  });

  describe('_completeTask', () => {
    const mockTask = {
      id: 123,
      name: 'Test Task',
      task_type: 'RecurringTask'
    };

    beforeEach(() => {
      card._enhancedUsers = [{ username: 'user1' }];
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: true,
        username: 'user1'
      });
      TaskTrackerUtils.completeTask.mockResolvedValue({ success: true });
    });

    test('should complete task successfully', async () => {
      await card._completeTask(mockTask, 'Great work');

      expect(TaskTrackerUtils.completeTask).toHaveBeenCalledWith(
        mockHass,
        123,
        'RecurringTask',
        'user1',
        'Great work',
        null
      );
    });

    test('should complete task with timestamp', async () => {
      await card._completeTask(mockTask, '', '2025-01-15T10:00:00Z');

      expect(TaskTrackerUtils.completeTask).toHaveBeenCalledWith(
        mockHass,
        123,
        'RecurringTask',
        'user1',
        '',
        '2025-01-15T10:00:00Z'
      );
    });

    test('should fetch users if not available', async () => {
      card._enhancedUsers = [];
      TaskTrackerUtils.getAvailableUsers.mockResolvedValue(['user1']);
      TaskTrackerUtils.getEnhancedUsers.mockResolvedValue([{ username: 'user1' }]);
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: true,
        username: 'user1'
      });
      TaskTrackerUtils.completeTask.mockResolvedValue({ success: true });

      await card._completeTask(mockTask);

      expect(TaskTrackerUtils.getEnhancedUsers).toHaveBeenCalled();
    });

    test('should handle user validation errors', async () => {
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: false,
        error: 'No user configured'
      });

      await card._completeTask(mockTask);

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith('No user configured');
      expect(TaskTrackerUtils.completeTask).not.toHaveBeenCalled();
    });

    test('should handle button element loading state', async () => {
      const mockButton = {
        textContent: 'Complete',
        disabled: false,
        offsetWidth: 100,
        style: {},
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        },
        closest: jest.fn(() => null)
      };

      await card._completeTask(mockTask, '', null, mockButton);

      expect(mockButton.disabled).toBe(true);
      expect(mockButton.textContent).toBe('');
      expect(mockButton.classList.add).toHaveBeenCalledWith('tt-loading-dots');
      expect(mockButton.style.width).toBe('100px');
    });

    test('should add fade-out animation on success', async () => {
      const mockTaskElement = {
        classList: {
          add: jest.fn(),
          contains: jest.fn(() => false)
        },
        remove: jest.fn(),
        parentNode: {}
      };
      const mockButton = {
        textContent: 'Complete',
        disabled: false,
        offsetWidth: 100,
        style: {},
        classList: { add: jest.fn(), remove: jest.fn() },
        closest: jest.fn(() => mockTaskElement)
      };

      await card._completeTask(mockTask, '', null, mockButton);

      // Wait for async operations
      await new Promise(resolve => setTimeout(resolve, 10));

      expect(mockTaskElement.classList.add).toHaveBeenCalledWith('fade-out');
    });

    test('should call onAfterComplete callback if defined', async () => {
      card.onAfterComplete = jest.fn();

      await card._completeTask(mockTask);

      expect(card.onAfterComplete).toHaveBeenCalled();
    });

    test('should handle completion errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      TaskTrackerUtils.completeTask.mockRejectedValue(new Error('Network error'));

      await card._completeTask(mockTask);

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith(
        'Failed to complete task: Network error'
      );
      consoleErrorSpy.mockRestore();
    });

    test('should handle response errors', async () => {
      TaskTrackerUtils.completeTask.mockResolvedValue({
        success: false,
        message: 'Task already completed'
      });

      await card._completeTask(mockTask);

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith(
        'Failed to complete task: Task already completed'
      );
    });

    test('should restore button state on validation error', async () => {
      const mockButton = {
        textContent: 'Complete',
        disabled: false,
        offsetWidth: 100,
        style: {},
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        },
        closest: jest.fn(() => null)
      };

      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: false,
        error: 'No user'
      });

      await card._completeTask(mockTask, '', null, mockButton);

      expect(mockButton.disabled).toBe(false);
      expect(mockButton.textContent).toBe('Complete');
    });

    test('should restore button state on response error', async () => {
      const mockButton = {
        textContent: 'Complete',
        disabled: false,
        offsetWidth: 100,
        style: {},
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        },
        closest: jest.fn(() => null)
      };

      TaskTrackerUtils.completeTask.mockResolvedValue({
        success: false,
        message: 'Error'
      });

      await card._completeTask(mockTask, '', null, mockButton);

      expect(mockButton.disabled).toBe(false);
      expect(mockButton.textContent).toBe('Complete');
      expect(mockButton.classList.remove).toHaveBeenCalledWith('tt-loading-dots');
    });

    test('should restore button state on exception', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      const mockButton = {
        textContent: 'Complete',
        disabled: false,
        offsetWidth: 100,
        style: {},
        classList: {
          add: jest.fn(),
          remove: jest.fn()
        },
        closest: jest.fn(() => null)
      };

      TaskTrackerUtils.completeTask.mockRejectedValue(new Error('Network error'));

      await card._completeTask(mockTask, '', null, mockButton);

      expect(mockButton.disabled).toBe(false);
      expect(mockButton.textContent).toBe('Complete');
      expect(mockButton.classList.remove).toHaveBeenCalledWith('tt-loading-dots');
      consoleErrorSpy.mockRestore();
    });

  });

  describe('_snoozeTask', () => {
    const mockTask = {
      id: 123,
      name: 'Test Task',
      task_type: 'RecurringTask'
    };

    beforeEach(() => {
      card._enhancedUsers = [{ username: 'user1' }];
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: true,
        username: 'user1'
      });
      TaskTrackerUtils.snoozeTask.mockResolvedValue({ success: true });
    });

    test('should snooze task successfully', async () => {
      await card._snoozeTask(mockTask, '2025-01-20');

      expect(TaskTrackerUtils.snoozeTask).toHaveBeenCalledWith(
        mockHass,
        mockTask,
        '2025-01-20',
        mockTask.assigned_users
      );
    });

    test('should call onAfterSnooze callback if defined', async () => {
      card.onAfterSnooze = jest.fn();

      await card._snoozeTask(mockTask, '2025-01-20');

      expect(card.onAfterSnooze).toHaveBeenCalled();
    });

    test('should handle user validation errors', async () => {
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: false,
        error: 'No user configured'
      });

      await card._snoozeTask(mockTask, '2025-01-20');

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith('No user configured');
      expect(TaskTrackerUtils.snoozeTask).not.toHaveBeenCalled();
    });

    test('should fetch users if not available for snooze', async () => {
      card._enhancedUsers = [];
      TaskTrackerUtils.getAvailableUsers.mockResolvedValue(['user1']);
      TaskTrackerUtils.getEnhancedUsers.mockResolvedValue([{ username: 'user1' }]);
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: true,
        username: 'user1'
      });

      await card._snoozeTask(mockTask, '2025-01-20');

      expect(TaskTrackerUtils.getEnhancedUsers).toHaveBeenCalled();
    });
  });

  describe('_saveTask', () => {
    const mockTask = {
      id: 123,
      task_type: 'RecurringTask',
      assigned_users: ['user1']
    };

    test('should update task successfully', async () => {
      TaskTrackerUtils.updateTask.mockResolvedValue({ success: true });

      await card._saveTask(mockTask, { name: 'Updated Name' });

      expect(TaskTrackerUtils.updateTask).toHaveBeenCalledWith(
        mockHass,
        123,
        'RecurringTask',
        ['user1'],
        { name: 'Updated Name' }
      );
      expect(TaskTrackerUtils.showSuccess).toHaveBeenCalledWith('Task updated successfully');
    });

    test('should call onAfterUpdate callback if defined', async () => {
      TaskTrackerUtils.updateTask.mockResolvedValue({ success: true });
      card.onAfterUpdate = jest.fn();

      await card._saveTask(mockTask, { name: 'Updated Name' });

      expect(card.onAfterUpdate).toHaveBeenCalled();
    });

    test('should handle update errors', async () => {
      const consoleErrorSpy = jest.spyOn(console, 'error').mockImplementation();
      TaskTrackerUtils.updateTask.mockRejectedValue(new Error('Update failed'));

      await card._saveTask(mockTask, { name: 'Updated Name' });

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith(
        'Failed to update task: Update failed'
      );
      consoleErrorSpy.mockRestore();
    });

    test('should handle response errors', async () => {
      TaskTrackerUtils.updateTask.mockResolvedValue({
        success: false,
        message: 'Invalid data'
      });

      await card._saveTask(mockTask, { name: 'Updated Name' });

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith(
        'Failed to update task: Invalid data'
      );
    });
  });

  describe('_deleteTask', () => {
    const mockTask = {
      id: 123,
      task_type: 'RecurringTask'
    };

    beforeEach(() => {
      card._enhancedUsers = [{ username: 'user1' }];
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: true,
        username: 'user1'
      });
      TaskTrackerUtils.deleteTask.mockResolvedValue({ success: true });
    });

    test('should delete task successfully', async () => {
      await card._deleteTask(mockTask);

      expect(TaskTrackerUtils.deleteTask).toHaveBeenCalledWith(
        mockHass,
        123,
        'RecurringTask',
        'user1'
      );
    });

    test('should handle task_id field', async () => {
      const taskWithTaskId = {
        task_id: 456,
        task_type: 'RecurringTask'
      };

      await card._deleteTask(taskWithTaskId);

      expect(TaskTrackerUtils.deleteTask).toHaveBeenCalledWith(
        mockHass,
        456,
        'RecurringTask',
        'user1'
      );
    });

    test('should call onAfterUpdate callback if defined', async () => {
      card.onAfterUpdate = jest.fn();

      await card._deleteTask(mockTask);

      expect(card.onAfterUpdate).toHaveBeenCalled();
    });

    test('should handle user validation errors', async () => {
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: false,
        error: 'No user configured'
      });

      await card._deleteTask(mockTask);

      expect(TaskTrackerUtils.showError).toHaveBeenCalledWith('No user configured');
      expect(TaskTrackerUtils.deleteTask).not.toHaveBeenCalled();
    });

    test('should fetch users if not available for delete', async () => {
      card._enhancedUsers = [];
      TaskTrackerUtils.getAvailableUsers.mockResolvedValue(['user1']);
      TaskTrackerUtils.getEnhancedUsers.mockResolvedValue([{ username: 'user1' }]);
      TaskTrackerUtils.validateCurrentUser.mockReturnValue({
        canMakeRequests: true,
        username: 'user1'
      });

      await card._deleteTask(mockTask);

      expect(TaskTrackerUtils.getEnhancedUsers).toHaveBeenCalled();
    });
  });

  describe('buildTaskMetadata', () => {
    test('should build metadata with duration, priority, and due date', () => {
      card._userContext = { timezone: 'America/Los_Angeles' };
      const task = {
        duration_minutes: 30,
        priority: 2,
        due_date: '2025-01-20'
      };

      const parts = card.buildTaskMetadata(task);

      expect(parts).toHaveLength(3);
      expect(TaskTrackerUtils.formatDuration).toHaveBeenCalledWith(30);
      expect(TaskTrackerUtils.formatPriority).toHaveBeenCalledWith(2);
      expect(TaskTrackerUtils.formatDueDate).toHaveBeenCalledWith('2025-01-20', card._userContext, task);
    });

    test('should include recommendation score when requested', () => {
      const task = {
        duration_minutes: 30,
        recommendation_score: 85
      };

      const parts = card.buildTaskMetadata(task, { includeRecommendationScore: true });

      expect(parts).toContain('Score: 85');
    });

    test('should handle tasks with next_due instead of due_date', () => {
      card._userContext = { timezone: 'America/Los_Angeles' };
      const task = {
        next_due: '2025-01-20'
      };

      const parts = card.buildTaskMetadata(task);

      expect(TaskTrackerUtils.formatDueDate).toHaveBeenCalledWith('2025-01-20', card._userContext, task);
    });

    test('should return empty array for task with no metadata', () => {
      const task = {};

      const parts = card.buildTaskMetadata(task);

      expect(parts).toEqual([]);
    });
  });

  describe('getTaskCssAndBorder', () => {
    test('should get border info for regular task', () => {
      card._userContext = { timezone: 'America/Los_Angeles' };
      TaskTrackerUtils.getTaskBorderStyle.mockReturnValue({
        cssClasses: { needsCompletion: true, overdue: false, dueToday: true },
        borderClass: 'tt-task-border--due',
        borderStyle: ''
      });

      const task = { due_date: '2025-01-15' };
      const result = card.getTaskCssAndBorder(task, 'task');

      expect(result.taskClasses).toBe('task-item needs-completion due-today');
      expect(result.borderClass).toBe('tt-task-border--due');
    });

    test('should get border info for self-care task', () => {
      TaskTrackerUtils.getTaskBorderStyle.mockReturnValue({
        cssClasses: { needsCompletion: false, overdue: false, dueToday: false },
        borderClass: '',
        borderStyle: ''
      });

      const task = { task_type: 'SelfCareTask' };
      const result = card.getTaskCssAndBorder(task, 'self_care');

      expect(TaskTrackerUtils.getTaskBorderStyle).toHaveBeenCalledWith(task, 'self_care', 0);
      expect(result.taskClasses).toBe('task-item');
    });
  });

  describe('renderSimpleTaskRow', () => {
    test('should render task row with metadata', () => {
      const task = {
        id: 123,
        name: 'Test Task',
        duration_minutes: 30,
        priority: 2
      };

      const html = card.renderSimpleTaskRow(task);

      expect(html).toContain('Test Task');
      expect(html).toContain('task-item');
      expect(html).toContain('data-task-key="task_123"');
      expect(html).toContain('task-metadata');
    });

    test('should render task row with actions when requested', () => {
      const task = {
        id: 123,
        name: 'Test Task'
      };

      const html = card.renderSimpleTaskRow(task, { showActions: true });

      expect(html).toContain('task-actions');
      expect(html).toContain('complete-btn');
    });

    test('should show completion indicator when task has notes', () => {
      const task = {
        id: 123,
        name: 'Test Task',
        last_completion_notes: 'Some notes'
      };

      const html = card.renderSimpleTaskRow(task);

      expect(html).toContain('completion-indicator');
    });
  });

  describe('clearTaskData', () => {
    test('should clear task data manager', () => {
      card.clearTaskData();

      expect(card._taskDataManager.clear).toHaveBeenCalled();
    });
  });

  describe('getTaskData', () => {
    test('should get task data from manager', () => {
      const mockData = { task: { id: 123 }, taskType: 'task' };
      card._taskDataManager.getTaskData.mockReturnValue(mockData);

      const result = card.getTaskData('task_123');

      expect(card._taskDataManager.getTaskData).toHaveBeenCalledWith('task_123');
      expect(result).toEqual(mockData);
    });
  });

  describe('setupTaskClickHandlers', () => {
    test('should setup click handlers for task items', () => {
      const mockTaskItem = {
        dataset: { taskKey: 'task_123' },
        addEventListener: jest.fn()
      };
      card.shadowRoot.querySelectorAll.mockReturnValue([mockTaskItem]);
      card._taskDataManager.getTaskData.mockReturnValue({
        task: { id: 123 },
        taskType: 'task'
      });

      const onTaskClick = jest.fn();
      card.setupTaskClickHandlers(onTaskClick);

      expect(mockTaskItem.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      // Trigger the click handler
      const clickHandler = mockTaskItem.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(onTaskClick).toHaveBeenCalledWith({ id: 123 }, 'task');
    });

    test('should setup complete button handlers when callback provided', () => {
      const mockButton = {
        dataset: { taskKey: 'task_123' },
        addEventListener: jest.fn()
      };
      card.shadowRoot.querySelectorAll
        .mockReturnValueOnce([]) // task items
        .mockReturnValueOnce([mockButton]); // complete buttons

      card._taskDataManager.getTaskData.mockReturnValue({
        task: { id: 123 },
        taskType: 'task'
      });

      const onTaskClick = jest.fn();
      const onCompleteClick = jest.fn();
      card.setupTaskClickHandlers(onTaskClick, onCompleteClick);

      expect(mockButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      // Trigger the click handler
      const clickHandler = mockButton.addEventListener.mock.calls[0][1];
      const mockEvent = { stopPropagation: jest.fn() };
      clickHandler(mockEvent);

      expect(mockEvent.stopPropagation).toHaveBeenCalled();
      expect(onCompleteClick).toHaveBeenCalledWith({ id: 123 }, 'task', mockButton);
    });
  });

  describe('partial update helpers', () => {
    describe('_taskArraysEqual', () => {
      test('should return true for equal task arrays', () => {
        const tasks1 = [
          { id: 1, completed: false, outstanding_occurrences: 0 },
          { id: 2, completed: false, outstanding_occurrences: 1 }
        ];
        const tasks2 = [
          { id: 1, completed: false, outstanding_occurrences: 0 },
          { id: 2, completed: false, outstanding_occurrences: 1 }
        ];

        expect(card._taskArraysEqual(tasks1, tasks2)).toBe(true);
      });

      test('should return false for different task arrays', () => {
        const tasks1 = [{ id: 1, completed: false }];
        const tasks2 = [{ id: 1, completed: true }];

        expect(card._taskArraysEqual(tasks1, tasks2)).toBe(false);
      });

      test('should handle null/undefined arrays', () => {
        expect(card._taskArraysEqual(null, null)).toBe(true);
        expect(card._taskArraysEqual(null, [])).toBe(false);
        expect(card._taskArraysEqual([], null)).toBe(false);
      });
    });

    describe('_userContextEqual', () => {
      test('should return true for equal user contexts', () => {
        const ctx1 = {
          timezone: 'America/Los_Angeles',
          daily_reset_time: '05:00:00',
          current_logical_date: '2025-01-15'
        };
        const ctx2 = { ...ctx1 };

        expect(card._userContextEqual(ctx1, ctx2)).toBe(true);
      });

      test('should return false for different contexts', () => {
        const ctx1 = { timezone: 'America/Los_Angeles', daily_reset_time: '05:00:00' };
        const ctx2 = { timezone: 'America/New_York', daily_reset_time: '05:00:00' };

        expect(card._userContextEqual(ctx1, ctx2)).toBe(false);
      });

      test('should handle null contexts', () => {
        expect(card._userContextEqual(null, null)).toBe(true);
        expect(card._userContextEqual(null, {})).toBe(false);
      });
    });

    describe('_tasksEqual', () => {
      test('should return true for equal tasks', () => {
        const task1 = {
          id: 1,
          name: 'Test',
          completed: false,
          outstanding_occurrences: 0,
          windows: [{ completed: false, label: 'Morning' }]
        };
        const task2 = { ...task1, windows: [{ completed: false, label: 'Morning' }] };

        expect(card._tasksEqual(task1, task2)).toBe(true);
      });

      test('should return false when windows differ', () => {
        const task1 = {
          id: 1,
          windows: [{ completed: false, label: 'Morning' }]
        };
        const task2 = {
          id: 1,
          windows: [{ completed: true, label: 'Morning' }]
        };

        expect(card._tasksEqual(task1, task2)).toBe(false);
      });

      test('should compare task_nudges correctly', () => {
        const task1 = { id: 1, task_nudges: [{ type: 'reminder' }] };
        const task2 = { id: 1, task_nudges: [{ type: 'reminder' }] };

        expect(card._tasksEqual(task1, task2)).toBe(true);
      });
    });

    describe('_windowsEqual', () => {
      test('should return true for equal windows', () => {
        const windows1 = [
          { completed: false, label: 'Morning' },
          { completed: true, label: 'Evening' }
        ];
        const windows2 = [
          { completed: false, label: 'Morning' },
          { completed: true, label: 'Evening' }
        ];

        expect(card._windowsEqual(windows1, windows2)).toBe(true);
      });

      test('should return false for different windows', () => {
        const windows1 = [{ completed: false, label: 'Morning' }];
        const windows2 = [{ completed: true, label: 'Morning' }];

        expect(card._windowsEqual(windows1, windows2)).toBe(false);
      });

      test('should handle null/undefined windows', () => {
        expect(card._windowsEqual(null, null)).toBe(true);
        expect(card._windowsEqual(null, [])).toBe(false);
      });
    });
  });

  describe('partial update system', () => {
    describe('_canDoPartialUpdate', () => {
      test('should return false if no data provided', () => {
        expect(card._canDoPartialUpdate(null, {})).toBe(false);
        expect(card._canDoPartialUpdate({}, null)).toBe(false);
      });

      test('should return false if using_defaults changed', () => {
        const oldData = { using_defaults: false, user_context: {} };
        const newData = { using_defaults: true, user_context: {} };

        expect(card._canDoPartialUpdate(oldData, newData)).toBe(false);
      });

      test('should return false if user context changed', () => {
        const oldData = { user_context: { timezone: 'America/Los_Angeles' } };
        const newData = { user_context: { timezone: 'America/New_York' } };

        expect(card._canDoPartialUpdate(oldData, newData)).toBe(false);
      });

      test('should return true for simple task changes', () => {
        const oldData = {
          using_defaults: false,
          user_context: { timezone: 'America/Los_Angeles', daily_reset_time: '05:00:00', current_logical_date: '2025-01-15' },
          self_care: [{ id: 1 }],
          tasks: [{ id: 1 }, { id: 2 }]
        };
        const newData = {
          using_defaults: false,
          user_context: { timezone: 'America/Los_Angeles', daily_reset_time: '05:00:00', current_logical_date: '2025-01-15' },
          self_care: [{ id: 1 }],
          tasks: [{ id: 2 }] // One task removed
        };

        expect(card._canDoPartialUpdate(oldData, newData)).toBe(true);
      });
    });

    describe('_hasSectionStructureChanged', () => {
      test('should detect when self-care section appears/disappears', () => {
        const oldData = { self_care: [], tasks: [{ id: 1 }] };
        const newData = { self_care: [{ id: 1 }], tasks: [{ id: 1 }] };

        expect(card._hasSectionStructureChanged(oldData, newData)).toBe(true);
      });

      test('should detect when tasks section appears/disappears', () => {
        const oldData = { self_care: [{ id: 1 }], tasks: [] };
        const newData = { self_care: [{ id: 1 }], tasks: [{ id: 1 }] };

        expect(card._hasSectionStructureChanged(oldData, newData)).toBe(true);
      });

      test('should return false when section structure same', () => {
        const oldData = { self_care: [{ id: 1 }], tasks: [{ id: 1 }] };
        const newData = { self_care: [{ id: 2 }], tasks: [{ id: 2 }] };

        expect(card._hasSectionStructureChanged(oldData, newData)).toBe(false);
      });
    });

    describe('_hasTooManyChanges', () => {
      test('should return true when too many changes', () => {
        const oldData = {
          self_care: [{ id: 1 }, { id: 2 }],
          tasks: [{ id: 1 }, { id: 2 }, { id: 3 }]
        };
        const newData = {
          self_care: [],
          tasks: []
        };

        expect(card._hasTooManyChanges(oldData, newData)).toBe(true);
      });

      test('should return false when few changes', () => {
        const oldData = {
          self_care: [{ id: 1 }],
          tasks: [{ id: 1 }, { id: 2 }]
        };
        const newData = {
          self_care: [{ id: 1 }],
          tasks: [{ id: 2 }]
        };

        expect(card._hasTooManyChanges(oldData, newData)).toBe(false);
      });
    });

    describe('_identifyChanges', () => {
      test('should identify removed tasks', () => {
        const oldData = {
          self_care: [{ id: 1 }, { id: 2 }],
          tasks: [{ id: 3 }]
        };
        const newData = {
          self_care: [{ id: 1 }],
          tasks: []
        };

        const changes = card._identifyChanges(oldData, newData);

        expect(changes.removedSelfCareTasks).toHaveLength(1);
        expect(changes.removedSelfCareTasks[0].id).toBe(2);
        expect(changes.removedTasks).toHaveLength(1);
        expect(changes.removedTasks[0].id).toBe(3);
      });

      test('should identify added tasks', () => {
        const oldData = {
          self_care: [{ id: 1 }],
          tasks: []
        };
        const newData = {
          self_care: [{ id: 1 }, { id: 2 }],
          tasks: [{ id: 3 }]
        };

        const changes = card._identifyChanges(oldData, newData);

        expect(changes.addedSelfCareTasks).toHaveLength(1);
        expect(changes.addedSelfCareTasks[0].id).toBe(2);
        expect(changes.addedTasks).toHaveLength(1);
        expect(changes.addedTasks[0].id).toBe(3);
      });

      test('should identify updated tasks', () => {
        const oldData = {
          self_care: [{ id: 1, completed: false }],
          tasks: [{ id: 2, name: 'Old Name' }]
        };
        const newData = {
          self_care: [{ id: 1, completed: true }],
          tasks: [{ id: 2, name: 'New Name' }]
        };

        const changes = card._identifyChanges(oldData, newData);

        expect(changes.updatedSelfCareTasks).toHaveLength(1);
        expect(changes.updatedTasks).toHaveLength(1);
      });
    });

    describe('_applyPartialUpdates', () => {
      test('should return false for added tasks (falls back to full re-render)', () => {
        const changes = {
          removedSelfCareTasks: [],
          removedTasks: [],
          addedSelfCareTasks: [{ id: 1 }],
          addedTasks: [],
          updatedSelfCareTasks: [],
          updatedTasks: []
        };

        const result = card._applyPartialUpdates(changes);

        expect(result).toBe(false);
      });
    });
  });
});
