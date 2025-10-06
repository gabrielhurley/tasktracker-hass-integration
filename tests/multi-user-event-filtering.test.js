/**
 * Tests for multi-user event filtering in frontend cards
 *
 * These tests verify that cards intelligently filter task completion events
 * based on assigned_users to avoid unnecessary refreshes.
 */

describe('Multi-User Event Filtering', () => {
  describe('Daily Plan Card Event Filtering', () => {
    let card;
    let mockHass;
    let eventCallbacks;

    beforeEach(() => {
      // Reset DOM
      document.body.innerHTML = '';

      // Mock event system
      eventCallbacks = {};

      mockHass = {
        callService: jest.fn().mockResolvedValue({
          response: {
            success: true,
            data: { tasks: [], self_care: [] },
            user_context: {}
          }
        }),
        connection: {
          subscribeMessage: jest.fn((callback, config) => {
            eventCallbacks[config.event_type] = callback;
            return Promise.resolve(() => {});
          })
        },
        auth: {
          async_get_users: jest.fn().mockResolvedValue([])
        }
      };

      // Import and create card
      const cardModule = require('../custom_components/tasktracker/www/tasktracker-daily-plan-card.js');
      card = document.createElement('tasktracker-daily-plan-card');
      document.body.appendChild(card);

      card.setConfig({
        user_filter_mode: 'explicit',
        explicit_user: 'sara'
      });
      card.hass = mockHass;
    });

    test('should refresh when current user is in assigned_users', async () => {
      const fetchPlanSpy = jest.spyOn(card, '_fetchPlan');

      // Fire event with assigned_users including current user
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'gabriel',
          assigned_users: ['gabriel', 'sara']
        }
      });

      expect(fetchPlanSpy).toHaveBeenCalled();
    });

    test('should not refresh when current user is not in assigned_users', async () => {
      const fetchPlanSpy = jest.spyOn(card, '_fetchPlan');

      // Fire event with assigned_users NOT including current user
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'gabriel',
          assigned_users: ['gabriel', 'alice']
        }
      });

      expect(fetchPlanSpy).not.toHaveBeenCalled();
    });

    test('should refresh when assigned_users is empty (safe fallback)', async () => {
      const fetchPlanSpy = jest.spyOn(card, '_fetchPlan');

      // Fire event with empty assigned_users
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'gabriel',
          assigned_users: []
        }
      });

      expect(fetchPlanSpy).toHaveBeenCalled();
    });

    test('should refresh when current user is the completer', async () => {
      const fetchPlanSpy = jest.spyOn(card, '_fetchPlan');

      // Fire event where current user completed the task
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'sara',  // Current user
          assigned_users: ['gabriel']  // Different user
        }
      });

      expect(fetchPlanSpy).toHaveBeenCalled();
    });

    test('should always refresh when no user configured', async () => {
      // Reconfigure card without explicit user
      card.setConfig({
        user_filter_mode: 'current'  // No explicit user
      });

      const fetchPlanSpy = jest.spyOn(card, '_fetchPlan');

      // Fire event
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'gabriel',
          assigned_users: ['alice']
        }
      });

      expect(fetchPlanSpy).toHaveBeenCalled();
    });
  });

  describe('Available Tasks Card Event Filtering', () => {
    let card;
    let mockHass;
    let eventCallbacks;

    beforeEach(() => {
      document.body.innerHTML = '';

      eventCallbacks = {};

      mockHass = {
        callService: jest.fn().mockResolvedValue({
          response: {
            success: true,
            data: { tasks: [] }
          }
        }),
        connection: {
          subscribeMessage: jest.fn((callback, config) => {
            eventCallbacks[config.event_type] = callback;
            return Promise.resolve(() => {});
          })
        },
        auth: {
          async_get_users: jest.fn().mockResolvedValue([])
        }
      };

      const cardModule = require('../custom_components/tasktracker/www/tasktracker-available-tasks-card.js');
      card = document.createElement('tasktracker-available-tasks-card');
      document.body.appendChild(card);

      card.setConfig({
        user_filter_mode: 'explicit',
        explicit_user: 'gabriel'
      });
      card.hass = mockHass;
    });

    test('should use _shouldRefreshForUser with assigned_users array', async () => {
      const shouldRefreshSpy = jest.spyOn(card, '_shouldRefreshForUser');
      const fetchTasksSpy = jest.spyOn(card, '_fetchAvailableTasks');

      // Fire event with assigned_users
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'sara',
          assigned_users: ['gabriel', 'sara']
        }
      });

      expect(shouldRefreshSpy).toHaveBeenCalledWith(['gabriel', 'sara']);
      expect(fetchTasksSpy).toHaveBeenCalled();
    });

    test('should refresh when user_filter_mode is "all"', async () => {
      card.setConfig({
        user_filter_mode: 'all'
      });

      const fetchTasksSpy = jest.spyOn(card, '_fetchAvailableTasks');

      // Fire event with assigned_users not including any specific user
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'alice',
          assigned_users: ['alice', 'bob']
        }
      });

      expect(fetchTasksSpy).toHaveBeenCalled();
    });
  });

  describe('Recent Tasks Card Event Filtering', () => {
    let card;
    let mockHass;
    let eventCallbacks;

    beforeEach(() => {
      document.body.innerHTML = '';

      eventCallbacks = {};

      mockHass = {
        callService: jest.fn().mockResolvedValue({
          response: {
            success: true,
            data: { completions: [] }
          }
        }),
        connection: {
          subscribeMessage: jest.fn((callback, config) => {
            eventCallbacks[config.event_type] = callback;
            return Promise.resolve(() => {});
          })
        },
        auth: {
          async_get_users: jest.fn().mockResolvedValue([])
        }
      };

      const cardModule = require('../custom_components/tasktracker/www/tasktracker-recent-tasks-card.js');
      card = document.createElement('tasktracker-recent-tasks-card');
      document.body.appendChild(card);

      card.setConfig({
        user_filter_mode: 'explicit',
        explicit_user: 'sara'
      });
      card.hass = mockHass;
    });

    test('should refresh for task completions affecting current user', async () => {
      const fetchCompletionsSpy = jest.spyOn(card, '_fetchRecentCompletions');

      // Fire event with assigned_users including current user
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'gabriel',
          assigned_users: ['gabriel', 'sara']
        }
      });

      expect(fetchCompletionsSpy).toHaveBeenCalled();
    });

    test('should also refresh for leftover disposals with assigned_users', async () => {
      const fetchCompletionsSpy = jest.spyOn(card, '_fetchRecentCompletions');

      // Fire leftover disposal event
      const callback = eventCallbacks['tasktracker_leftover_disposed'];
      await callback({
        event_type: 'tasktracker_leftover_disposed',
        data: {
          leftover_name: 'Old Pizza',
          username: 'sara',
          assigned_users: ['sara', 'gabriel']
        }
      });

      expect(fetchCompletionsSpy).toHaveBeenCalled();
    });
  });

  describe('Edge Cases and Backward Compatibility', () => {
    test('should handle events without assigned_users field (old event format)', async () => {
      document.body.innerHTML = '';

      const eventCallbacks = {};
      const mockHass = {
        callService: jest.fn().mockResolvedValue({
          response: {
            success: true,
            data: { tasks: [], self_care: [] },
            user_context: {}
          }
        }),
        connection: {
          subscribeMessage: jest.fn((callback, config) => {
            eventCallbacks[config.event_type] = callback;
            return Promise.resolve(() => {});
          })
        },
        auth: {
          async_get_users: jest.fn().mockResolvedValue([])
        }
      };

      const cardModule = require('../custom_components/tasktracker/www/tasktracker-daily-plan-card.js');
      const card = document.createElement('tasktracker-daily-plan-card');
      document.body.appendChild(card);

      card.setConfig({
        user_filter_mode: 'explicit',
        explicit_user: 'sara'
      });
      card.hass = mockHass;

      const fetchPlanSpy = jest.spyOn(card, '_fetchPlan');

      // Fire event WITHOUT assigned_users field (old format)
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'gabriel'
          // No assigned_users field
        }
      });

      // Should refresh as safe fallback
      expect(fetchPlanSpy).toHaveBeenCalled();
    });

    test('should handle undefined assigned_users', async () => {
      document.body.innerHTML = '';

      const eventCallbacks = {};
      const mockHass = {
        callService: jest.fn().mockResolvedValue({
          response: {
            success: true,
            data: { tasks: [], self_care: [] },
            user_context: {}
          }
        }),
        connection: {
          subscribeMessage: jest.fn((callback, config) => {
            eventCallbacks[config.event_type] = callback;
            return Promise.resolve(() => {});
          })
        },
        auth: {
          async_get_users: jest.fn().mockResolvedValue([])
        }
      };

      const cardModule = require('../custom_components/tasktracker/www/tasktracker-daily-plan-card.js');
      const card = document.createElement('tasktracker-daily-plan-card');
      document.body.appendChild(card);

      card.setConfig({
        user_filter_mode: 'explicit',
        explicit_user: 'sara'
      });
      card.hass = mockHass;

      const fetchPlanSpy = jest.spyOn(card, '_fetchPlan');

      // Fire event with explicitly undefined assigned_users
      const callback = eventCallbacks['tasktracker_task_completed'];
      await callback({
        event_type: 'tasktracker_task_completed',
        data: {
          task_id: 123,
          username: 'gabriel',
          assigned_users: undefined
        }
      });

      // Should refresh as safe fallback
      expect(fetchPlanSpy).toHaveBeenCalled();
    });
  });
});
