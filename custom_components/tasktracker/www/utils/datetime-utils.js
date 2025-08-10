/**
 * TaskTracker DateTime Utilities
 *
 * Centralized date, time, timezone, and logical day handling for the frontend.
 * This module ensures consistent handling of user timezones and logical day boundaries
 * across all TaskTracker cards and components.
 *
 * Key Concepts:
 * - Logical Day: A "day" defined by user's daily_reset_time, not midnight
 * - User Context: Contains timezone, daily_reset_time, and current_logical_date
 * - Window Boundaries: Time windows that may cross midnight within logical days
 */

export class TaskTrackerDateTime {
  /**
   * Parse user context from API response
   * @param {Object} userContext - User context from API response
   * @returns {Object} Parsed user context with Date objects
   */
  static parseUserContext(userContext) {
    if (!userContext) {
      return {
        timezone: 'UTC',
        daily_reset_time: '00:00:00',
        current_logical_date: new Date().toISOString().split('T')[0],
        daily_task_cutoff_time: '20:00:00'
      };
    }

    return {
      timezone: userContext.timezone || 'UTC',
      daily_reset_time: userContext.daily_reset_time || '00:00:00',
      current_logical_date: userContext.current_logical_date || new Date().toISOString().split('T')[0],
      daily_task_cutoff_time: userContext.daily_task_cutoff_time || '20:00:00'
    };
  }

  /**
   * Get the current time in the user's timezone
   * @param {Object} userContext - User context object
   * @returns {Date} Current time in user's timezone
   */
  static getCurrentTimeInUserTZ(userContext) {
    const context = this.parseUserContext(userContext);
    // Note: JavaScript Date objects are always in local browser timezone
    // For true timezone handling, we'd need a library like date-fns-tz
    // For now, we assume the browser is in the user's timezone
    return new Date();
  }

  /**
   * Parse time string (HH:MM) to minutes since midnight
   * @param {string} timeStr - Time in HH:MM format
   * @returns {number} Minutes since midnight
   */
  static parseTimeToMinutes(timeStr) {
    const [hours, minutes] = timeStr.split(':').map(num => parseInt(num, 10));
    if (isNaN(hours) || isNaN(minutes)) {
      throw new Error(`Invalid time format: ${timeStr}`);
    }
    return hours * 60 + minutes;
  }

  /**
   * Convert minutes since midnight to time string
   * @param {number} totalMinutes - Minutes since midnight
   * @returns {string} Time in HH:MM format
   */
  static minutesToTimeString(totalMinutes) {
    const hours = Math.floor(totalMinutes / 60) % 24;
    const minutes = totalMinutes % 60;
    return `${hours.toString().padStart(2, '0')}:${minutes.toString().padStart(2, '0')}`;
  }

  /**
   * Get the start datetime of the current logical day
   * @param {Object} userContext - User context object
   * @returns {Date} Start of current logical day
   */
  static getCurrentLogicalDayStart(userContext) {
    const context = this.parseUserContext(userContext);
    const logicalDate = new Date(context.current_logical_date + 'T00:00:00');
    const resetMinutes = this.parseTimeToMinutes(context.daily_reset_time);

    logicalDate.setHours(Math.floor(resetMinutes / 60), resetMinutes % 60, 0, 0);
    return logicalDate;
  }

  /**
   * Get the end datetime of the current logical day
   * @param {Object} userContext - User context object
   * @returns {Date} End of current logical day
   */
  static getCurrentLogicalDayEnd(userContext) {
    const start = this.getCurrentLogicalDayStart(userContext);
    const end = new Date(start);
    end.setDate(end.getDate() + 1);
    end.setMilliseconds(-1); // End at 23:59:59.999
    return end;
  }

  /**
   * Check if current time is within the current logical day
   * @param {Object} userContext - User context object
   * @param {Date} checkTime - Time to check (defaults to now)
   * @returns {boolean} True if within current logical day
   */
  static isWithinCurrentLogicalDay(userContext, checkTime = null) {
    if (!checkTime) {
      checkTime = this.getCurrentTimeInUserTZ(userContext);
    }

    const dayStart = this.getCurrentLogicalDayStart(userContext);
    const dayEnd = this.getCurrentLogicalDayEnd(userContext);

    return checkTime >= dayStart && checkTime <= dayEnd;
  }

