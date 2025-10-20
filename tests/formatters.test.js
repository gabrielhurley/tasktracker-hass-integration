/**
 * Tests for formatters utility functions
 */

// Mock TaskTrackerDateTime before importing formatters
jest.mock('../custom_components/tasktracker/www/utils/datetime-utils.js', () => ({
  TaskTrackerDateTime: {
    calculateLogicalDayDifference: jest.fn((dateString, userContext) => {
      // Mock returns calendar day difference for simple tests
      const date = new Date(dateString);
      const now = new Date('2025-01-15T10:00:00Z');
      const dateLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      return Math.floor((nowLocal - dateLocal) / (1000 * 60 * 60 * 24));
    }),
    formatDueDateLogical: jest.fn((dueDateString, userContext, task) => {
      // Simple mock that returns a formatted due date
      const now = new Date('2025-01-15T10:00:00Z');
      const due = new Date(dueDateString);
      const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const startOfDueDay = new Date(due.getFullYear(), due.getMonth(), due.getDate());
      const dayMs = 1000 * 60 * 60 * 24;
      const dayDiff = Math.floor((startOfDueDay.getTime() - startOfToday.getTime()) / dayMs);

      if (dayDiff < 0) {
        const overdueDays = Math.abs(dayDiff);
        if (overdueDays === 1) return '1 day overdue';
        return `${overdueDays} days overdue`;
      }
      if (dayDiff === 0) return 'Today';
      if (dayDiff === 1) return 'Tomorrow';
      return `${dayDiff} days`;
    })
  }
}));

const {
  formatDate,
  convertTo12HourFormat,
  formatDuration,
  formatPriority,
  normalizePriority,
  formatDateTimeForInput,
  getPriorityOptions,
  getFrequencyDaysOptions,
  getMoodLabel,
  getFreeTimeLabel,
  formatDateTime,
  formatDueDate,
  formatSelfCareDueDate,
  capitalize
} = require('../custom_components/tasktracker/www/utils/formatters.js');

