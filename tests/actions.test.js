/**
 * Tests for actions utility functions
 *
 * These functions handle task operations like completion, deletion, updates, etc.
 * Basic coverage of success and error paths.
 */

// Mock dependencies before importing
jest.mock('../custom_components/tasktracker/www/utils/error-handling.js', () => ({
  handleActionError: jest.fn((message, error) => ({ success: false, error: error.message })),
  ensureServiceSuccess: jest.fn((response) => {
    if (response && response.response) return response.response;
    if (response && response.success) return response;
    throw new Error('Service call failed');
  })
}));

jest.mock('../custom_components/tasktracker/www/utils/toast.js', () => ({
  showSuccess: jest.fn(),
  showError: jest.fn()
}));

const {
  completeTask,
  deleteCompletion,
  updateCompletion,
  updateTask,
  snoozeTask,
  disposeLeftover,
  createTaskFromDescription,
  deleteTask
} = require('../custom_components/tasktracker/www/utils/actions.js');

const { showSuccess, showError } = require('../custom_components/tasktracker/www/utils/toast.js');
const { handleActionError, ensureServiceSuccess } = require('../custom_components/tasktracker/www/utils/error-handling.js');

describe('actions', () => {
  let mockHass;

  beforeEach(() => {
    jest.clearAllMocks();

    mockHass = {
      callService: jest.fn()
    };

    // Reset ensureServiceSuccess to default behavior
    ensureServiceSuccess.mockImplementation((response) => {
      if (response && response.response) return response.response;
      if (response && response.success) return response;
      throw new Error('Service call failed');
    });
  });

  describe('completeTask', () => {
    test('should complete task successfully', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true, spoken_response: 'Task completed!' }
      });

      const result = await completeTask(mockHass, 123, 'RecurringTask', 'testuser', 'Great job');

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'complete_task',
        {
          task_id: 123,
          task_type: 'RecurringTask',
          completed_by: 'testuser',
          notes: 'Great job'
        },
        {},
        true,
        true
      );
      expect(showSuccess).toHaveBeenCalledWith('Task completed!');
      expect(result).toEqual({ success: true, spoken_response: 'Task completed!' });
    });

    test('should complete task with completed_at timestamp', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      await completeTask(mockHass, 123, 'RecurringTask', 'testuser', '', '2025-01-15T10:00:00Z');

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'complete_task',
        {
          task_id: 123,
          task_type: 'RecurringTask',
          completed_by: 'testuser',
          completed_at: '2025-01-15T10:00:00Z'
        },
        {},
        true,
        true
      );
    });

    test('should use default message when no spoken_response', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      await completeTask(mockHass, 123, 'RecurringTask');

      expect(showSuccess).toHaveBeenCalledWith('Task completed successfully');
    });

    test('should handle errors', async () => {
      mockHass.callService.mockRejectedValue(new Error('Network error'));
      ensureServiceSuccess.mockImplementation(() => {
        throw new Error('Network error');
      });

      await completeTask(mockHass, 123, 'RecurringTask');

      expect(showError).toHaveBeenCalledWith('Failed to complete task');
      expect(handleActionError).toHaveBeenCalledWith('Failed to complete task', expect.any(Error));
    });
  });

  describe('deleteCompletion', () => {
    test('should delete completion successfully', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const result = await deleteCompletion(mockHass, 456);

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'delete_completion',
        { completion_id: 456 },
        {},
        true,
        true
      );
      expect(showSuccess).toHaveBeenCalledWith('Completion deleted successfully');
      expect(result).toEqual({ success: true });
    });

    test('should handle errors', async () => {
      mockHass.callService.mockRejectedValue(new Error('Not found'));
      ensureServiceSuccess.mockImplementation(() => {
        throw new Error('Not found');
      });

      await deleteCompletion(mockHass, 456);

      expect(showError).toHaveBeenCalledWith('Failed to delete completion');
      expect(handleActionError).toHaveBeenCalled();
    });
  });

  describe('updateCompletion', () => {
    test('should update completion successfully', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const updates = { notes: 'Updated notes' };
      const result = await updateCompletion(mockHass, 456, updates);

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'update_completion',
        { completion_id: 456, notes: 'Updated notes' },
        {},
        true,
        true
      );
      expect(showSuccess).toHaveBeenCalledWith('Completion updated successfully');
      expect(result).toEqual({ success: true });
    });

    test('should handle errors', async () => {
      mockHass.callService.mockRejectedValue(new Error('Update failed'));
      ensureServiceSuccess.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await updateCompletion(mockHass, 456, { notes: 'New notes' });

      expect(showError).toHaveBeenCalledWith('Failed to update completion');
      expect(handleActionError).toHaveBeenCalled();
    });
  });

  describe('updateTask', () => {
    test('should update task successfully', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const updates = { name: 'Updated Task' };
      const result = await updateTask(mockHass, 123, 'RecurringTask', ['user1'], updates);

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'update_task',
        {
          task_id: 123,
          task_type: 'RecurringTask',
          assigned_users: ['user1'],
          name: 'Updated Task'
        },
        {},
        true,
        true
      );
      expect(result).toEqual({ success: true });
    });

    test('should not override assigned_users in updates', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const updates = { assigned_users: ['user2'], name: 'Updated' };
      await updateTask(mockHass, 123, 'RecurringTask', ['user1'], updates);

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'update_task',
        {
          task_id: 123,
          task_type: 'RecurringTask',
          assigned_users: ['user2'],
          name: 'Updated'
        },
        {},
        true,
        true
      );
    });

    test('should handle errors', async () => {
      mockHass.callService.mockRejectedValue(new Error('Update failed'));
      ensureServiceSuccess.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await updateTask(mockHass, 123, 'RecurringTask', ['user1'], { name: 'Test' });

      expect(handleActionError).toHaveBeenCalled();
    });
  });

  describe('snoozeTask', () => {
    test('should snooze task successfully', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const task = { id: 123, task_type: 'RecurringTask' };
      const result = await snoozeTask(mockHass, task, '2025-01-20', ['user1']);

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'update_task',
        {
          task_id: 123,
          task_type: 'RecurringTask',
          assigned_users: ['user1'],
          next_due: '2025-01-20'
        },
        {},
        true,
        true
      );
      expect(showSuccess).toHaveBeenCalledWith('Task snoozed');
      expect(result).toBe(true);
    });

    test('should call refresh callback after snooze', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const task = { id: 123, task_type: 'RecurringTask' };
      const refreshCallback = jest.fn();

      await snoozeTask(mockHass, task, '2025-01-20', ['user1'], refreshCallback);

      expect(refreshCallback).toHaveBeenCalled();
    });

    test('should handle task_id field', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const task = { task_id: 123, task_type: 'RecurringTask' };
      await snoozeTask(mockHass, task, '2025-01-20', ['user1']);

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'update_task',
        expect.objectContaining({ task_id: 123 }),
        {},
        true,
        true
      );
    });

    test('should handle errors', async () => {
      mockHass.callService.mockRejectedValue(new Error('Snooze failed'));
      ensureServiceSuccess.mockImplementation(() => {
        throw new Error('Snooze failed');
      });

      const task = { id: 123, task_type: 'RecurringTask' };
      const result = await snoozeTask(mockHass, task, '2025-01-20', ['user1']);

      expect(showError).toHaveBeenCalledWith('Failed to snooze task');
      expect(result).toBe(false);
    });
  });

  describe('disposeLeftover', () => {
    test('should dispose leftover successfully', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const result = await disposeLeftover(mockHass, 'Old leftover', 'testuser', 'Thrown out');

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'complete_task_by_name',
        {
          name: 'Old leftover',
          event_type: 'leftover_disposed',
          username: 'testuser',
          notes: 'Thrown out'
        },
        {},
        true,
        true
      );
      expect(result).toEqual({ success: true });
    });

    test('should handle optional parameters', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      await disposeLeftover(mockHass, 'Old leftover');

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'complete_task_by_name',
        {
          name: 'Old leftover',
          event_type: 'leftover_disposed'
        },
        {},
        true,
        true
      );
    });

    test('should handle errors', async () => {
      mockHass.callService.mockRejectedValue(new Error('Dispose failed'));
      ensureServiceSuccess.mockImplementation(() => {
        throw new Error('Dispose failed');
      });

      await disposeLeftover(mockHass, 'Old leftover');

      expect(handleActionError).toHaveBeenCalled();
    });
  });

  describe('createTaskFromDescription', () => {
    test('should create task successfully', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const result = await createTaskFromDescription(
        mockHass,
        'RecurringTask',
        'Water plants every week',
        ['user1']
      );

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'create_task_from_description',
        {
          task_type: 'RecurringTask',
          task_description: 'Water plants every week',
          assigned_users: ['user1']
        },
        {},
        true,
        true
      );
      expect(showSuccess).toHaveBeenCalledWith('Task created');
      expect(result).toEqual({ success: true });
    });

    test('should handle optional assigned_users', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      await createTaskFromDescription(mockHass, 'RecurringTask', 'Water plants');

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'create_task_from_description',
        {
          task_type: 'RecurringTask',
          task_description: 'Water plants'
        },
        {},
        true,
        true
      );
    });

    test('should handle errors', async () => {
      mockHass.callService.mockRejectedValue(new Error('Create failed'));
      ensureServiceSuccess.mockImplementation(() => {
        throw new Error('Create failed');
      });

      await createTaskFromDescription(mockHass, 'RecurringTask', 'Water plants');

      expect(showError).toHaveBeenCalledWith('Failed to create task');
      expect(handleActionError).toHaveBeenCalled();
    });
  });

  describe('deleteTask', () => {
    test('should delete task successfully', async () => {
      mockHass.callService.mockResolvedValue({
        response: { success: true }
      });

      const result = await deleteTask(mockHass, 123, 'RecurringTask');

      expect(mockHass.callService).toHaveBeenCalledWith(
        'tasktracker',
        'delete_task',
        {
          task_id: 123,
          task_type: 'RecurringTask'
        },
        {},
        true,
        true
      );
      expect(showSuccess).toHaveBeenCalledWith('Task deleted');
      expect(result).toEqual({ success: true });
    });

    test('should handle errors', async () => {
      mockHass.callService.mockRejectedValue(new Error('Delete failed'));
      ensureServiceSuccess.mockImplementation(() => {
        throw new Error('Delete failed');
      });

      await deleteTask(mockHass, 123, 'RecurringTask');

      expect(showError).toHaveBeenCalledWith('Failed to delete task');
      expect(handleActionError).toHaveBeenCalled();
    });
  });
});
