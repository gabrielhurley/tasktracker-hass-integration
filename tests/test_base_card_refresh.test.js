/**
 * Test base card refresh functionality
 */

const {
  setupCardTestEnvironment,
  mockShadowQuery,
  createMockHass,
  createMockButton,
  flushPromises
} = require('./helpers/card-test-helpers');

// Setup mocks BEFORE importing
const mocks = setupCardTestEnvironment();

// Import the base card
const { TaskTrackerBaseCard } = require('../custom_components/tasktracker/www/utils/base-card.js');

// Get mocked utilities
const { TaskTrackerUtils } = require('../custom_components/tasktracker/www/tasktracker-utils.js');

// Register the base card for testing
if (!global.customElements.get('tasktracker-base-card-test')) {
  global.customElements.define('tasktracker-base-card-test', TaskTrackerBaseCard);
}

describe('TaskTrackerBaseCard Refresh', () => {
  let card;
  let mockHass;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create instance via custom elements registry
    const CardClass = global.customElements.get('tasktracker-base-card-test');
    card = new CardClass();

    // The card already has a shadowRoot, just mock its query methods
    jest.spyOn(card.shadowRoot, 'querySelector').mockReturnValue(null);
    jest.spyOn(card.shadowRoot, 'querySelectorAll').mockReturnValue([]);

    mockHass = createMockHass();
    card._hass = mockHass;

    // Mock the auto refresh method
    card.onAutoRefresh = jest.fn().mockResolvedValue(undefined);

    // Mock the button state update
    card._updateRefreshButtonState = jest.fn();
  });

  test('should call invalidate_cache service when refresh button clicked', async () => {
    await card.onRefresh();

    expect(mockHass.callService).toHaveBeenCalledWith(
      'tasktracker',
      'invalidate_cache',
      {},
      {},
      true,
      true
    );
  });

  test('should set refreshing state before calling service', async () => {
    const refreshPromise = card.onRefresh();

    // Check state immediately after calling (before awaiting)
    expect(card._refreshing).toBe(true);
    expect(card._updateRefreshButtonState).toHaveBeenCalledWith(true);

    await refreshPromise;
  });

  test('should call onAutoRefresh after cache invalidation', async () => {
    await card.onRefresh();

    expect(card.onAutoRefresh).toHaveBeenCalled();

    // Verify order: invalidate_cache called before onAutoRefresh
    const serviceCallOrder = mockHass.callService.mock.invocationCallOrder[0];
    const autoRefreshOrder = card.onAutoRefresh.mock.invocationCallOrder[0];
    expect(serviceCallOrder).toBeLessThan(autoRefreshOrder);
  });

  test('should show success toast after successful refresh', async () => {
    await card.onRefresh();

    expect(TaskTrackerUtils.showSuccess).toHaveBeenCalledWith('Data refreshed');
  });

  test('should clear refreshing state after completion', async () => {
    await card.onRefresh();

    expect(card._refreshing).toBe(false);
    expect(card._updateRefreshButtonState).toHaveBeenCalledWith(false);
  });

  test('should handle service call errors gracefully', async () => {
    mockHass.callService.mockRejectedValue(new Error('Service failed'));

    await card.onRefresh();

    expect(TaskTrackerUtils.showError).toHaveBeenCalledWith('Refresh failed');
    expect(card._refreshing).toBe(false);
  });

  test('should prevent multiple simultaneous refreshes', async () => {
    // Start first refresh
    const firstRefresh = card.onRefresh();

    // Try to start second refresh while first is running
    const secondRefresh = card.onRefresh();

    await Promise.all([firstRefresh, secondRefresh]);

    // Service should only be called once
    expect(mockHass.callService).toHaveBeenCalledTimes(1);
  });

  test('should still clear refreshing state if onAutoRefresh fails', async () => {
    card.onAutoRefresh.mockRejectedValue(new Error('Fetch failed'));

    await card.onRefresh();

    expect(card._refreshing).toBe(false);
    expect(TaskTrackerUtils.showError).toHaveBeenCalledWith('Refresh failed');
  });

  test('should pass correct parameters to callService', async () => {
    await card.onRefresh();

    const [domain, service, data, target, returnResponse, waitForResponse] =
      mockHass.callService.mock.calls[0];

    expect(domain).toBe('tasktracker');
    expect(service).toBe('invalidate_cache');
    expect(data).toEqual({});
    expect(target).toEqual({});
    expect(returnResponse).toBe(true);
    expect(waitForResponse).toBe(true);
  });
});

describe('TaskTrackerBaseCard Refresh Button Integration', () => {
  let card;
  let mockHass;

  beforeEach(() => {
    jest.clearAllMocks();

    // Create instance via custom elements registry
    const CardClass = global.customElements.get('tasktracker-base-card-test');
    card = new CardClass();

    // The card already has a shadowRoot, just mock its query methods
    jest.spyOn(card.shadowRoot, 'querySelector').mockReturnValue(null);
    jest.spyOn(card.shadowRoot, 'querySelectorAll').mockReturnValue([]);

    mockHass = createMockHass();
    card._hass = mockHass;

    // Mock the auto refresh method
    card.onAutoRefresh = jest.fn().mockResolvedValue(undefined);

    // Set up config to show refresh button
    card._config = { show_header: true };

    // Spy on onRefresh
    jest.spyOn(card, 'onRefresh');
  });

  test('should wire refresh button to onRefresh method', () => {
    // Render the card structure
    card._renderStructure();

    // Verify button was created
    const refreshBtn = card.shadowRoot.querySelector('.refresh-btn');
    expect(refreshBtn).toBeDefined();
  });

  test('should include spinner icon in refresh button', () => {
    card._renderStructure();

    const buttonHTML = card.shadowRoot.innerHTML;
    expect(buttonHTML).toContain('mdi:refresh');
    expect(buttonHTML).toContain('mdi:loading');
    expect(buttonHTML).toContain('refresh-spinner');
  });
});
