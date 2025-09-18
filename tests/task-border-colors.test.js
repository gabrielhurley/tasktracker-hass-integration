/**
 * Unit tests for task border color logic
 * Tests the getOverdueColor and getTaskBorderStyle functions from visuals.js
 */

import { getOverdueColor, getTaskBorderStyle } from '../custom_components/tasktracker/www/utils/visuals.js';

describe('Task Border Color Logic', () => {
  describe('getOverdueColor', () => {
    describe('Severity 3 (Immediate Red)', () => {
      test('should return immediate red for any overdue days', () => {
        expect(getOverdueColor(1, 3)).toBe('rgb(255, 70, 40)');
        expect(getOverdueColor(5, 3)).toBe('rgb(255, 70, 40)');
        expect(getOverdueColor(30, 3)).toBe('rgb(255, 70, 40)');
      });

      test('should return null for non-overdue days', () => {
        expect(getOverdueColor(0, 3)).toBeNull();
        expect(getOverdueColor(-1, 3)).toBeNull();
      });
    });

    describe('Severity 2 (Orange to Red Transition)', () => {
      test('should return orange for days 1-7', () => {
        expect(getOverdueColor(1, 2)).toBe('rgb(255, 160, 70)');
        expect(getOverdueColor(5, 2)).toBe('rgb(255, 160, 70)');
        expect(getOverdueColor(7, 2)).toBe('rgb(255, 160, 70)');
      });

      test('should transition from orange to red over days 8-14', () => {
        // Day 8 should be orange-ish
        const day8Color = getOverdueColor(8, 2);
        expect(day8Color).toMatch(/rgb\(255, \d+, \d+\)/);

        // Day 14 should be reddish (close to final red)
        const day14Color = getOverdueColor(14, 2);
        expect(day14Color).toMatch(/rgb\(255, \d+, \d+\)/);

        // Extract green component - should decrease from day 8 to 14
        const day8Green = parseInt(day8Color.match(/rgb\(255, (\d+), \d+\)/)[1]);
        const day14Green = parseInt(day14Color.match(/rgb\(255, (\d+), \d+\)/)[1]);
        expect(day14Green).toBeLessThan(day8Green);
      });

      test('should return final red for days beyond 14', () => {
        const day15Color = getOverdueColor(15, 2);
        const day30Color = getOverdueColor(30, 2);
        expect(day15Color).toBe(day30Color); // Should be the same final red
        expect(day15Color).toMatch(/rgb\(255, 70, 40\)/);
      });

      test('should return null for non-overdue days', () => {
        expect(getOverdueColor(0, 2)).toBeNull();
        expect(getOverdueColor(-1, 2)).toBeNull();
      });
    });

    describe('Severity 1 (Traditional Timeline)', () => {
      test('should return null for grace period (days 1-7)', () => {
        expect(getOverdueColor(1, 1)).toBeNull();
        expect(getOverdueColor(5, 1)).toBeNull();
        expect(getOverdueColor(7, 1)).toBeNull();
      });

      test('should return orange gradient for days 8-21', () => {
        const day8Color = getOverdueColor(8, 1);
        const day21Color = getOverdueColor(21, 1);

        expect(day8Color).toMatch(/rgb\(\d+, \d+, \d+\)/);
        expect(day21Color).toMatch(/rgb\(\d+, \d+, \d+\)/);

        // Should be different colors (gradient)
        expect(day8Color).not.toBe(day21Color);
      });

      test('should return red gradient for days 22+', () => {
        const day22Color = getOverdueColor(22, 1);
        const day30Color = getOverdueColor(30, 1);

        expect(day22Color).toMatch(/rgb\(\d+, \d+, \d+\)/);
        expect(day30Color).toMatch(/rgb\(\d+, \d+, \d+\)/);

        // Day 30 should be redder than day 22
        const day22Red = parseInt(day22Color.match(/rgb\((\d+), \d+, \d+\)/)[1]);
        const day30Red = parseInt(day30Color.match(/rgb\((\d+), \d+, \d+\)/)[1]);
        expect(day30Red).toBeGreaterThanOrEqual(day22Red);
      });

      test('should return null for non-overdue days', () => {
        expect(getOverdueColor(0, 1)).toBeNull();
        expect(getOverdueColor(-1, 1)).toBeNull();
      });
    });

    describe('Default/Invalid Severity', () => {
      test('should default to severity 1 behavior for undefined severity', () => {
        expect(getOverdueColor(1)).toBeNull(); // Grace period
        expect(getOverdueColor(8)).toMatch(/rgb\(\d+, \d+, \d+\)/); // Orange gradient
      });

      test('should default to severity 1 behavior for invalid severity values', () => {
        expect(getOverdueColor(1, 0)).toBeNull(); // Grace period
        expect(getOverdueColor(1, 4)).toBeNull(); // Grace period
        expect(getOverdueColor(1, null)).toBeNull(); // Grace period
      });
    });
  });

  describe('getTaskBorderStyle', () => {
    describe('Not Due/Not Overdue Tasks', () => {
      test('should return no special styling for tasks without due dates', () => {
        const task = { name: 'Task without due date' };
        const result = getTaskBorderStyle(task, 'task', 0);

        expect(result.borderStyle).toBeUndefined();
        expect(result.borderClass).toBe('');
        expect(result.cssClasses.isOverdue).toBe(false);
        expect(result.cssClasses.isDue).toBe(false);
        expect(result.cssClasses.needsCompletion).toBe(false);
      });

      test('should return no styling for future due dates', () => {
        const task = {
          name: 'Future task',
          due_date: '2025-12-25'
        };
        const result = getTaskBorderStyle(task, 'task', -5); // 5 days in future

        expect(result.borderStyle).toBeUndefined();
        expect(result.borderClass).toBe('');
        expect(result.cssClasses.isOverdue).toBe(false);
        expect(result.cssClasses.isDue).toBe(false);
      });
    });

    describe('Due Today Tasks', () => {
      test('should apply due styling for tasks due today (API data)', () => {
        const task = {
          name: 'Due today',
          due_date: '2025-01-15',
          is_overdue: false,
          days_overdue: 0
        };
        const result = getTaskBorderStyle(task, 'task', 0);

        expect(result.borderStyle).toBeUndefined();
        expect(result.borderClass).toBe('tt-task-border--due');
        expect(result.cssClasses.isOverdue).toBe(false);
        expect(result.cssClasses.isDue).toBe(true);
        expect(result.cssClasses.needsCompletion).toBe(true);
        expect(result.cssClasses.dueToday).toBe(true);
      });

      test('should apply due styling for tasks due today (calculated)', () => {
        const task = {
          name: 'Due today',
          due_date: '2025-01-15'
        };
        const result = getTaskBorderStyle(task, 'task', 0);

        expect(result.borderStyle).toBeUndefined();
        expect(result.borderClass).toBe('tt-task-border--due');
        expect(result.cssClasses.isDue).toBe(true);
      });
    });

    describe('Overdue Tasks with Severity 1 (Traditional)', () => {
      test('should return generic overdue class for grace period (1-7 days)', () => {
        const task = {
          name: 'Overdue task',
          due_date: '2025-01-10',
          is_overdue: true,
          days_overdue: 5,
          overdue_severity: 1
        };
        const result = getTaskBorderStyle(task, 'task', 5);

        expect(result.borderStyle).toBeUndefined();
        expect(result.borderClass).toBe('tt-task-border--overdue');
        expect(result.cssClasses.isOverdue).toBe(true);
        expect(result.cssClasses.isDue).toBe(false);
        expect(result.cssClasses.needsCompletion).toBe(true);
      });

      test('should apply custom color for orange gradient period (8-21 days)', () => {
        const task = {
          name: 'Overdue task',
          due_date: '2025-01-01',
          is_overdue: true,
          days_overdue: 14,
          overdue_severity: 1
        };
        const result = getTaskBorderStyle(task, 'task', 14);

        expect(result.borderStyle).toMatch(/border-left: 2px solid rgb\(\d+, \d+, \d+\) !important;/);
        expect(result.borderClass).toBe('tt-task-border--overdue-custom');
        expect(result.cssClasses.isOverdue).toBe(true);
      });

      test('should apply custom red color for heavily overdue (22+ days)', () => {
        const task = {
          name: 'Very overdue task',
          due_date: '2024-12-01',
          is_overdue: true,
          days_overdue: 30,
          overdue_severity: 1
        };
        const result = getTaskBorderStyle(task, 'task', 30);

        expect(result.borderStyle).toMatch(/border-left: 2px solid rgb\(\d+, \d+, \d+\) !important;/);
        expect(result.borderClass).toBe('tt-task-border--overdue-custom');
        expect(result.cssClasses.isOverdue).toBe(true);
      });
    });

    describe('Overdue Tasks with Severity 2 (Aggressive)', () => {
      test('should apply orange color for initial overdue period (1-7 days)', () => {
        const task = {
          name: 'Overdue severity 2',
          due_date: '2025-01-10',
          is_overdue: true,
          days_overdue: 5,
          overdue_severity: 2
        };
        const result = getTaskBorderStyle(task, 'task', 5);

        expect(result.borderStyle).toBe('border-left: 2px solid rgb(255, 160, 70) !important;');
        expect(result.borderClass).toBe('tt-task-border--overdue-custom');
        expect(result.cssClasses.isOverdue).toBe(true);
      });

      test('should apply red gradient for extended overdue (8+ days)', () => {
        const task = {
          name: 'Very overdue severity 2',
          due_date: '2025-01-01',
          is_overdue: true,
          days_overdue: 14,
          overdue_severity: 2
        };
        const result = getTaskBorderStyle(task, 'task', 14);

        expect(result.borderStyle).toMatch(/border-left: 2px solid rgb\(255, \d+, \d+\) !important;/);
        expect(result.borderClass).toBe('tt-task-border--overdue-custom');
        expect(result.cssClasses.isOverdue).toBe(true);
      });
    });

    describe('Overdue Tasks with Severity 3 (Critical)', () => {
      test('should apply immediate red for any overdue amount', () => {
        const testCases = [1, 5, 7, 14, 30];

        testCases.forEach(days => {
          const task = {
            name: 'Critical overdue task',
            due_date: '2025-01-01',
            is_overdue: true,
            days_overdue: days,
            overdue_severity: 3
          };
          const result = getTaskBorderStyle(task, 'task', days);

          expect(result.borderStyle).toBe('border-left: 2px solid rgb(255, 70, 40) !important;');
          expect(result.borderClass).toBe('tt-task-border--overdue-custom');
          expect(result.cssClasses.isOverdue).toBe(true);
        });
      });
    });

    describe('Default Severity Handling', () => {
      test('should default to severity 1 when overdue_severity is missing', () => {
        const task = {
          name: 'Task without severity',
          due_date: '2025-01-10',
          is_overdue: true,
          days_overdue: 5
        };
        const result = getTaskBorderStyle(task, 'task', 5);

        // Should behave like severity 1 - grace period, so generic overdue class
        expect(result.borderStyle).toBeUndefined();
        expect(result.borderClass).toBe('tt-task-border--overdue');
      });

      test('should default to severity 1 when overdue_severity is null/undefined', () => {
        const task = {
          name: 'Task with null severity',
          due_date: '2025-01-10',
          is_overdue: true,
          days_overdue: 5,
          overdue_severity: null
        };
        const result = getTaskBorderStyle(task, 'task', 5);

        expect(result.borderStyle).toBeUndefined();
        expect(result.borderClass).toBe('tt-task-border--overdue');
      });
    });

    describe('Edge Cases', () => {
      test('should handle negative days overdue', () => {
        const task = {
          name: 'Future task',
          due_date: '2025-12-25',
          is_overdue: false,
          days_overdue: -1,
          overdue_severity: 3
        };
        const result = getTaskBorderStyle(task, 'task', -1);

        expect(result.borderStyle).toBeUndefined();
        expect(result.borderClass).toBe('');
        expect(result.cssClasses.isOverdue).toBe(false);
      });

      test('should handle zero days overdue as due today', () => {
        const task = {
          name: 'Due today',
          due_date: '2025-01-15',
          is_overdue: false,
          days_overdue: 0,
          overdue_severity: 2
        };
        const result = getTaskBorderStyle(task, 'task', 0);

        expect(result.borderStyle).toBeUndefined();
        expect(result.borderClass).toBe('tt-task-border--due');
        expect(result.cssClasses.isDue).toBe(true);
        expect(result.cssClasses.isOverdue).toBe(false);
      });

      test('should prioritize API-provided overdue status over calculated', () => {
        const task = {
          name: 'Task with API data',
          due_date: '2025-01-10',
          is_overdue: true,
          days_overdue: 14,
          overdue_severity: 2
        };
        const result = getTaskBorderStyle(task, 'task', 5); // Different calculated value

        // Should use API days_overdue (14), not calculated (5)
        expect(result.borderStyle).toMatch(/border-left: 2px solid rgb\(255, \d+, \d+\) !important;/);
        expect(result.cssClasses.isOverdue).toBe(true);
      });
    });
  });
});