  /**
   * Check if a time window is currently in the past within the logical day context
   * @param {Object} window - Window object with start and end times
   * @param {Object} userContext - User context object
   * @param {Date} currentTime - Current time (defaults to now)
   * @returns {boolean} True if window is in the past
   */
  static isWindowInPast(window, userContext, currentTime = null) {
    if (!currentTime) {
      currentTime = this.getCurrentTimeInUserTZ(userContext);
    }

    const context = this.parseUserContext(userContext);
    const logicalDayStart = this.getCurrentLogicalDayStart(userContext);

    // Convert current time to minutes since logical day start
    const timeSinceLogicalStart = Math.floor((currentTime - logicalDayStart) / (1000 * 60));

    // Parse window times
    const windowStart = this.parseTimeToMinutes(window.start);
    const windowEnd = this.parseTimeToMinutes(window.end);

    // Convert window times to minutes since logical day start
    const resetMinutes = this.parseTimeToMinutes(context.daily_reset_time);

    let adjustedWindowStart = windowStart - resetMinutes;
    let adjustedWindowEnd = windowEnd - resetMinutes;

    // Handle negative adjustments (times before reset time are part of next calendar day)
    if (adjustedWindowStart < 0) {
      adjustedWindowStart += 24 * 60; // Add 24 hours
    }
    if (adjustedWindowEnd < 0) {
      adjustedWindowEnd += 24 * 60; // Add 24 hours
    }

    // Handle windows that cross midnight within the logical day
    if (adjustedWindowEnd < adjustedWindowStart) {
      // Window crosses midnight within logical day
      // It's in the past if current time is after the end and before the start
      return timeSinceLogicalStart > adjustedWindowEnd && timeSinceLogicalStart < adjustedWindowStart;
    } else {
      // Normal window within logical day
      // It's in the past if current time is after the end
      return timeSinceLogicalStart > adjustedWindowEnd;
    }
  }

  /**
   * Check if current time is within a time window (respecting logical day boundaries)
   * @param {Object} window - Window object with start and end times
   * @param {Object} userContext - User context object
   * @param {Date} currentTime - Current time (defaults to now)
   * @returns {boolean} True if current time is within the window
   */
  static isCurrentTimeInWindow(window, userContext, currentTime = null) {
    if (!currentTime) {
      currentTime = this.getCurrentTimeInUserTZ(userContext);
    }

    const context = this.parseUserContext(userContext);
    const logicalDayStart = this.getCurrentLogicalDayStart(userContext);

    // Convert current time to minutes since logical day start
    const timeSinceLogicalStart = Math.floor((currentTime - logicalDayStart) / (1000 * 60));

    // Parse window times
    const windowStart = this.parseTimeToMinutes(window.start);
    const windowEnd = this.parseTimeToMinutes(window.end);

    // Convert window times to minutes since logical day start
    const resetMinutes = this.parseTimeToMinutes(context.daily_reset_time);

    let adjustedWindowStart = windowStart - resetMinutes;
    let adjustedWindowEnd = windowEnd - resetMinutes;

    // Handle negative adjustments
    if (adjustedWindowStart < 0) {
      adjustedWindowStart += 24 * 60;
    }
    if (adjustedWindowEnd < 0) {
      adjustedWindowEnd += 24 * 60;
    }

    // Check if current time is within window
    if (adjustedWindowEnd < adjustedWindowStart) {
      // Window crosses midnight within logical day
      return timeSinceLogicalStart >= adjustedWindowStart || timeSinceLogicalStart <= adjustedWindowEnd;
    } else {
      // Normal window
      return timeSinceLogicalStart >= adjustedWindowStart && timeSinceLogicalStart <= adjustedWindowEnd;
    }
  }

