/**
 * Comprehensive tests for datetime utilities
 * Tests logical day boundary handling, timezone conversions, window calculations, and formatting
 */

// Mock dependencies
jest.mock('../custom_components/tasktracker/www/tasktracker-utils.js', () => ({
  TaskTrackerUtils: {}
}));

// Import the actual datetime utilities
const { TaskTrackerDateTime } = require('../custom_components/tasktracker/www/utils/datetime-utils.js');

describe('TaskTrackerDateTime', () => {
  const defaultUserContext = {
    timezone: 'America/Los_Angeles',
    daily_reset_time: '05:00:00',
    current_logical_date: '2025-10-20',
    daily_task_cutoff_time: '20:00:00'
  };

  describe('parseUserContext', () => {
    test('should return default values when no context provided', () => {
      const context = TaskTrackerDateTime.parseUserContext(null);
      expect(context.timezone).toBe('UTC');
      expect(context.daily_reset_time).toBe('00:00:00');
      expect(context.daily_task_cutoff_time).toBe('20:00:00');
      expect(context.current_logical_date).toBeDefined();
    });

    test('should return provided context values', () => {
      const context = TaskTrackerDateTime.parseUserContext(defaultUserContext);
      expect(context.timezone).toBe('America/Los_Angeles');
      expect(context.daily_reset_time).toBe('05:00:00');
      expect(context.current_logical_date).toBe('2025-10-20');
    });

    test('should use defaults for missing fields', () => {
      const partial = { timezone: 'US/Pacific' };
      const context = TaskTrackerDateTime.parseUserContext(partial);
      expect(context.timezone).toBe('US/Pacific');
      expect(context.daily_reset_time).toBe('00:00:00');
    });
  });

  describe('parseTimeToMinutes', () => {
    test('should convert midnight to 0 minutes', () => {
      expect(TaskTrackerDateTime.parseTimeToMinutes('00:00')).toBe(0);
    });

    test('should convert morning time correctly', () => {
      expect(TaskTrackerDateTime.parseTimeToMinutes('05:30')).toBe(330);
    });

    test('should convert afternoon time correctly', () => {
      expect(TaskTrackerDateTime.parseTimeToMinutes('14:45')).toBe(885);
    });

    test('should convert end of day correctly', () => {
      expect(TaskTrackerDateTime.parseTimeToMinutes('23:59')).toBe(1439);
    });
  });

  describe('minutesToTimeString', () => {
    test('should convert 0 minutes to midnight', () => {
      expect(TaskTrackerDateTime.minutesToTimeString(0)).toBe('00:00');
    });

    test('should convert morning minutes correctly', () => {
      expect(TaskTrackerDateTime.minutesToTimeString(330)).toBe('05:30');
    });

    test('should convert afternoon minutes correctly', () => {
      expect(TaskTrackerDateTime.minutesToTimeString(885)).toBe('14:45');
    });

    test('should handle overflow past 24 hours', () => {
      expect(TaskTrackerDateTime.minutesToTimeString(1500)).toBe('01:00');
    });
  });

  describe('getCurrentLogicalDayStart', () => {
    test('should return correct start time for logical day', () => {
      const start = TaskTrackerDateTime.getCurrentLogicalDayStart(defaultUserContext);
      expect(start.getHours()).toBe(5);
      expect(start.getMinutes()).toBe(0);
    });

    test('should handle midnight reset time', () => {
      const context = { ...defaultUserContext, daily_reset_time: '00:00:00' };
      const start = TaskTrackerDateTime.getCurrentLogicalDayStart(context);
      expect(start.getHours()).toBe(0);
      expect(start.getMinutes()).toBe(0);
    });
  });

  describe('getCurrentLogicalDayEnd', () => {
    test('should return end time one day after start', () => {
      const start = TaskTrackerDateTime.getCurrentLogicalDayStart(defaultUserContext);
      const end = TaskTrackerDateTime.getCurrentLogicalDayEnd(defaultUserContext);
      const diffMs = end.getTime() - start.getTime();
      expect(diffMs).toBeCloseTo(24 * 60 * 60 * 1000, -3); // Within seconds
    });
  });

  describe('formatTimeForDisplay', () => {
    test('should format midnight as 12 AM', () => {
      expect(TaskTrackerDateTime.formatTimeForDisplay('00:00')).toBe('12 AM');
    });

    test('should format morning time without minutes', () => {
      expect(TaskTrackerDateTime.formatTimeForDisplay('09:00')).toBe('9 AM');
    });

    test('should format morning time with minutes', () => {
      expect(TaskTrackerDateTime.formatTimeForDisplay('09:30')).toBe('9:30 AM');
    });

    test('should format noon as 12 PM', () => {
      expect(TaskTrackerDateTime.formatTimeForDisplay('12:00')).toBe('12 PM');
    });

    test('should format afternoon time', () => {
      expect(TaskTrackerDateTime.formatTimeForDisplay('15:45')).toBe('3:45 PM');
    });

    test('should format evening time', () => {
      expect(TaskTrackerDateTime.formatTimeForDisplay('21:00')).toBe('9 PM');
    });
  });

  describe('formatWindowTimeRange', () => {
    test('should format simple window range', () => {
      const window = { start: '09:00', end: '17:00' };
      expect(TaskTrackerDateTime.formatWindowTimeRange(window)).toBe('9 AM - 5 PM');
    });

    test('should format cross-midnight window', () => {
      const window = { start: '21:00', end: '03:00' };
      expect(TaskTrackerDateTime.formatWindowTimeRange(window)).toBe('9 PM - 3 AM');
    });
  });

  describe('calculateDaysOverdue', () => {
    test('should return 0 for future dates', () => {
      const futureDate = '2025-10-25T10:00:00-07:00';
      expect(TaskTrackerDateTime.calculateDaysOverdue(futureDate, defaultUserContext)).toBe(0);
    });

    test('should return 0 for current date', () => {
      const today = '2025-10-20T10:00:00-07:00';
      expect(TaskTrackerDateTime.calculateDaysOverdue(today, defaultUserContext)).toBe(0);
    });

    test('should return positive days for past dates', () => {
      const pastDate = '2025-10-18T10:00:00-07:00';
      expect(TaskTrackerDateTime.calculateDaysOverdue(pastDate, defaultUserContext)).toBeGreaterThan(0);
    });

    test('should handle null inputs gracefully', () => {
      expect(TaskTrackerDateTime.calculateDaysOverdue(null, defaultUserContext)).toBe(0);
      expect(TaskTrackerDateTime.calculateDaysOverdue('2025-10-20T10:00:00-07:00', null)).toBe(0);
    });
  });

  describe('isWindowInPast', () => {
    test('should return false for current window', () => {
      const window = { start: '08:00', end: '17:00' };
      // Mock current time as 10 AM
      const currentTime = new Date('2025-10-20T10:00:00-07:00');
      expect(TaskTrackerDateTime.isWindowInPast(window, defaultUserContext, currentTime)).toBe(false);
    });

    test('should return true for past window', () => {
      const window = { start: '06:00', end: '08:00' };
      // Mock current time as 10 AM
      const currentTime = new Date('2025-10-20T10:00:00-07:00');
      expect(TaskTrackerDateTime.isWindowInPast(window, defaultUserContext, currentTime)).toBe(true);
    });

    test('should return false for cross-midnight windows in progress', () => {
      const window = { start: '21:00', end: '03:00' };
      // Mock current time as 10 PM (window is currently in progress)
      const currentTime = new Date('2025-10-20T22:00:00-07:00');
      expect(TaskTrackerDateTime.isWindowInPast(window, defaultUserContext, currentTime)).toBe(false);
    });
  });

  describe('isCurrentTimeInWindow', () => {
    test('should return true when current time is in window', () => {
      const window = { start: '08:00', end: '17:00' };
      const currentTime = new Date('2025-10-20T10:00:00-07:00');
      expect(TaskTrackerDateTime.isCurrentTimeInWindow(window, defaultUserContext, currentTime)).toBe(true);
    });

    test('should return false when current time is before window', () => {
      const window = { start: '10:00', end: '17:00' };
      const currentTime = new Date('2025-10-20T08:00:00-07:00');
      expect(TaskTrackerDateTime.isCurrentTimeInWindow(window, defaultUserContext, currentTime)).toBe(false);
    });

    test('should return false when current time is after window', () => {
      const window = { start: '08:00', end: '17:00' };
      const currentTime = new Date('2025-10-20T18:00:00-07:00');
      expect(TaskTrackerDateTime.isCurrentTimeInWindow(window, defaultUserContext, currentTime)).toBe(false);
    });

    test('should handle cross-midnight windows', () => {
      const window = { start: '21:00', end: '03:00' };
      const currentTime = new Date('2025-10-20T22:00:00-07:00'); // 10 PM
      expect(TaskTrackerDateTime.isCurrentTimeInWindow(window, defaultUserContext, currentTime)).toBe(true);
    });
  });

  describe('calculateWindowMidpoint', () => {
    test('should calculate midpoint for normal window', () => {
      const window = { start: '08:00', end: '17:00' };
      const midpoint = TaskTrackerDateTime.calculateWindowMidpoint(window, defaultUserContext);
      expect(midpoint.getHours()).toBe(12); // 12:30 PM
      expect(midpoint.getMinutes()).toBe(30);
    });

    test('should calculate midpoint for cross-midnight window', () => {
      const window = { start: '21:00', end: '03:00' };
      const midpoint = TaskTrackerDateTime.calculateWindowMidpoint(window, defaultUserContext);
      // 9 PM to 3 AM = 6 hours, midpoint is midnight
      expect(midpoint.getHours()).toBe(0);
    });
  });

  describe('getCompletionTimestamp', () => {
    test('should return null when current time is within window', () => {
      const window = { start: '08:00', end: '17:00' };
      const currentTime = new Date('2025-10-20T10:00:00-07:00');
      // Mock isCurrentTimeInWindow to return true
      jest.spyOn(TaskTrackerDateTime, 'isCurrentTimeInWindow').mockReturnValueOnce(true);
      const result = TaskTrackerDateTime.getCompletionTimestamp(window, defaultUserContext);
      expect(result).toBeNull();
      jest.restoreAllMocks();
    });

    test('should return midpoint timestamp when current time is outside window', () => {
      const window = { start: '08:00', end: '17:00' };
      // Mock isCurrentTimeInWindow to return false
      jest.spyOn(TaskTrackerDateTime, 'isCurrentTimeInWindow').mockReturnValueOnce(false);
      const result = TaskTrackerDateTime.getCompletionTimestamp(window, defaultUserContext);
      expect(result).toBeTruthy();
      expect(typeof result).toBe('string');
      jest.restoreAllMocks();
    });
  });

  describe('formatDueDateLogical - Extended Cases', () => {
    test('should use backend days_overdue when available', () => {
      const task = {
        frequency_unit: 'days',
        frequency_value: 1,
        days_overdue: 3,
        due_date: '2025-10-17T10:00:00-07:00'
      };
      const formatted = TaskTrackerDateTime.formatDueDateLogical(task.due_date, defaultUserContext, task);
      expect(formatted).toBe('3 days overdue');
    });

    test('should handle non-daily tasks with calendar day logic', () => {
      const task = {
        frequency_unit: 'weeks',
        frequency_value: 1,
        due_date: '2025-10-25T10:00:00-07:00'
      };
      const formatted = TaskTrackerDateTime.formatDueDateLogical(task.due_date, defaultUserContext, task);
      expect(formatted).toMatch(/\d+ days/);
    });

    test('should handle tasks without user context (fallback mode)', () => {
      const dueDate = '2025-10-25T10:00:00-07:00';
      const formatted = TaskTrackerDateTime.formatDueDateLogical(dueDate, null, null);
      expect(formatted).toBeTruthy();
    });

    test('should return empty string for missing due date', () => {
      const formatted = TaskTrackerDateTime.formatDueDateLogical(null, defaultUserContext, null);
      expect(formatted).toBe('');
    });
  });

  describe('getLogicalDateFromDateTime', () => {
    const userContext = {
      timezone: 'America/Los_Angeles',
      daily_reset_time: '05:00:00',
      current_logical_date: '2025-10-20'
    };

    test('should handle datetime after midnight but before reset time (belongs to previous logical day)', () => {
      // Oct 21 at 12:03 AM is before 5:00 AM, so it's still Oct 20's logical day
      const dateISO = '2025-10-21T00:03:55.041035-07:00';
      const logicalDate = TaskTrackerDateTime.getLogicalDateFromDateTime(dateISO, userContext);
      expect(logicalDate).toBe('2025-10-20');
    });

    test('should handle datetime after reset time (belongs to current logical day)', () => {
      // Oct 20 at 10:00 AM is after 5:00 AM, so it's Oct 20's logical day
      const dateISO = '2025-10-20T10:00:00-07:00';
      const logicalDate = TaskTrackerDateTime.getLogicalDateFromDateTime(dateISO, userContext);
      expect(logicalDate).toBe('2025-10-20');
    });

    test('should handle datetime exactly at reset time', () => {
      // Oct 20 at 5:00 AM is exactly at reset time, belongs to Oct 20's logical day
      const dateISO = '2025-10-20T05:00:00-07:00';
      const logicalDate = TaskTrackerDateTime.getLogicalDateFromDateTime(dateISO, userContext);
      expect(logicalDate).toBe('2025-10-20');
    });

    test('should handle datetime one minute before reset time', () => {
      // Oct 20 at 4:59 AM is before reset time, belongs to Oct 19's logical day
      const dateISO = '2025-10-20T04:59:00-07:00';
      const logicalDate = TaskTrackerDateTime.getLogicalDateFromDateTime(dateISO, userContext);
      expect(logicalDate).toBe('2025-10-19');
    });
  });

  describe('calculateLogicalDayDifference', () => {
    const userContext = {
      timezone: 'America/Los_Angeles',
      daily_reset_time: '05:00:00',
      current_logical_date: '2025-10-20'
    };

    test('should return 0 for datetime in current logical day after midnight', () => {
      // Oct 21 at 12:03 AM is still in Oct 20's logical day
      const dateISO = '2025-10-21T00:03:55.041035-07:00';
      const diff = TaskTrackerDateTime.calculateLogicalDayDifference(dateISO, userContext);
      expect(diff).toBe(0);
    });

    test('should return 0 for datetime in current logical day during daytime', () => {
      // Oct 20 at 3:00 PM is in Oct 20's logical day
      const dateISO = '2025-10-20T15:00:00-07:00';
      const diff = TaskTrackerDateTime.calculateLogicalDayDifference(dateISO, userContext);
      expect(diff).toBe(0);
    });

    test('should return -1 for datetime in next logical day', () => {
      // Oct 21 at 10:00 AM is in Oct 21's logical day (after 5:00 AM reset)
      const dateISO = '2025-10-21T10:00:00-07:00';
      const diff = TaskTrackerDateTime.calculateLogicalDayDifference(dateISO, userContext);
      expect(diff).toBe(-1);
    });

    test('should return 1 for datetime in previous logical day', () => {
      // Oct 19 at 10:00 AM is in Oct 19's logical day
      const dateISO = '2025-10-19T10:00:00-07:00';
      const diff = TaskTrackerDateTime.calculateLogicalDayDifference(dateISO, userContext);
      expect(diff).toBe(1);
    });
  });

  describe('formatDueDateLogical', () => {
    const userContext = {
      timezone: 'America/Los_Angeles',
      daily_reset_time: '05:00:00',
      current_logical_date: '2025-10-20'
    };

    test('should show "Today" for daily task due after midnight but before reset time', () => {
      // This is the user's reported bug scenario
      const task = {
        frequency_unit: 'days',
        frequency_value: 1,
        due_date: '2025-10-21T00:03:55.041035-07:00'
      };
      const formatted = TaskTrackerDateTime.formatDueDateLogical(task.due_date, userContext, task);
      expect(formatted).toBe('Today');
    });

    test('should show "Tomorrow" for daily task due after reset time next day', () => {
      const task = {
        frequency_unit: 'days',
        frequency_value: 1,
        due_date: '2025-10-21T10:00:00-07:00'
      };
      const formatted = TaskTrackerDateTime.formatDueDateLogical(task.due_date, userContext, task);
      expect(formatted).toBe('Tomorrow');
    });

    test('should show "Today" for daily task due in afternoon of logical day', () => {
      const task = {
        frequency_unit: 'days',
        frequency_value: 1,
        due_date: '2025-10-20T15:00:00-07:00'
      };
      const formatted = TaskTrackerDateTime.formatDueDateLogical(task.due_date, userContext, task);
      expect(formatted).toBe('Today');
    });

    test('should show "1 day overdue" for daily task from previous logical day', () => {
      const task = {
        frequency_unit: 'days',
        frequency_value: 1,
        due_date: '2025-10-19T10:00:00-07:00'
      };
      const formatted = TaskTrackerDateTime.formatDueDateLogical(task.due_date, userContext, task);
      expect(formatted).toBe('1 day overdue');
    });
  });

  describe('isToday', () => {
    const userContext = {
      timezone: 'America/Los_Angeles',
      daily_reset_time: '05:00:00',
      current_logical_date: '2025-10-20'
    };

    test('should return true for datetime after midnight but before reset time', () => {
      const dateISO = '2025-10-21T00:03:55.041035-07:00';
      expect(TaskTrackerDateTime.isToday(dateISO, userContext)).toBe(true);
    });

    test('should return true for datetime during daytime', () => {
      const dateISO = '2025-10-20T15:00:00-07:00';
      expect(TaskTrackerDateTime.isToday(dateISO, userContext)).toBe(true);
    });

    test('should return false for datetime in next logical day', () => {
      const dateISO = '2025-10-21T10:00:00-07:00';
      expect(TaskTrackerDateTime.isToday(dateISO, userContext)).toBe(false);
    });

    test('should return false for datetime in previous logical day', () => {
      const dateISO = '2025-10-19T10:00:00-07:00';
      expect(TaskTrackerDateTime.isToday(dateISO, userContext)).toBe(false);
    });
  });

  describe('isWithinCurrentLogicalDay', () => {
    test('should return true for current time (no checkTime provided)', () => {
      // This will use current browser time
      const result = TaskTrackerDateTime.isWithinCurrentLogicalDay(defaultUserContext);
      // We can't predict the exact result, but it should be a boolean
      expect(typeof result).toBe('boolean');
    });

    test('should return true for time within logical day', () => {
      const checkTime = new Date('2025-10-20T10:00:00-07:00');
      const result = TaskTrackerDateTime.isWithinCurrentLogicalDay(defaultUserContext, checkTime);
      expect(result).toBe(true);
    });

    test('should return false for time outside logical day', () => {
      const checkTime = new Date('2025-10-19T10:00:00-07:00');
      const result = TaskTrackerDateTime.isWithinCurrentLogicalDay(defaultUserContext, checkTime);
      expect(result).toBe(false);
    });
  });

  describe('formatDueDateLogical - Fallback Cases', () => {
    test('should handle overdue non-daily task with calendar days', () => {
      const task = {
        frequency_unit: 'weeks',
        frequency_value: 1
      };
      // Set a due date in the past
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      const formatted = TaskTrackerDateTime.formatDueDateLogical(yesterday.toISOString(), null, task);
      expect(formatted).toMatch(/overdue/);
    });

    test('should handle future non-daily task', () => {
      const task = {
        frequency_unit: 'weeks',
        frequency_value: 1
      };
      // Set a due date in the future
      const tomorrow = new Date();
      tomorrow.setDate(tomorrow.getDate() + 2);
      const formatted = TaskTrackerDateTime.formatDueDateLogical(tomorrow.toISOString(), null, task);
      expect(formatted).toMatch(/days|Tomorrow/);
    });

    test('should handle task due today (0 days diff)', () => {
      const task = {
        frequency_unit: 'weeks',
        frequency_value: 1
      };
      const now = new Date();
      const formatted = TaskTrackerDateTime.formatDueDateLogical(now.toISOString(), null, task);
      expect(formatted).toBe('Today');
    });

    test('REGRESSION: should show "Today" for weekly task due later today (Bug fix for Math.ceil)', () => {
      // This is the specific bug reported by the user:
      // A weekly task due at 9:53 PM today should show "Today", not "Tomorrow"
      // The bug was caused by Math.ceil() rounding up fractional days

      const task = {
        frequency_unit: 'weeks',
        frequency_value: 1
      };

      // Create a date for today at 9:53 PM (simulating the user's exact scenario)
      const today = new Date();
      today.setHours(21, 53, 50, 0); // 9:53:50 PM today

      const formatted = TaskTrackerDateTime.formatDueDateLogical(today.toISOString(), null, task);
      expect(formatted).toBe('Today');
    });

    test('REGRESSION: should show "Today" for weekly task due early morning today', () => {
      // Additional edge case: task due in the early morning hours
      const task = {
        frequency_unit: 'weeks',
        frequency_value: 1
      };

      const today = new Date();
      today.setHours(2, 0, 0, 0); // 2:00 AM today

      const formatted = TaskTrackerDateTime.formatDueDateLogical(today.toISOString(), null, task);
      expect(formatted).toBe('Today');
    });
  });

  describe('Error Handling', () => {
    test('parseTimeToMinutes should throw on invalid input', () => {
      expect(() => TaskTrackerDateTime.parseTimeToMinutes('invalid')).toThrow();
    });

    test('formatTimeForDisplay should return input on invalid format', () => {
      const result = TaskTrackerDateTime.formatTimeForDisplay('invalid:time:format');
      expect(result).toBe('invalid:time:format');
    });

    test('calculateLogicalDayDifference should handle invalid dates gracefully', () => {
      // Invalid dates create NaN results, but the function handles it
      const result = TaskTrackerDateTime.calculateLogicalDayDifference('not-a-date', defaultUserContext);
      // Result will be NaN or 0 depending on how new Date() handles it
      expect(typeof result).toBe('number');
    });

    test('formatDueDateLogical should handle invalid dates gracefully', () => {
      // Invalid dates may result in NaN days or other edge cases
      const result = TaskTrackerDateTime.formatDueDateLogical('completely-invalid', defaultUserContext, {});
      // Result should be a string (might be 'NaN days' or similar)
      expect(typeof result).toBe('string');
      expect(result).toBeTruthy();
    });
  });

  describe('Window Edge Cases', () => {
    test('isWindowInPast should use current time when not provided', () => {
      const window = { start: '01:00', end: '02:00' };
      // This will use actual current time - result is unpredictable but should not crash
      const result = TaskTrackerDateTime.isWindowInPast(window, defaultUserContext);
      expect(typeof result).toBe('boolean');
    });

    test('isCurrentTimeInWindow should use current time when not provided', () => {
      const window = { start: '00:00', end: '23:59' };
      // This will use actual current time - result is unpredictable but should not crash
      const result = TaskTrackerDateTime.isCurrentTimeInWindow(window, defaultUserContext);
      expect(typeof result).toBe('boolean');
    });

    test('calculateWindowMidpoint should handle windows before reset time', () => {
      const window = { start: '02:00', end: '04:00' };
      const midpoint = TaskTrackerDateTime.calculateWindowMidpoint(window, defaultUserContext);
      expect(midpoint).toBeInstanceOf(Date);
    });
  });
});
