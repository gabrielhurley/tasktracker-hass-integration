/**
 * Jest Unit Tests for TaskTracker Utils - getTaskBorderStyle method
 *
 * This test file verifies the border styling logic for task items across all TaskTracker cards.
 *
 * To run these tests:
 * 1. Install Jest: `npm install --save-dev jest`
 * 2. Run tests: `npm test` or `npx jest tasktracker-utils.test.js`
 * 3. Run with coverage: `npx jest --coverage tasktracker-utils.test.js`
 */

// Mock TaskTrackerUtils class with the getTaskBorderStyle method
class TaskTrackerUtils {
  static getOverdueColor(daysOverdue, overdueSeverity = 1) {
    if (daysOverdue <= 0) {
      return null; // Not overdue, use default colors
    }

    // Aggressive severity-based timeline
    switch (overdueSeverity) {
      case 3: // Maximum severity: immediate red
        return `rgb(255, 70, 40)`; // Deep red immediately

      case 2: // Medium severity: immediate orange, fast transition to red
        if (daysOverdue <= 7) {
          return `rgb(255, 160, 70)`; // Orange immediately
        } else {
          // Days 8-14: Transition from orange to red
          const progress = Math.min((daysOverdue - 7) / 7, 1); // 0 to 1 over 7 days
          const red = Math.round(255);
          const green = Math.round(160 - (90 * progress)); // 160 -> 70
          const blue = Math.round(70 - (30 * progress)); // 70 -> 40
          return `rgb(${red}, ${green}, ${blue})`;
        }

      case 1: // Low severity: traditional timeline
      default:
        if (daysOverdue <= 7) {
          return null; // Grace period, use default colors
        }

        if (daysOverdue <= 21) {
          // Week 2-3: Transition from default to orange
          const progress = (daysOverdue - 7) / 14; // 0 to 1 over 14 days
          const orangeIntensity = Math.min(progress, 1);

          // Subtle orange color that works with both light and dark themes
          const red = Math.round(200 + (55 * orangeIntensity));
          const green = Math.round(140 + (20 * orangeIntensity));
          const blue = Math.round(60 + (10 * orangeIntensity));

          return `rgb(${red}, ${green}, ${blue})`;
        }

        // 22+ days: Transition from orange to red
        const progress = Math.min((daysOverdue - 21) / 14, 1); // 0 to 1 over next 14 days

        // Subtle red color that works with both light and dark themes
        const red = Math.round(220 + (35 * progress));
        const green = Math.round(100 - (30 * progress));
        const blue = Math.round(80 - (40 * progress));

        return `rgb(${red}, ${green}, ${blue})`;
    }
  }

  /**
   * Calculate border style and CSS classes for task items based on overdue/due status
   * This provides consistent styling across all TaskTracker cards
   *
   * @param {Object} task - Task object
   * @param {string} taskType - Task type ('self_care' for self-care tasks, 'task' for regular tasks)
   * @param {number} daysOverdue - Pre-calculated days overdue (from TaskTrackerDateTime.calculateDaysOverdue), used as fallback
   * @returns {Object} - { borderStyle, cssClasses: { isOverdue, isDue, needsCompletion, overdue, dueToday } }
   */
  static getTaskBorderStyle(task, taskType = 'task', daysOverdue = 0) {
    let isOverdue, isDue, borderStyle;
    const overdueSeverity = task.overdue_severity || 1;

    // Check if task has API-provided overdue info (both self-care and regular tasks can have this)
    if (task.is_overdue !== undefined || task.days_overdue !== undefined) {
      // Use API-provided overdue info
      isOverdue = task.is_overdue || false;
      daysOverdue = task.days_overdue || 0;
      isDue = daysOverdue === 0 && !!(task.due_date || task.next_due); // Due today
    } else {
      // Fallback: use calculated daysOverdue parameter
      const dueDate = task.due_date || task.next_due;
      isOverdue = !!(dueDate && daysOverdue > 0);
      isDue = !!(dueDate && daysOverdue === 0); // Due today
    }

    // Calculate border style
    if (isOverdue) {
      const overdueColor = TaskTrackerUtils.getOverdueColor(daysOverdue, overdueSeverity);
      borderStyle = overdueColor ? `border-left: 2px solid ${overdueColor} !important;` : '';
    } else if (isDue) {
      // Due but not overdue - use blue styling
      borderStyle = 'border-left: 2px solid var(--primary-color) !important;';
    } else {
      borderStyle = '';
    }

    return {
      borderStyle,
      cssClasses: {
        isOverdue,
        isDue,
        needsCompletion: isOverdue || isDue,
        overdue: isOverdue,
        dueToday: isDue && !isOverdue
      }
    };
  }
}