  /**
   * Calculate the midpoint timestamp for a window (for completion timestamps)
   * @param {Object} window - Window object with start and end times
   * @param {Object} userContext - User context object
   * @returns {Date} Midpoint timestamp
   */
  static calculateWindowMidpoint(window, userContext) {
    const context = this.parseUserContext(userContext);
    const logicalDayStart = this.getCurrentLogicalDayStart(userContext);

    // Parse window times
    const windowStart = this.parseTimeToMinutes(window.start);
    const windowEnd = this.parseTimeToMinutes(window.end);

    // Convert to minutes since logical day start
    const resetMinutes = this.parseTimeToMinutes(context.daily_reset_time);

    let adjustedStart = windowStart - resetMinutes;
    let adjustedEnd = windowEnd - resetMinutes;

    // Handle negative adjustments
    if (adjustedStart < 0) {
      adjustedStart += 24 * 60;
    }
    if (adjustedEnd < 0) {
      adjustedEnd += 24 * 60;
    }

    // Calculate midpoint
    let midpointMinutes;
    if (adjustedEnd < adjustedStart) {
      // Window crosses midnight
      const totalWindowMinutes = (24 * 60 - adjustedStart) + adjustedEnd;
      midpointMinutes = adjustedStart + Math.floor(totalWindowMinutes / 2);
      if (midpointMinutes >= 24 * 60) {
        midpointMinutes -= 24 * 60;
      }
    } else {
      // Normal window
      midpointMinutes = Math.floor((adjustedStart + adjustedEnd) / 2);
    }

    // Convert back to actual timestamp
    const midpointTimestamp = new Date(logicalDayStart);
    midpointTimestamp.setMinutes(midpointTimestamp.getMinutes() + midpointMinutes);

    return midpointTimestamp;
  }

  /**
   * Get the appropriate completion timestamp for a window
   * Uses current time if within window, otherwise uses midpoint
   * @param {Object} window - Window object with start and end times
   * @param {Object} userContext - User context object
   * @returns {string|null} ISO timestamp string or null for current time
   */
  static getCompletionTimestamp(window, userContext) {
    if (this.isCurrentTimeInWindow(window, userContext)) {
      // Current time is within window - use current timestamp
      return null;
    } else {
      // Use window midpoint
      return this.calculateWindowMidpoint(window, userContext).toISOString();
    }
  }

  /**
   * Calculate days overdue for a task based on logical day boundaries
   * @param {string} dueDateISO - Due date in ISO format
   * @param {Object} userContext - User context object
   * @returns {number} Days overdue (0 or negative if not overdue)
   */
  static calculateDaysOverdue(dueDateISO, userContext) {
    if (!dueDateISO || !userContext) {
      return 0;
    }

    const context = this.parseUserContext(userContext);
    const dueDate = new Date(dueDateISO);

    // Get due date portion directly in user's timezone (avoid double conversion)
    const dueDateLogical = dueDate.toLocaleDateString("en-CA", { timeZone: context.timezone }); // YYYY-MM-DD format

    // Calculate difference in logical days (date-only comparison)
    const currentDateObj = new Date(context.current_logical_date + 'T00:00:00');
    const dueDateObj = new Date(dueDateLogical + 'T00:00:00');
    const timeDiff = currentDateObj.getTime() - dueDateObj.getTime();
    const daysDiff = Math.floor(timeDiff / (1000 * 60 * 60 * 24));

    return Math.max(0, daysDiff);
  }

  /**
   * Check if a date is today in the logical day context
   * @param {string} dateISO - Date in ISO format
   * @param {Object} userContext - User context object
   * @returns {boolean} True if date is today (logical day)
   */
  static isToday(dateISO, userContext) {
    if (!dateISO || !userContext) {
      return false;
    }

    const context = this.parseUserContext(userContext);
    const date = new Date(dateISO);

    // Get date portion directly in user's timezone (avoid double conversion)
    const checkDate = date.toLocaleDateString("en-CA", { timeZone: context.timezone }); // YYYY-MM-DD format

    return checkDate === context.current_logical_date;
  }

  /**
   * Calculate logical day difference between a date and current logical date
   * @param {string} dateISO - Date in ISO format
   * @param {Object} userContext - User context object
   * @returns {number} Difference in logical days (negative = future, 0 = today, positive = past)
   */
  static calculateLogicalDayDifference(dateISO, userContext) {
    if (!dateISO || !userContext) {
      return 0;
    }

    try {
      const context = this.parseUserContext(userContext);
      const date = new Date(dateISO);

      // Get date portion directly in user's timezone (avoid double conversion)
      const dateLogical = date.toLocaleDateString("en-CA", { timeZone: context.timezone }); // YYYY-MM-DD format

      // Calculate difference in logical days
      const currentDateObj = new Date(context.current_logical_date + 'T00:00:00');
      const dateObj = new Date(dateLogical + 'T00:00:00');
      const diffTime = currentDateObj.getTime() - dateObj.getTime();

      return Math.floor(diffTime / (1000 * 60 * 60 * 24));
    } catch (error) {
      console.warn('Error calculating logical day difference:', error);
      return 0;
    }
  }

