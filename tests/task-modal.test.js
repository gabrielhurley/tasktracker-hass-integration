/**
 * Tests for task-modal.js
 *
 * Pragmatic approach: Smoke tests to ensure basic functionality works
 * and provide code coverage without extensive DOM manipulation testing.
 *
 * Focus on:
 * - Modal creation doesn't crash
 * - Different task types are handled
 * - Edit vs view modes work
 * - Key utilities are called correctly
 */

// Mock dependencies
jest.mock('../custom_components/tasktracker/www/utils/styles.js', () => ({
  TaskTrackerStyles: {
    ensureGlobal: jest.fn()
  }
}));

jest.mock('../custom_components/tasktracker/www/utils/datetime-utils.js', () => ({
  TaskTrackerDateTime: {
    getCompletionTimestamp: jest.fn((window, userContext) => {
      return `${window.start}-midpoint`;
    }),
    formatWindowTimeRange: jest.fn((window) => `${window.start} - ${window.end}`)
  }
}));

jest.mock('../custom_components/tasktracker/www/utils/ui/components.js', () => ({
  createStyledButton: jest.fn()
}));

jest.mock('../custom_components/tasktracker/www/utils/formatters.js', () => ({
  formatDateTimeForInput: jest.fn((date) => date || ''),
  formatDuration: jest.fn((minutes) => `${minutes}m`),
  formatPriority: jest.fn((priority) => `Priority ${priority}`),
  getPriorityOptions: jest.fn(() => [
    { value: 1, label: 'High' },
    { value: 2, label: 'Medium' },
    { value: 3, label: 'Low' }
  ]),
  formatDateTime: jest.fn((date) => date),
  formatDueDate: jest.fn((date) => date)
}));

jest.mock('../custom_components/tasktracker/www/utils/users.js', () => ({
  getUserDisplayName: jest.fn((user) => user && (user.display_name || user.username || user))
}));

jest.mock('../custom_components/tasktracker/www/utils/toast.js', () => ({
  showError: jest.fn()
}));

const { createTaskModal } = require('../custom_components/tasktracker/www/utils/ui/task-modal.js');
const { TaskTrackerDateTime } = require('../custom_components/tasktracker/www/utils/datetime-utils.js');
const { createStyledButton } = require('../custom_components/tasktracker/www/utils/ui/components.js');
const { TaskTrackerStyles } = require('../custom_components/tasktracker/www/utils/styles.js');
const { formatDuration, formatPriority, getPriorityOptions } = require('../custom_components/tasktracker/www/utils/formatters.js');

describe('task-modal', () => {
  let mockTask;
  let mockConfig;

  beforeEach(() => {
    jest.clearAllMocks();

    // Setup createStyledButton to return actual DOM elements
    createStyledButton.mockImplementation((text, onClick) => {
      const button = document.createElement('button');
      button.textContent = text;
      button.classList.add('tt-btn');
      if (onClick) {
        button.addEventListener('click', onClick);
      }
      return button;
    });

    mockTask = {
      id: 123,
      name: 'Test Task',
      task_type: 'RecurringTask',
      duration_minutes: 30,
      priority: 2,
      assigned_users: ['user1']
    };

    mockConfig = {
      user_filter_mode: 'current'
    };
  });

  describe('smoke tests - basic modal creation', () => {
    test('should create modal without crashing', () => {
      const modal = createTaskModal(mockTask, mockConfig, jest.fn());

      expect(modal).toBeDefined();
      expect(modal.className).toBe('tt-modal');
      expect(TaskTrackerStyles.ensureGlobal).toHaveBeenCalled();
    });

    test('should handle task with alternate field names', () => {
      const taskWithAlternateNames = {
        id: 456,
        task_name: 'Alternate Task',
        task_duration_minutes: 45,
        task_priority_value: 1,
        task_type: 'RecurringTask'
      };

      expect(() => {
        createTaskModal(taskWithAlternateNames, mockConfig, jest.fn());
      }).not.toThrow();
    });

    test('should handle self-care tasks', () => {
      const selfCareTask = {
        ...mockTask,
        task_type: 'SelfCareTask',
        windows: [
          { start: '09:00', end: '12:00', label: 'Morning', completed: false }
        ]
      };

      expect(() => {
        createTaskModal(selfCareTask, mockConfig, jest.fn());
      }).not.toThrow();
    });

    test('should handle one-time tasks', () => {
      const oneTimeTask = {
        ...mockTask,
        task_type: 'Task'
      };

      expect(() => {
        createTaskModal(oneTimeTask, mockConfig, jest.fn());
      }).not.toThrow();
    });
  });

  describe('utility function calls', () => {
    test('should call formatting utilities', () => {
      createTaskModal(mockTask, mockConfig, jest.fn());

      expect(formatDuration).toHaveBeenCalled();
      expect(formatPriority).toHaveBeenCalled();
    });

    test('should call getPriorityOptions in edit mode', () => {
      createTaskModal(mockTask, mockConfig, jest.fn(), jest.fn());

      expect(getPriorityOptions).toHaveBeenCalled();
    });
  });

  describe('mode differences', () => {
    test('should create different buttons in view mode', () => {
      createTaskModal(mockTask, mockConfig, jest.fn(), null);

      const buttonTypes = createStyledButton.mock.calls.map(call => call[0]);
      expect(buttonTypes).toContain('Complete');
      expect(buttonTypes).toContain('Cancel');
      expect(buttonTypes).not.toContain('Save');
    });

    test('should create save button in edit mode', () => {
      createTaskModal(mockTask, mockConfig, jest.fn(), jest.fn());

      const buttonTypes = createStyledButton.mock.calls.map(call => call[0]);
      expect(buttonTypes).toContain('Save');
      expect(buttonTypes).toContain('Cancel');
    });
  });


  describe('optional callbacks', () => {
    test('should work with only required callback', () => {
      expect(() => {
        createTaskModal(mockTask, mockConfig, jest.fn());
      }).not.toThrow();
    });

    test('should work with all callbacks provided', () => {
      expect(() => {
        createTaskModal(
          mockTask,
          mockConfig,
          jest.fn(), // onComplete
          jest.fn(), // onSave
          [],         // availableUsers
          [],         // enhancedUsers
          jest.fn(), // onEdit
          jest.fn(), // onSnooze
          jest.fn()  // onDelete
        );
      }).not.toThrow();
    });
  });
});
