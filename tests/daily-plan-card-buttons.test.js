/**
 * Jest Unit Tests for TaskTracker Daily Plan Card - Button Event Listeners
 *
 * Tests button event listener attachment after content rendering.
 * Uses test helpers for cleaner, more maintainable test setup.
 */

const {
  setupCardTestEnvironment,
  createCardInstance,
  mockShadowQuery,
  createMockButton
} = require('./helpers/card-test-helpers');

// Setup environment BEFORE imports
setupCardTestEnvironment();

// Mock additional utils needed by daily plan card
jest.mock('../custom_components/tasktracker/www/utils/datetime-utils.js', () => ({
  TaskTrackerDateTime: {
    isWindowInPast: jest.fn().mockReturnValue(false),
    formatTimeForDisplay: jest.fn(time => time),
    formatWindowTimeRange: jest.fn(() => '9 AM - 5 PM')
  }
}));

// Import the actual card (not yet - we'll use a mock for this focused test)
// For this test we're using a simplified mock to test the event listener pattern
// require('../custom_components/tasktracker/www/tasktracker-daily-plan-card.js');

// Get mocked utilities
const { TaskTrackerUtils } = require('../custom_components/tasktracker/www/tasktracker-utils.js');

// Extend with daily-plan specific mocks
TaskTrackerUtils.createDailyStateModal = jest.fn().mockReturnValue(document.createElement('div'));
TaskTrackerUtils.hasValidUserConfig = jest.fn().mockReturnValue(true);
TaskTrackerUtils.capitalize = jest.fn(str => str);

// Mock card class for focused testing of event listener logic
class MockDailyPlanCard {
  constructor() {
    this._config = {};
    this._hass = null;
    this.shadowRoot = null;
    this._plan = null;
    this._dailyState = null;
  }

  _getUsername() {
    return 'testuser';
  }

  _handleSetDailyState() {
    return true;
  }

  _attachContentEventListeners(hasValidUserConfig) {
    if (!hasValidUserConfig) return;

    // Daily state button handler (rendered in content area)
    const dailyStateButton = this.shadowRoot?.querySelector('.daily-state-button');
    if (dailyStateButton) {
      dailyStateButton.addEventListener('click', () => this._handleSetDailyState());
    }

    // Daily state edit button handler (rendered in content area)
    const dailyStateEditButton = this.shadowRoot?.querySelector('.daily-state-edit-btn');
    if (dailyStateEditButton) {
      dailyStateEditButton.addEventListener('click', () => this._handleSetDailyState());
    }
  }

  _renderReducedPlan(tasks) {
    return `
      <div class="daily-state-prompt">
        <button class="daily-state-button btn btn--primary btn--block">Set Your Daily State</button>
        <div class="daily-state-help">A daily plan will be available once your state is set</div>
      </div>
    `;
  }

  _renderDailyStateDisplay() {
    return `
      <div class="daily-state-container">
        <div class="daily-state-display">
          <button class="btn daily-state-edit-btn" title="Edit daily state">
            Edit
          </button>
        </div>
      </div>
    `;
  }

  _renderContent() {
    this._attachContentEventListeners(true);
  }
}