  /**
   * Format a due date using logical day boundaries for daily tasks
   * @param {string} dueDateISO - Due date in ISO format
   * @param {Object} userContext - User context object
   * @param {Object} task - Task object (optional, for daily task detection)
   * @returns {string} Formatted due date string
   */
  static formatDueDateLogical(dueDateISO, userContext, task = null) {
    if (!dueDateISO) {
      return '';
    }

    try {
      // Use backend-provided days_overdue when available (most reliable)
      if (task && task.days_overdue !== undefined && task.days_overdue > 0) {
        if (task.days_overdue === 1) {
          return '1 day overdue';
        } else {
          return `${task.days_overdue} days overdue`;
        }
      }

      // For daily tasks with user context, use logical day boundaries
      if (userContext && task && task.frequency_unit === 'days' && task.frequency_value === 1) {
        const diffDays = this.calculateLogicalDayDifference(dueDateISO, userContext);

        if (diffDays > 0) {
          // Overdue
          if (diffDays === 1) {
            return '1 day overdue';
          } else {
            return `${diffDays} days overdue`;
          }
        } else if (diffDays === 0) {
          return 'Today';
        } else if (diffDays === -1) {
          return 'Tomorrow';
        } else {
          return `${Math.abs(diffDays)} days`;
        }
      }

      // Fallback to calendar day calculation for non-daily tasks or when no user context
      const dueDate = new Date(dueDateISO);
      const now = new Date();
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays < 0;

      if (isOverdue) {
        const overdueDays = Math.abs(diffDays);
        if (overdueDays === 0) {
          return 'Today';
        } else if (overdueDays === 1) {
          return '1 day overdue';
        } else {
          return `${overdueDays} days overdue`;
        }
      } else if (diffDays === 0) {
        return 'Today';
      } else if (diffDays === 1) {
        return 'Tomorrow';
      } else {
        return `${diffDays} days`;
      }
    } catch (error) {
      console.warn('Error formatting due date:', error);
      return 'Unknown';
    }
  }

  /**
   * Format time string to 12-hour format for display
   * @param {string} timeStr - Time in HH:MM format
   * @returns {string} Formatted time (e.g., "2 PM", "10:30 AM")
   */
  static formatTimeForDisplay(timeStr) {
    try {
      const [hours, minutes] = timeStr.split(':').map(num => parseInt(num, 10));
      if (isNaN(hours) || isNaN(minutes)) {
        return timeStr;
      }

      const period = hours >= 12 ? 'PM' : 'AM';
      const displayHours = hours === 0 ? 12 : hours > 12 ? hours - 12 : hours;

      if (minutes === 0) {
        return `${displayHours} ${period}`;
      } else {
        return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
      }
    } catch (e) {
      console.warn('Failed to format time:', timeStr, e);
      return timeStr;
    }
  }

  /**
   * Format a window's time range for display
   * @param {Object} window - Window object with start and end times
   * @returns {string} Formatted time range (e.g., "9 PM - 3 AM")
   */
  static formatWindowTimeRange(window) {
    const startTime = this.formatTimeForDisplay(window.start);
    const endTime = this.formatTimeForDisplay(window.end);
    return `${startTime} - ${endTime}`;
  }

  /**
   * Debug helper to log timing information
   * @param {string} label - Debug label
   * @param {Object} window - Window object
   * @param {Object} userContext - User context object
   */
  static debugWindowTiming(label, window, userContext) {
    const currentTime = this.getCurrentTimeInUserTZ(userContext);
    const logicalStart = this.getCurrentLogicalDayStart(userContext);
    const isInPast = this.isWindowInPast(window, userContext);
    const isCurrentlyIn = this.isCurrentTimeInWindow(window, userContext);
    const midpoint = this.calculateWindowMidpoint(window, userContext);

    console.log(`[DateTime Debug] ${label}:`, {
      window: `${window.start} - ${window.end}`,
      currentTime: currentTime.toLocaleTimeString(),
      logicalDayStart: logicalStart.toLocaleTimeString(),
      isInPast,
      isCurrentlyIn,
      midpoint: midpoint.toLocaleTimeString(),
      userContext: this.parseUserContext(userContext)
    });
  }
}

export default TaskTrackerDateTime;
