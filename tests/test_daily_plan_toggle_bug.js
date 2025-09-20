/**
 * Test for the recommendation filter toggle bug after partial updates
 *
 * Bug: When partial updates succeed, the toggle button loses its event listener
 * because _render() is not called and event listeners are only attached in _render()
 */

// Mock Home Assistant
global.customElements = {
  define: jest.fn(),
  get: jest.fn()
};

global.HTMLElement = class HTMLElement {
  constructor() {
    this.shadowRoot = null;
    this.attachShadow = () => {
      this.shadowRoot = {
        innerHTML: '',
        querySelector: jest.fn(),
        querySelectorAll: jest.fn(() => [])
      };
      return this.shadowRoot;
    };
  }
};

// Import the card after setting up mocks
const { TaskTrackerDailyPlanCard } = require('../custom_components/tasktracker/www/tasktracker-daily-plan-card.js');

describe('Daily Plan Card Toggle Bug', () => {
  let card;
  let mockHass;

  beforeEach(() => {
    // Setup DOM environment
    document.body.innerHTML = '';

    // Create card instance
    card = new TaskTrackerDailyPlanCard();
    card.attachShadow({ mode: 'open' });

    // Mock HASS
    mockHass = {
      callService: jest.fn(),
      states: {},
      connection: {
        subscribeEvents: jest.fn(() => Promise.resolve(() => {}))
      }
    };

    // Set up card
    card.setConfig({
      user_filter_mode: 'explicit',
      explicit_user: 'testuser',
      default_filter_recommended: true
    });
    card.hass = mockHass;

    // Mock querySelector to return a mock button element
    const mockToggleButton = {
      addEventListener: jest.fn(),
      classList: { toggle: jest.fn() },
      title: '',
      innerHTML: ''
    };

    card.shadowRoot.querySelector = jest.fn((selector) => {
      if (selector === '.filter-toggle-btn') {
        return mockToggleButton;
      }
      return null;
    });
  });

  test('toggle button has event listener after initial render', async () => {
    // Mock initial API response
    mockHass.callService.mockResolvedValueOnce({
      response: {
        data: {
          self_care_tasks: [],
          tasks: [],
          daily_state_display: {}
        },
        user_context: {
          timezone: 'America/Los_Angeles',
          daily_reset_time: '05:00:00',
          current_logical_date: '2025-01-15'
        }
      }
    });

    // Initial render
    await card._fetchPlan();

    // Verify toggle button event listener was attached
    const toggleButton = card.shadowRoot.querySelector('.filter-toggle-btn');
    expect(toggleButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));
  });

  test('toggle button loses event listener after partial update', async () => {
    // Setup initial state
    card._plan = {
      data: {
        self_care_tasks: [{ id: 1, task_type: 'SelfCareTask', name: 'Test Task' }],
        tasks: [],
        daily_state_display: {}
      },
      user_context: {
        timezone: 'America/Los_Angeles',
        daily_reset_time: '05:00:00',
        current_logical_date: '2025-01-15'
      }
    };
    card._previousData = card._plan.data;
    card._userContext = card._plan.user_context;

    // Mock API response for partial update (task completed)
    mockHass.callService.mockResolvedValueOnce({
      response: {
        data: {
          self_care_tasks: [], // Task was completed and removed
          tasks: [],
          daily_state_display: {}
        },
        user_context: {
          timezone: 'America/Los_Angeles',
          daily_reset_time: '05:00:00',
          current_logical_date: '2025-01-15'
        }
      }
    });

    // Create fresh mock button to simulate lost event listener
    const mockToggleButtonAfterUpdate = {
      addEventListener: jest.fn(),
      classList: { toggle: jest.fn() },
      title: '',
      innerHTML: ''
    };

    // Setup querySelector to return the "new" button (simulating DOM update without event listener)
    card.shadowRoot.querySelector = jest.fn((selector) => {
      if (selector === '.filter-toggle-btn') {
        return mockToggleButtonAfterUpdate;
      }
      return null;
    });

    // Trigger partial update
    await card._fetchPlan();

    // BUG: The toggle button should have its event listener re-attached, but it doesn't
    // because _render() is not called during successful partial updates
    const toggleButtonAfterUpdate = card.shadowRoot.querySelector('.filter-toggle-btn');

    // This assertion demonstrates the bug - the event listener is NOT re-attached
    expect(toggleButtonAfterUpdate.addEventListener).not.toHaveBeenCalled();
  });

  test('toggle functionality works correctly when event listener is present', () => {
    // Setup initial state
    card._showRecommendedOnly = true;

    // Mock the _fetchPlan method to track calls
    card._fetchPlan = jest.fn();

    // Test the toggle function directly
    card._toggleRecommendationFilter();

    // Verify state changed
    expect(card._showRecommendedOnly).toBe(false);

    // Verify _fetchPlan was called to refresh data
    expect(card._fetchPlan).toHaveBeenCalled();
  });

  test('partial update correctly identifies when it should run', () => {
    const oldData = {
      self_care_tasks: [{ id: 1, task_type: 'SelfCareTask', name: 'Test Task' }],
      tasks: [],
      daily_state_display: {}
    };

    const newData = {
      self_care_tasks: [], // Task completed
      tasks: [],
      daily_state_display: {}
    };

    // Verify that this change qualifies for partial update
    expect(card._canDoPartialUpdate(oldData, newData)).toBe(true);

    // Verify the change is identified correctly
    const changes = card._identifyChanges(oldData, newData);
    expect(changes.removedSelfCareTasks).toHaveLength(1);
    expect(changes.removedSelfCareTasks[0].id).toBe(1);
  });
});