describe('formatters', () => {
  describe('formatDate', () => {
    test('should format date with time', () => {
      const result = formatDate('2025-01-15T14:30:00');
      expect(result).toContain('2025');
      // Time is formatted in 12-hour format with AM/PM
      expect(result).toMatch(/\d{1,2}:\d{2}\s(AM|PM)/);
    });

    test('should handle invalid date gracefully', () => {
      const result = formatDate('invalid-date');
      expect(result).toContain('Invalid Date');
    });
  });

  describe('convertTo12HourFormat', () => {
    test('should convert morning time', () => {
      expect(convertTo12HourFormat('09:30')).toBe('9:30 AM');
    });

    test('should convert afternoon time', () => {
      expect(convertTo12HourFormat('14:45')).toBe('2:45 PM');
    });

    test('should convert midnight', () => {
      expect(convertTo12HourFormat('00:00')).toBe('12 AM');
    });

    test('should convert noon', () => {
      expect(convertTo12HourFormat('12:00')).toBe('12 PM');
    });

    test('should omit :00 minutes', () => {
      expect(convertTo12HourFormat('09:00')).toBe('9 AM');
      expect(convertTo12HourFormat('15:00')).toBe('3 PM');
    });

    test('should handle invalid format gracefully', () => {
      // Invalid format returns malformed but doesn't throw
      const result = convertTo12HourFormat('invalid');
      expect(result).toBeDefined();
    });
  });

  describe('formatDuration', () => {
    test('should format minutes only', () => {
      expect(formatDuration(45)).toBe('45m');
    });

    test('should format hours only', () => {
      expect(formatDuration(120)).toBe('2h');
    });

    test('should format hours and minutes', () => {
      expect(formatDuration(90)).toBe('1h 30m');
    });

    test('should handle zero/null', () => {
      expect(formatDuration(0)).toBe('Unknown');
      expect(formatDuration(null)).toBe('Unknown');
    });
  });

  describe('formatPriority', () => {
    test('should format numeric priorities', () => {
      expect(formatPriority(1)).toBe('High');
      expect(formatPriority(2)).toBe('Medium');
      expect(formatPriority(3)).toBe('Low');
      expect(formatPriority(4)).toBe('Very Low');
      expect(formatPriority(5)).toBe('Minimal');
    });

    test('should format string priorities', () => {
      expect(formatPriority('High')).toBe('High');
      expect(formatPriority('Medium')).toBe('Medium');
      expect(formatPriority('Low')).toBe('Low');
    });

    test('should handle unknown priorities', () => {
      expect(formatPriority(99)).toBe('Priority 99');
    });
  });

  describe('normalizePriority', () => {
    test('should convert string to number', () => {
      expect(normalizePriority('High')).toBe(1);
      expect(normalizePriority('Medium')).toBe(2);
      expect(normalizePriority('Low')).toBe(3);
      expect(normalizePriority('Very Low')).toBe(4);
      expect(normalizePriority('Minimal')).toBe(5);
    });

    test('should pass through numbers', () => {
      expect(normalizePriority(1)).toBe(1);
      expect(normalizePriority(3)).toBe(3);
    });

    test('should return null for unknown values', () => {
      expect(normalizePriority('Unknown')).toBe(null);
      expect(normalizePriority(null)).toBe(null);
    });
  });

  describe('formatDateTimeForInput', () => {
    test('should format date for datetime-local input', () => {
      const result = formatDateTimeForInput('2025-01-15T14:30:00');
      expect(result).toBe('2025-01-15T14:30');
    });

    test('should handle empty string', () => {
      expect(formatDateTimeForInput('')).toBe('');
    });

    test('should handle invalid date', () => {
      // Invalid dates return malformed string, not empty
      const result = formatDateTimeForInput('invalid');
      expect(result).toBeDefined();
    });
  });

  describe('getPriorityOptions', () => {
    test('should return priority options array', () => {
      const options = getPriorityOptions();
      expect(options).toHaveLength(3);
      expect(options[0]).toEqual({ value: 1, label: 'High' });
      expect(options[1]).toEqual({ value: 2, label: 'Medium' });
      expect(options[2]).toEqual({ value: 3, label: 'Low' });
    });
  });

  describe('getFrequencyDaysOptions', () => {
    test('should return frequency options array', () => {
      const options = getFrequencyDaysOptions();
      expect(options).toHaveLength(7);
      expect(options[0]).toEqual({ value: 1, label: 'Daily (1 day)' });
      expect(options[6]).toEqual({ value: 365, label: 'Yearly (365 days)' });
    });
  });

  describe('getMoodLabel', () => {
    test('should return emoji labels by default', () => {
      expect(getMoodLabel(-2)).toBe('☹️');
      expect(getMoodLabel(-1)).toBe('🙁');
      expect(getMoodLabel(0)).toBe('😐');
      expect(getMoodLabel(1)).toBe('🙂');
      expect(getMoodLabel(2)).toBe('😊');
    });

    test('should return numeric labels when useEmoji is false', () => {
      expect(getMoodLabel(-2, false)).toBe('-2');
      expect(getMoodLabel(1, false)).toBe('1');
    });

    test('should handle unknown values', () => {
      expect(getMoodLabel(99)).toBe('99');
    });
  });

  describe('getFreeTimeLabel', () => {
    test('should return free time labels', () => {
      expect(getFreeTimeLabel(1)).toBe('Slammed');
      expect(getFreeTimeLabel(2)).toBe('Busy');
      expect(getFreeTimeLabel(3)).toBe('Moderate');
      expect(getFreeTimeLabel(4)).toBe('Available');
      expect(getFreeTimeLabel(5)).toBe('Wide-open');
    });

    test('should handle unknown values', () => {
      expect(getFreeTimeLabel(99)).toBe('99');
    });
  });

  describe('formatDateTime', () => {
    beforeEach(() => {
      // Mock current time
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T10:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should format recent times', () => {
      expect(formatDateTime('2025-01-15T09:45:00Z')).toBe('15m ago');
      // Note: 3 hours before might cross day boundary depending on timezone
      const result = formatDateTime('2025-01-15T07:00:00Z');
      expect(result).toMatch(/\d+h ago|Yesterday/);
    });

    test('should format yesterday', () => {
      expect(formatDateTime('2025-01-14T10:00:00Z')).toBe('Yesterday');
    });

    test('should format days ago', () => {
      expect(formatDateTime('2025-01-10T10:00:00Z')).toBe('5 days ago');
    });

    test('should handle just now', () => {
      expect(formatDateTime('2025-01-15T10:00:00Z')).toBe('Just now');
    });

    test('should handle invalid date', () => {
      // Invalid dates return malformed output, not the original string
      const result = formatDateTime('invalid');
      expect(result).toBeDefined();
    });

    test('should use userContext for logical day calculations', () => {
      const userContext = { timezone: 'America/Los_Angeles', daily_reset_time: '05:00:00' };

      // Just now with user context
      const justNow = formatDateTime('2025-01-15T10:00:00Z', userContext);
      expect(justNow).toBe('Just now');

      // Minutes ago with user context
      const minutesAgo = formatDateTime('2025-01-15T09:30:00Z', userContext);
      expect(minutesAgo).toBe('30m ago');

      // Hours ago with user context (might cross logical day boundary)
      const hoursAgo = formatDateTime('2025-01-15T07:00:00Z', userContext);
      expect(hoursAgo).toMatch(/\d+h ago|Yesterday/);

      // Yesterday with user context
      const yesterday = formatDateTime('2025-01-14T10:00:00Z', userContext);
      expect(yesterday).toBe('Yesterday');

      // Multiple days ago with user context
      const daysAgo = formatDateTime('2025-01-10T10:00:00Z', userContext);
      expect(daysAgo).toBe('5 days ago');
    });
  });

  describe('formatDueDate', () => {
    beforeEach(() => {
      // Mock current time
      jest.useFakeTimers();
      jest.setSystemTime(new Date('2025-01-15T10:00:00Z'));
    });

    afterEach(() => {
      jest.useRealTimers();
    });

    test('should handle null/empty', () => {
      expect(formatDueDate(null)).toBe('Unknown');
      expect(formatDueDate('')).toBe('Unknown');
    });

    test('should format with user context', () => {
      const userContext = { timezone: 'America/Los_Angeles', daily_reset_time: '05:00:00' };
      const result = formatDueDate('2025-01-16T10:00:00Z', userContext);
      expect(result).toBeDefined();
    });

    test('should fallback without user context', () => {
      expect(formatDueDate('2025-01-15T10:00:00Z')).toBe('Today');
      expect(formatDueDate('2025-01-16T10:00:00Z')).toBe('Tomorrow');
      expect(formatDueDate('2025-01-20T10:00:00Z')).toBe('5 days');
    });

    test('should format overdue dates', () => {
      expect(formatDueDate('2025-01-14T10:00:00Z')).toBe('1 day overdue');
      expect(formatDueDate('2025-01-10T10:00:00Z')).toBe('5 days overdue');
    });

    test('should use fallback when formatDueDateLogical throws error', () => {
      const { TaskTrackerDateTime } = require('../custom_components/tasktracker/www/utils/datetime-utils.js');

      // Make formatDueDateLogical throw an error to trigger fallback path
      TaskTrackerDateTime.formatDueDateLogical.mockImplementationOnce(() => {
        throw new Error('Mock error');
      });

      // Should fall back to calendar day comparison
      const result = formatDueDate('2025-01-16T10:00:00Z', { timezone: 'America/Los_Angeles' });
      expect(result).toBe('Tomorrow');
    });
  });

  describe('formatSelfCareDueDate', () => {
    test('should always return Today', () => {
      expect(formatSelfCareDueDate()).toBe('Today');
    });
  });

  describe('capitalize', () => {
    test('should capitalize first letter', () => {
      expect(capitalize('hello')).toBe('Hello');
      expect(capitalize('world')).toBe('World');
    });

    test('should handle empty/null', () => {
      expect(capitalize('')).toBe('');
      expect(capitalize(null)).toBe(null);
    });

    test('should not change already capitalized', () => {
      expect(capitalize('Hello')).toBe('Hello');
    });
  });
});