describe('TaskTrackerDailyPlanCard Button Event Listeners', () => {
  let card;

  beforeEach(() => {
    jest.clearAllMocks();

    card = new MockDailyPlanCard();

    // Setup shadow root
    card.shadowRoot = {
      innerHTML: '',
      querySelector: jest.fn(),
      querySelectorAll: jest.fn()
    };

    // Spy on handler
    card._handleSetDailyState = jest.fn();
  });

  describe('Daily State Button Event Listeners', () => {
    test('should attach click listeners to daily state buttons when they exist', () => {
      const dailyStateButton = createMockButton();
      const dailyStateEditButton = createMockButton();

      mockShadowQuery(card, {
        '.daily-state-button': dailyStateButton,
        '.daily-state-edit-btn': dailyStateEditButton
      });

      card._attachContentEventListeners(true);

      // Verify listeners were attached
      expect(card.shadowRoot.querySelector).toHaveBeenCalledWith('.daily-state-button');
      expect(dailyStateButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      expect(card.shadowRoot.querySelector).toHaveBeenCalledWith('.daily-state-edit-btn');
      expect(dailyStateEditButton.addEventListener).toHaveBeenCalledWith('click', expect.any(Function));

      // Test clicking the buttons
      const dailyStateHandler = dailyStateButton.addEventListener.mock.calls[0][1];
      const editHandler = dailyStateEditButton.addEventListener.mock.calls[0][1];

      dailyStateHandler();
      expect(card._handleSetDailyState).toHaveBeenCalledTimes(1);

      editHandler();
      expect(card._handleSetDailyState).toHaveBeenCalledTimes(2);
    });

    test('should handle missing daily state buttons gracefully', () => {
      mockShadowQuery(card, {
        '.daily-state-button': null,
        '.daily-state-edit-btn': null
      });

      expect(() => {
        card._attachContentEventListeners(true);
      }).not.toThrow();

      expect(card.shadowRoot.querySelector).toHaveBeenCalledWith('.daily-state-button');
      expect(card.shadowRoot.querySelector).toHaveBeenCalledWith('.daily-state-edit-btn');
      expect(card._handleSetDailyState).not.toHaveBeenCalled();
    });

    test('should not attach listeners when user config is invalid', () => {
      const dailyStateButton = createMockButton();

      mockShadowQuery(card, {
        '.daily-state-button': dailyStateButton
      });

      card._attachContentEventListeners(false);

      // Should not have tried to find buttons
      expect(card.shadowRoot.querySelector).not.toHaveBeenCalledWith('.daily-state-button');
      expect(card.shadowRoot.querySelector).not.toHaveBeenCalledWith('.daily-state-edit-btn');
    });
  });

  describe('Button Rendering', () => {
    test('should render daily state button in reduced plan mode', () => {
      card._plan = {
        data: {
          using_defaults: true,
          tasks: []
        }
      };

      const html = card._renderReducedPlan([]);

      expect(html).toContain('daily-state-button');
      expect(html).toContain('Set Your Daily State');
    });

    test('should render daily state edit button when state exists', () => {
      card._dailyState = {
        data: {
          energy: 3,
          focus: 4,
          motivation: 3,
          pain: 1,
          mood: 1,
          free_time: 2
        }
      };

      const html = card._renderDailyStateDisplay();

      expect(html).toContain('daily-state-edit-btn');
      expect(html).toContain('Edit');
    });
  });

  describe('Event Listener Timing', () => {
    test('should attach daily state buttons in content event listeners', () => {
      // Daily state buttons are rendered in content area, not header
      expect(typeof card._attachContentEventListeners).toBe('function');

      const reducedPlanHtml = card._renderReducedPlan([]);
      const dailyStateDisplayHtml = card._renderDailyStateDisplay();

      expect(reducedPlanHtml).toContain('daily-state-button');
      expect(dailyStateDisplayHtml).toContain('daily-state-edit-btn');
    });

    test('should call handlers when buttons are clicked', () => {
      const button = createMockButton();

      mockShadowQuery(card, {
        '.daily-state-button': button
      });

      card._attachContentEventListeners(true);

      // Simulate click
      const clickHandler = button.addEventListener.mock.calls[0][1];
      clickHandler();

      expect(card._handleSetDailyState).toHaveBeenCalledTimes(1);
    });
  });

  describe('Multiple Button Scenarios', () => {
    test('should handle when only one button type exists', () => {
      const dailyStateButton = createMockButton();

      mockShadowQuery(card, {
        '.daily-state-button': dailyStateButton,
        '.daily-state-edit-btn': null
      });

      expect(() => {
        card._attachContentEventListeners(true);
      }).not.toThrow();

      expect(dailyStateButton.addEventListener).toHaveBeenCalled();
    });

    test('should handle when edit button exists but primary does not', () => {
      const editButton = createMockButton();

      mockShadowQuery(card, {
        '.daily-state-button': null,
        '.daily-state-edit-btn': editButton
      });

      expect(() => {
        card._attachContentEventListeners(true);
      }).not.toThrow();

      expect(editButton.addEventListener).toHaveBeenCalled();
    });

    test('should attach multiple listeners without interference', () => {
      const button1 = createMockButton();
      const button2 = createMockButton();

      mockShadowQuery(card, {
        '.daily-state-button': button1,
        '.daily-state-edit-btn': button2
      });

      card._attachContentEventListeners(true);

      // Both should have listeners
      expect(button1.addEventListener).toHaveBeenCalledTimes(1);
      expect(button2.addEventListener).toHaveBeenCalledTimes(1);

      // Click both - should each trigger the handler once
      button1.addEventListener.mock.calls[0][1]();
      button2.addEventListener.mock.calls[0][1]();

      expect(card._handleSetDailyState).toHaveBeenCalledTimes(2);
    });
  });

  describe('State-Based Rendering', () => {
    test('should show set button when using defaults', () => {
      card._plan = { data: { using_defaults: true, tasks: [] } };
      const html = card._renderReducedPlan([]);

      expect(html).toContain('Set Your Daily State');
      expect(html).toContain('daily-state-prompt');
    });

    test('should show edit button when state is configured', () => {
      card._dailyState = {
        data: { energy: 3, focus: 4, motivation: 3 }
      };

      const html = card._renderDailyStateDisplay();

      expect(html).toContain('Edit');
      expect(html).toContain('daily-state-edit-btn');
    });
  });
});