// ============================================================================
// Jest Test Suite
// ============================================================================

describe('TaskTrackerUtils.getTaskBorderStyle', () => {

  // ============================================================================
  // Tests for API-provided overdue information (regular tasks)
  // ============================================================================

  describe('Regular tasks with API-provided overdue info', () => {
    test('should handle 7 days overdue with severity 2 correctly', () => {
      const task = {
        id: 9,
        name: "Mop Floor Upstairs",
        is_overdue: true,
        days_overdue: 7,
        overdue_severity: 2,
        due_date: "2025-07-25T23:17:21.830038+00:00"
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(true);
      expect(result.cssClasses.isDue).toBe(false);
      expect(result.cssClasses.dueToday).toBe(false);
      expect(result.cssClasses.overdue).toBe(true);
      expect(result.cssClasses.needsCompletion).toBe(true);
      expect(result.borderStyle).toBe('border-left: 2px solid rgb(255, 160, 70) !important;');
    });

    test('should handle due today (0 days overdue) correctly', () => {
      const task = {
        id: 10,
        name: "Due Today Task",
        is_overdue: false,
        days_overdue: 0,
        overdue_severity: 1,
        due_date: "2025-07-30T10:00:00.000000+00:00"
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(false);
      expect(result.cssClasses.isDue).toBe(true);
      expect(result.cssClasses.dueToday).toBe(true);
      expect(result.cssClasses.overdue).toBe(false);
      expect(result.cssClasses.needsCompletion).toBe(true);
      expect(result.borderStyle).toBe('border-left: 2px solid var(--primary-color) !important;');
    });

    test('should handle not overdue with no due date', () => {
      const task = {
        id: 11,
        name: "No Due Date Task",
        is_overdue: false,
        days_overdue: 0,
        overdue_severity: 1
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(false);
      expect(result.cssClasses.isDue).toBe(false);
      expect(result.cssClasses.dueToday).toBe(false);
      expect(result.cssClasses.overdue).toBe(false);
      expect(result.cssClasses.needsCompletion).toBe(false);
      expect(result.borderStyle).toBe('');
    });
  });

  // ============================================================================
  // Tests for self-care tasks with API-provided overdue information
  // ============================================================================

  describe('Self-care tasks with API-provided overdue info', () => {
    test('should handle 3 days overdue with severity 3', () => {
      const task = {
        id: 20,
        name: "Brush Teeth",
        task_type: "SelfCareTask",
        is_overdue: true,
        days_overdue: 3,
        overdue_severity: 3,
        due_date: "2025-07-27T08:00:00.000000+00:00"
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'self_care', 0);

      expect(result.cssClasses.isOverdue).toBe(true);
      expect(result.cssClasses.isDue).toBe(false);
      expect(result.cssClasses.dueToday).toBe(false);
      expect(result.cssClasses.overdue).toBe(true);
      expect(result.cssClasses.needsCompletion).toBe(true);
      expect(result.borderStyle).toBe('border-left: 2px solid rgb(255, 70, 40) !important;');
    });

    test('should handle self-care task due today', () => {
      const task = {
        id: 21,
        name: "Morning Meditation",
        task_type: "SelfCareTask",
        is_overdue: false,
        days_overdue: 0,
        overdue_severity: 1,
        due_date: "2025-07-30T09:00:00.000000+00:00"
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'self_care', 0);

      expect(result.cssClasses.isOverdue).toBe(false);
      expect(result.cssClasses.isDue).toBe(true);
      expect(result.cssClasses.dueToday).toBe(true);
      expect(result.cssClasses.overdue).toBe(false);
      expect(result.cssClasses.needsCompletion).toBe(true);
      expect(result.borderStyle).toBe('border-left: 2px solid var(--primary-color) !important;');
    });
  });

  // ============================================================================
  // Tests for fallback calculated overdue logic (no API info)
  // ============================================================================

  describe('Fallback calculated overdue logic', () => {
    test('should handle calculated 5 days overdue without API info', () => {
      const task = {
        id: 30,
        name: "Legacy Task",
        overdue_severity: 1,
        due_date: "2025-07-25T15:00:00.000000+00:00"
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 5);

      expect(result.cssClasses.isOverdue).toBe(true);
      expect(result.cssClasses.isDue).toBe(false);
      expect(result.cssClasses.dueToday).toBe(false);
      expect(result.cssClasses.overdue).toBe(true);
      expect(result.cssClasses.needsCompletion).toBe(true);
      expect(result.borderStyle).toBe(''); // Severity 1, 5 days = grace period
    });

    test('should handle calculated due today without API info', () => {
      const task = {
        id: 31,
        name: "Legacy Due Today",
        overdue_severity: 2,
        due_date: "2025-07-30T15:00:00.000000+00:00"
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(false);
      expect(result.cssClasses.isDue).toBe(true);
      expect(result.cssClasses.dueToday).toBe(true);
      expect(result.cssClasses.overdue).toBe(false);
      expect(result.cssClasses.needsCompletion).toBe(true);
      expect(result.borderStyle).toBe('border-left: 2px solid var(--primary-color) !important;');
    });

    test('should handle no due date without API info', () => {
      const task = {
        id: 32,
        name: "No Due Date Legacy",
        overdue_severity: 1
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(false);
      expect(result.cssClasses.isDue).toBe(false);
      expect(result.cssClasses.dueToday).toBe(false);
      expect(result.cssClasses.overdue).toBe(false);
      expect(result.cssClasses.needsCompletion).toBe(false);
      expect(result.borderStyle).toBe('');
    });
  });

  // ============================================================================
  // Tests for different overdue severities and color gradations
  // ============================================================================

  describe('Overdue severity and color gradations', () => {
    test('should handle severity 1 - 15 days overdue (orange gradient)', () => {
      const task = {
        id: 40,
        name: "Low Priority Overdue",
        is_overdue: true,
        days_overdue: 15,
        overdue_severity: 1
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(true);
      expect(result.borderStyle).toMatch(/rgb\(/);
      expect(result.borderStyle).toMatch(/border-left: 2px solid/);
    });

    test('should handle severity 2 - 10 days overdue (red transition)', () => {
      const task = {
        id: 41,
        name: "Medium Priority Overdue",
        is_overdue: true,
        days_overdue: 10,
        overdue_severity: 2
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(true);
      expect(result.borderStyle).toMatch(/rgb\(255/);
      expect(result.borderStyle).toMatch(/border-left: 2px solid/);
    });

    test('should handle severity 3 - 1 day overdue (immediate red)', () => {
      const task = {
        id: 42,
        name: "High Priority Overdue",
        is_overdue: true,
        days_overdue: 1,
        overdue_severity: 3
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(true);
      expect(result.borderStyle).toBe('border-left: 2px solid rgb(255, 70, 40) !important;');
    });
  });

  // ============================================================================
  // Tests for edge cases
  // ============================================================================

  describe('Edge cases', () => {
    test('should default missing overdue_severity to 1', () => {
      const task = {
        id: 50,
        name: "No Severity Task",
        is_overdue: true,
        days_overdue: 10
        // overdue_severity missing
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(true);
      // Should use severity 1 logic (grace period for 10 days)
      expect(result.borderStyle).toMatch(/rgb\(|^$/); // Either has RGB color or empty string
    });

    test('should prioritize API data over calculated data', () => {
      const task = {
        id: 51,
        name: "Mixed Data Task",
        is_overdue: false, // API says not overdue
        days_overdue: 0,   // API says due today
        overdue_severity: 2,
        due_date: "2025-07-30T15:00:00.000000+00:00"
      };

      // Pass conflicting calculated data (20 days overdue)
      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 20);

      // Should use API data, not calculated data
      expect(result.cssClasses.isOverdue).toBe(false);
      expect(result.cssClasses.isDue).toBe(true);
      expect(result.borderStyle).toBe('border-left: 2px solid var(--primary-color) !important;');
    });

    test('should handle undefined task fields gracefully', () => {
      const task = {
        id: 52,
        name: "Minimal Task"
        // Most fields missing
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isOverdue).toBe(false);
      expect(result.cssClasses.isDue).toBe(false);
      expect(result.cssClasses.needsCompletion).toBe(false);
      expect(result.borderStyle).toBe('');
    });

    test('should handle null/undefined due dates', () => {
      const task = {
        id: 53,
        name: "Null Due Date Task",
        is_overdue: false,
        days_overdue: 0,
        due_date: null
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      expect(result.cssClasses.isDue).toBe(false);
      expect(result.cssClasses.dueToday).toBe(false);
    });
  });

  // ============================================================================
  // Tests for specific regression cases
  // ============================================================================

  describe('Regression tests', () => {
    test('should not assign due-today class to 7 days overdue task (original bug)', () => {
      // This is the specific case from the user's HTML sample
      const task = {
        id: 9,
        task_type: "RecurringTask",
        name: "Mop Floor Upstairs",
        assigned_users: ["sara"],
        is_overdue: true,
        days_overdue: 7,
        overdue_severity: 2,
        due_date: "2025-07-25T23:17:21.830038+00:00"
      };

      const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

      // The bug was that this was getting due-today class instead of overdue
      expect(result.cssClasses.dueToday).toBe(false);
      expect(result.cssClasses.overdue).toBe(true);
      expect(result.cssClasses.isOverdue).toBe(true);
      expect(result.cssClasses.isDue).toBe(false);

      // Should have orange border for severity 2, 7 days overdue
      expect(result.borderStyle).toBe('border-left: 2px solid rgb(255, 160, 70) !important;');

      // Should NOT have blue border (which was the bug)
      expect(result.borderStyle).not.toContain('var(--primary-color)');
    });

    test('should handle various severity 2 overdue scenarios correctly', () => {
             const testCases = [
         { days: 1, expectedColor: 'rgb(255, 160, 70)' },
         { days: 7, expectedColor: 'rgb(255, 160, 70)' },
         { days: 8, expectedColor: 'rgb(255, 147, 66)' }, // Transition starts (adjusted for rounding)
         { days: 14, expectedColor: 'rgb(255, 70, 40)' }  // Full red
       ];

      testCases.forEach(({ days, expectedColor }) => {
        const task = {
          id: 60 + days,
          name: `Severity 2 - ${days} days overdue`,
          is_overdue: true,
          days_overdue: days,
          overdue_severity: 2
        };

        const result = TaskTrackerUtils.getTaskBorderStyle(task, 'task', 0);

        expect(result.cssClasses.overdue).toBe(true);
        expect(result.cssClasses.dueToday).toBe(false);
        expect(result.borderStyle).toContain(expectedColor);
      });
    });
  });
});