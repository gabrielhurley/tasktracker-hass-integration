/**
 * TaskTracker Shared Utilities
 *
 * Common functions and utilities shared across all TaskTracker cards
 */

export class TaskTrackerUtils {

  // ===========================================
  // Timezone and Logical Day Utilities
  // ===========================================
  //
  // NOTICE: These methods are deprecated. Use TaskTrackerDateTime utilities instead.
  // These are kept for backward compatibility with existing code.
  // For new code, import and use TaskTrackerDateTime from './tasktracker-datetime-utils.js'
  //

  /**
   * Convert a Date object to the user's timezone using user context
   * @deprecated Use TaskTrackerDateTime utilities instead
   * @param {Date} date - The date to convert
   * @param {Object} userContext - User context with timezone information
   * @returns {Date} - Date in user's timezone (approximation)
   */
  static dateToUserTimezone(date, userContext) {
    if (!userContext || !userContext.timezone) {
      return date; // Fallback to original date
    }

    try {
      // Use Intl.DateTimeFormat to get the offset for the user's timezone
      const userDate = new Date(date.toLocaleString("en-US", { timeZone: userContext.timezone }));
      const localDate = new Date(date.toLocaleString("en-US"));
      const offset = localDate.getTime() - userDate.getTime();

      return new Date(date.getTime() - offset);
    } catch (error) {
      console.warn('Error converting to user timezone:', error);
      return date; // Fallback to original date
    }
  }

  /**
   * Get the user's logical date based on their timezone and daily reset time
   * @deprecated Use TaskTrackerDateTime.parseUserContext() and current_logical_date instead
   * @param {Object} userContext - User context with timezone and daily_reset_time
   * @param {Date} [now] - Optional date to use instead of current time
   * @returns {string} - Logical date in YYYY-MM-DD format
   */
  static getUserLogicalDate(userContext, now = null) {
    if (!userContext) {
      // Fallback to calendar date if no user context
      const fallbackDate = now || new Date();
      return fallbackDate.toISOString().split('T')[0];
    }

    // Use the backend-provided logical date if available (preferred)
    if (userContext.current_logical_date) {
      return userContext.current_logical_date;
    }

    // Fallback calculation if current_logical_date not provided
    const currentTime = now || new Date();
    const userTime = TaskTrackerUtils.dateToUserTimezone(currentTime, userContext);

    // Parse reset time (format: "HH:MM:SS")
    const resetTimeParts = (userContext.daily_reset_time || "05:00:00").split(':');
    const resetHour = parseInt(resetTimeParts[0]);
    const resetMinute = parseInt(resetTimeParts[1]);

    // If current time is before reset time, we're still in previous logical day
    if (userTime.getHours() < resetHour ||
        (userTime.getHours() === resetHour && userTime.getMinutes() < resetMinute)) {
      const previousDay = new Date(userTime);
      previousDay.setDate(previousDay.getDate() - 1);
      return previousDay.toISOString().split('T')[0];
    }

    return userTime.toISOString().split('T')[0];
  }

  /**
   * Calculate days overdue using logical day boundaries
   * @deprecated Use TaskTrackerDateTime.calculateDaysOverdue() instead
   * @param {string} dueDateString - ISO date string of when task is due
   * @param {Object} userContext - User context with timezone information
   * @param {Date} [now] - Optional current time
   * @returns {number} - Number of logical days overdue (0 if not overdue)
   */
  static calculateLogicalDaysOverdue(dueDateString, userContext, now = null) {
    if (!dueDateString || !userContext) {
      return 0;
    }

    try {
      const dueDate = new Date(dueDateString);
      const currentLogicalDate = TaskTrackerUtils.getUserLogicalDate(userContext, now);
      const dueDateInUserTz = TaskTrackerUtils.dateToUserTimezone(dueDate, userContext);
      const dueDateLogical = dueDateInUserTz.toISOString().split('T')[0];

      // Calculate difference in logical days
      const currentDateObj = new Date(currentLogicalDate + 'T00:00:00');
      const dueDateObj = new Date(dueDateLogical + 'T00:00:00');
      const diffTime = currentDateObj.getTime() - dueDateObj.getTime();
      const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

      return Math.max(0, diffDays);
    } catch (error) {
      console.warn('Error calculating logical days overdue:', error);
      return 0;
    }
  }

  /**
   * Check if a date falls within the current logical day
   * @deprecated Use TaskTrackerDateTime.isWithinCurrentLogicalDay() instead
   * @param {string|Date} dateInput - Date to check
   * @param {Object} userContext - User context with timezone information
   * @returns {boolean} - True if date is within current logical day
   */
  static isWithinCurrentLogicalDay(dateInput, userContext) {
    if (!dateInput || !userContext) {
      return false;
    }

    try {
      const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
      const dateInUserTz = TaskTrackerUtils.dateToUserTimezone(date, userContext);
      const dateLogical = dateInUserTz.toISOString().split('T')[0];
      const currentLogical = TaskTrackerUtils.getUserLogicalDate(userContext);

      return dateLogical === currentLogical;
    } catch (error) {
      console.warn('Error checking logical day:', error);
      return false;
    }
  }

  // User management utilities
  static async getAvailableUsers(hass) {
    try {
      const response = await hass.callService('tasktracker', 'get_available_users', {}, {}, true, true);
      if (response && response.response && response.response.data && response.response.data.users) {
        return response.response.data.users;
      }
    } catch (error) {
      console.warn('Failed to fetch available users:', error);
    }
    // Fallback to empty array if service fails
    return [];
  }

  // Enhanced user management utilities
  static async getEnhancedUsers(hass) {
    try {
      const response = await hass.callService('tasktracker', 'get_available_users', {}, {}, true, true);
      if (response && response.response && response.response.data) {
        // Return enhanced users if available, otherwise fallback to basic users
        if (response.response.data.enhanced_users) {
          return response.response.data.enhanced_users;
        } else if (response.response.data.users) {
          // Create basic enhanced user objects from usernames
          return response.response.data.users.map(username => ({
            username: username,
            display_name: username,
            ha_user_id: null
          }));
        }
      }
    } catch (error) {
      console.warn('Failed to fetch enhanced users:', error);
    }
    // Fallback to empty array if service fails
    return [];
  }

  static getUserDisplayName(username, enhancedUsers) {
    if (!enhancedUsers || !Array.isArray(enhancedUsers)) {
      return username;
    }

    const userMapping = enhancedUsers.find(user => user.username === username);
    return userMapping ? userMapping.display_name : username;
  }

  static getUsernameFromDisplayName(displayName, enhancedUsers) {
    if (!enhancedUsers || !Array.isArray(enhancedUsers)) {
      return displayName;
    }

    const userMapping = enhancedUsers.find(user => user.display_name === displayName);
    return userMapping ? userMapping.username : displayName;
  }

  static getCurrentUsername(config, hass, availableUsers = null) {
    switch (config.user_filter_mode) {
      case 'explicit':
        return config.explicit_user;

      case 'current':
        // Try to map the current HA user to a TaskTracker username
        if (hass && hass.user && hass.user.name && availableUsers) {
          const currentUserName = hass.user.name.toLowerCase();

          // First try exact lowercase match
          if (availableUsers.includes(currentUserName)) {
            return currentUserName;
          }

          // Try case-insensitive match
          const matchedUser = availableUsers.find(user =>
            user.toLowerCase() === currentUserName
          );
          if (matchedUser) {
            return matchedUser;
          }

          // Try to match by first name if full name doesn't work
          const firstName = hass.user.name.split(' ')[0].toLowerCase();
          if (availableUsers.includes(firstName)) {
            return firstName;
          }

          // Try case-insensitive first name match
          const matchedFirstName = availableUsers.find(user =>
            user.toLowerCase() === firstName
          );
          if (matchedFirstName) {
            return matchedFirstName;
          }
        }

        // If no availableUsers provided or no match found, return null
        // Backend will handle user mapping via call context as fallback
        return null;

      case 'all':
      default:
        return null; // No username filter
    }
  }

  static hasValidUserConfig(config) {
    return config.user_filter_mode &&
      (config.user_filter_mode === 'all' ||
        config.user_filter_mode === 'current' ||
        (config.user_filter_mode === 'explicit' && config.explicit_user));
  }

  static getUsernameForAction(config, hass, availableUsers = null) {
    let username = TaskTrackerUtils.getCurrentUsername(config, hass, availableUsers);

    // If we're in "all users" mode and no username is configured,
    // return null to let the backend handle user mapping via call context
    if (config.user_filter_mode === 'all' && !username) {
      return null;
    }

    return username;
  }

  // Toast notification utilities
  static showSuccess(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--primary-color);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      font-size: 0.9em;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 3000);
  }

  static showError(message) {
    const toast = document.createElement('div');
    toast.textContent = message;
    toast.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      background: var(--secondary-text-color);
      color: white;
      padding: 8px 16px;
      border-radius: 4px;
      font-weight: 500;
      box-shadow: 0 2px 8px rgba(0, 0, 0, 0.2);
      z-index: 1000;
      font-size: 0.9em;
    `;

    document.body.appendChild(toast);

    setTimeout(() => {
      if (toast.parentNode) {
        toast.parentNode.removeChild(toast);
      }
    }, 5000);
  }

  // Date and time formatting utilities
  static formatDate(dateString) {
    try {
      const date = new Date(dateString);
      return date.toLocaleDateString() + ' ' + date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    } catch {
      return dateString;
    }
  }

  static formatDueDate(dueDateString, userContext = null, task = null) {
    try {
      const dueDate = new Date(dueDateString);
      const now = new Date();

      // For SelfCareTask with time windows and user context, use smart formatting
      // Check that windows array actually has content, not just that it exists
      const hasWindows = task && (
        (task.time_windows && task.time_windows.length > 0) ||
        (task.windows && task.windows.length > 0)
      );

      if (task && task.task_type === 'SelfCareTask' && hasWindows && userContext) {
        return TaskTrackerUtils.formatSelfCareDueDate(dueDate, now, userContext, task);
      }

      // Use backend-provided days_overdue when available (most reliable)
      if (task && task.days_overdue !== undefined && task.days_overdue > 0) {
        if (task.days_overdue === 1) {
          return '1 day overdue';
        } else {
          return `${task.days_overdue} days overdue`;
        }
      }

            // DEPRECATED: This logic has been moved to TaskTrackerDateTime.formatDueDateLogical()
      // Use logical day calculation for daily tasks when user context is available
      if (userContext && task && task.frequency_unit === 'days' && task.frequency_value === 1) {
        // For daily tasks, use logical day boundaries
        const currentLogicalDate = userContext.current_logical_date || TaskTrackerUtils.getUserLogicalDate(userContext);
        const dueDateInUserTz = TaskTrackerUtils.dateToUserTimezone(dueDate, userContext);
        const dueDateLogical = dueDateInUserTz.toISOString().split('T')[0];

        // Calculate difference in logical days
        const currentDateObj = new Date(currentLogicalDate + 'T00:00:00');
        const dueDateObj = new Date(dueDateLogical + 'T00:00:00');
        const diffTime = currentDateObj.getTime() - dueDateObj.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

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

      // Fallback to calendar day calculation for non-daily tasks
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      const isOverdue = diffDays < 0;

      if (isOverdue) {
        // Overdue formatting
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
      console.error('Error formatting due date:', error);
      return 'Unknown';
    }
  }

  static formatSelfCareDueDate(dueDate, now, userContext, task) {
    try {
      // Check if task is overdue first - use the days_overdue field from API
      if (task.days_overdue && task.days_overdue > 0) {
        if (task.days_overdue === 1) {
          return '1 day overdue';
        } else {
          return `${task.days_overdue} days overdue`;
        }
      }

      // Normalize time windows to consistent format [startTime, endTime]
      const normalizeTimeWindows = (task) => {
        if (task.windows && task.windows.length > 0) {
          // New format: array of objects with start/end properties
          return task.windows.map(window => [window.start, window.end]);
        } else if (task.time_windows && task.time_windows.length > 0) {
          // Legacy format: array of [start, end] arrays
          return task.time_windows;
        }
        return [];
      };

      const timeWindows = normalizeTimeWindows(task);

      // Use the new logical day utilities instead of manual calculation
      const currentLogicalDate = TaskTrackerUtils.getUserLogicalDate(userContext, now);
      const dueDateInUserTz = TaskTrackerUtils.dateToUserTimezone(dueDate, userContext);
      const dueDateLogical = dueDateInUserTz.toISOString().split('T')[0];

      // Check completion status
      const requiredOccurrences = task.required_occurrences || 1;
      const remainingOccurrences = Math.max(0, requiredOccurrences - (task.today_completions_count || 0));

      // Use backend-provided outstanding_occurrences if available (more reliable)
      const actualRemaining = task.outstanding_occurrences !== undefined ?
        task.outstanding_occurrences : remainingOccurrences;

      // PRIORITY FIX: For self-care tasks, if there are outstanding occurrences and the task is not overdue,
      // show it as actionable "Today" regardless of when the next specific window starts
      if (actualRemaining > 0 && task.days_overdue === 0) {
        // Check if task is complete for today
        if (actualRemaining === 0) {
          return 'Complete for today';
        }

        // For tasks with time windows, find the next incomplete window
        if (timeWindows && timeWindows.length > 0) {
          const nextIncompleteWindow = TaskTrackerUtils.findNextIncompleteWindow(
            timeWindows,
            now,
            task.today_completions || []
          );

          if (nextIncompleteWindow) {
            const startTime12 = TaskTrackerUtils.convertTo12HourFormat(nextIncompleteWindow[0]);
            const endTime12 = TaskTrackerUtils.convertTo12HourFormat(nextIncompleteWindow[1]);

            // Always show as "Today" when there are outstanding occurrences
            if (requiredOccurrences > 1) {
              return `Today (${startTime12}-${endTime12}) - ${actualRemaining} left`;
            } else {
              return `Today (${startTime12}-${endTime12})`;
            }
          }
        }

        // No specific time window found, but there are outstanding occurrences
        // Show as "Today" since the task is actionable
        if (requiredOccurrences > 1) {
          return `Today - ${actualRemaining} left`;
        } else {
          return 'Today';
        }
      }

      // Check if due date falls within current logical day (fallback for edge cases)
      if (dueDateLogical === currentLogicalDate) {
        // Check if task is complete for today
        if (actualRemaining === 0) {
          return 'Complete for today';
        }

        // No specific time window found, show general status
        if (requiredOccurrences > 1) {
          return `Today - ${actualRemaining} left`;
        } else {
          return 'Today';
        }
      } else {
        // Calculate days until due using logical boundaries
        const currentDateObj = new Date(currentLogicalDate + 'T00:00:00');
        const dueDateObj = new Date(dueDateLogical + 'T00:00:00');
        const diffTime = dueDateObj.getTime() - currentDateObj.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays === 1) {
          // Due tomorrow - check for time window context
          const dueHour = dueDateInUserTz.getHours();
          const dueMinute = dueDateInUserTz.getMinutes();
          const dueTimeStr = `${dueHour.toString().padStart(2, '0')}:${dueMinute.toString().padStart(2, '0')}`;

          for (const [startTime, endTime] of timeWindows || []) {
            if (endTime < startTime) {
              // Cross-midnight window - due time might be early morning of "tomorrow"
              if (dueTimeStr <= endTime) {
                const startTime12 = TaskTrackerUtils.convertTo12HourFormat(startTime);
                const endTime12 = TaskTrackerUtils.convertTo12HourFormat(endTime);
                return `Tomorrow (${startTime12}-${endTime12})`;
              }
            } else if (dueTimeStr >= startTime && dueTimeStr <= endTime) {
              const startTime12 = TaskTrackerUtils.convertTo12HourFormat(startTime);
              const endTime12 = TaskTrackerUtils.convertTo12HourFormat(endTime);
              return `Tomorrow (${startTime12}-${endTime12})`;
            }
          }

          return 'Tomorrow';
        } else if (diffDays === 2) {
          return 'In 2 days';
        } else if (diffDays > 2) {
          return `In ${diffDays} days`;
        } else {
          return 'Today';
        }
      }
    } catch (error) {
      console.warn('Error in formatSelfCareDueDate:', error);
      // Fallback to simple relative time
      const diffTime = dueDate.getTime() - now.getTime();
      const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
      if (diffDays === 0) return 'Today';
      if (diffDays === 1) return 'Tomorrow';
      return `${diffDays} days`;
    }
  }

  static convertTo12HourFormat(time24) {
    try {
      const [hours, minutes] = time24.split(':');
      const hour = parseInt(hours);
      const ampm = hour < 12 ? 'AM' : 'PM';
      const hour12 = hour % 12 || 12;

      if (minutes === '00') {
        return `${hour12} ${ampm}`;
      } else {
        return `${hour12}:${minutes} ${ampm}`;
      }
    } catch (error) {
      // Fallback to original format if conversion fails
      return time24;
    }
  }

  static getCompletedTimeWindows(task, logicalToday, logicalTomorrow) {
    if (!task.today_completions || !task.time_windows) {
      return [];
    }

    const completedWindows = [];

    task.today_completions.forEach(completionTimeStr => {
      const completionTime = new Date(completionTimeStr);
      const compHour = completionTime.getHours();
      const compMinute = completionTime.getMinutes();
      const compTimeStr = `${compHour.toString().padStart(2, '0')}:${compMinute.toString().padStart(2, '0')}`;

      task.time_windows.forEach(window => {
        const [startTime, endTime] = window;
        if (endTime < startTime) {
          // Cross-midnight window
          if (compTimeStr >= startTime || compTimeStr <= endTime) {
            completedWindows.push(window);
          }
        } else {
          // Normal window
          if (compTimeStr >= startTime && compTimeStr <= endTime) {
            completedWindows.push(window);
          }
        }
      });
    });

    return completedWindows;
  }

  static isWindowCompleted(window, completedWindows) {
    return completedWindows.some(completed =>
      completed[0] === window[0] && completed[1] === window[1]
    );
  }

        static findNextIncompleteWindow(timeWindows, now, completedWindows) {
    const nowHour = now.getHours();
    const nowMinute = now.getMinutes();
    const nowTimeStr = `${nowHour.toString().padStart(2, '0')}:${nowMinute.toString().padStart(2, '0')}`;

    // First, try to find a window that hasn't been used for completion yet
    const unusedWindows = timeWindows.filter(window =>
      !TaskTrackerUtils.isWindowCompleted(window, completedWindows)
    );

    // If we have unused windows, prioritize them
    if (unusedWindows.length > 0) {
      // Find the next available unused window starting from current time
      for (const window of unusedWindows) {
        const [startTime, endTime] = window;

        // Check if this window is current or upcoming today
        if (endTime < startTime) {
          // Cross-midnight window
          if (nowTimeStr >= startTime || nowTimeStr <= endTime) {
            return window; // Currently in this window
          } else if (nowTimeStr < startTime) {
            return window; // Window starts later today
          }
        } else {
          // Normal window
          if (nowTimeStr >= startTime && nowTimeStr <= endTime) {
            return window; // Currently in this window
          } else if (nowTimeStr < startTime) {
            return window; // Window starts later today
          }
        }
      }

      // If no unused windows are upcoming today, return the first unused window
      return unusedWindows[0];
    }

    // If all windows have been used, fall back to any available window
    // This handles edge cases where more completions than windows exist
    for (const window of timeWindows) {
      const [startTime, endTime] = window;

      if (endTime < startTime) {
        // Cross-midnight window
        if (nowTimeStr >= startTime || nowTimeStr <= endTime) {
          return window;
        } else if (nowTimeStr < startTime) {
          return window;
        }
      } else {
        // Normal window
        if (nowTimeStr >= startTime && nowTimeStr <= endTime) {
          return window;
        } else if (nowTimeStr < startTime) {
          return window;
        }
      }
    }

    return timeWindows.length > 0 ? timeWindows[0] : null;
  }

  static formatDateTime(dateString, userContext = null) {
    try {
      const date = new Date(dateString);
      const now = new Date();
      const diffMs = now - date;

      // Use logical day calculation when user context is available
      if (userContext) {
        const dateInUserTz = TaskTrackerUtils.dateToUserTimezone(date, userContext);
        const nowInUserTz = TaskTrackerUtils.dateToUserTimezone(now, userContext);

        const currentLogicalDate = TaskTrackerUtils.getUserLogicalDate(userContext, now);
        const dateLogical = TaskTrackerUtils.dateToUserTimezone(date, userContext).toISOString().split('T')[0];

        const currentDateObj = new Date(currentLogicalDate + 'T00:00:00');
        const dateLogicalObj = new Date(dateLogical + 'T00:00:00');
        const diffTime = currentDateObj.getTime() - dateLogicalObj.getTime();
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
        const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

        // Return relative time for recent completions
        if (diffDays === 0) {
          if (diffHours === 0) {
            if (diffMinutes < 1) {
              return 'Just now';
            }
            return `${diffMinutes}m ago`;
          }
          return `${diffHours}h ago`;
        } else if (diffDays === 1) {
          return 'Yesterday';
        } else {
          return `${diffDays} days ago`;
        }
      }

      // Fallback to original calendar day calculation
      const dateLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
      const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.floor((nowLocal - dateLocal) / (1000 * 60 * 60 * 24));

      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));

      // Return relative time for recent completions
      if (diffDays === 0) {
        if (diffHours === 0) {
          if (diffMinutes < 1) {
            return 'Just now';
          }
          return `${diffMinutes}m ago`;
        }
        return `${diffHours}h ago`;
      } else if (diffDays === 1) {
        return 'Yesterday';
      } else {
        return `${diffDays} days ago`;
      }
    } catch {
      return dateString;
    }
  }

  static formatDuration(minutes) {
    if (!minutes) return 'Unknown';

    if (minutes < 60) {
      return `${minutes}m`;
    } else {
      const hours = Math.floor(minutes / 60);
      const remainingMinutes = minutes % 60;
      return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
    }
  }

  // Priority formatting
  static formatPriority(priority) {
    const priorityStringMap = {
      'High': 1,
      'Medium': 2,
      'Low': 3
    };

    const priorityMap = {
      3: 'Low',
      2: 'Medium',
      1: 'High',
      4: 'Very Low',
      5: 'Minimal'
    };

    if (priority in priorityStringMap) {
      return priorityMap[priorityStringMap[priority]];
    } else {
      return priorityMap[priority] || `Priority ${priority}`;
    }
  }

  // Priority normalization - converts string priorities to integer values
  static normalizePriority(priority) {
    const priorityStringMap = {
      'High': 1,
      'Medium': 2,
      'Low': 3,
      'Very Low': 4,
      'Minimal': 5
    };

    if (typeof priority === 'string' && priority in priorityStringMap) {
      return priorityStringMap[priority];
    }

    // If it's already a number, return as-is
    if (typeof priority === 'number') {
      return priority;
    }

    // Fallback to null if we can't determine the priority
    return null;
  }

  // Task and leftover completion methods
  static async completeTask(hass, taskName, username, notes, completed_at = null) {
    try {
      const params = {
        name: taskName
      };

      // Only include completed_by if username is provided
      // If null, let backend handle user mapping via call context
      if (username) {
        params.completed_by = username;
      }

      if (notes) {
        params.notes = notes;
      }

      if (completed_at) {
        params.completed_at = completed_at;
      }

      const response = await hass.callService('tasktracker', 'complete_task_by_name', params, {}, true, true);

      if (response && response.response && response.response.success) {
        TaskTrackerUtils.showSuccess(response.response.spoken_response || 'Task completed successfully');
        return response.response;
      } else {
        throw new Error('Failed to complete task');
      }
    } catch (error) {
      console.error('Failed to complete task:', error);
      TaskTrackerUtils.showError('Failed to complete task: ' + error.message);
      throw error;
    }
  }

  // Completion editing methods
  static async deleteCompletion(hass, completionId) {
    try {
      const params = {
        completion_id: completionId
      };

      const response = await hass.callService('tasktracker', 'delete_completion', params, {}, true, true);

      if (response && response.response && response.response.success) {
        TaskTrackerUtils.showSuccess(response.response.spoken_response || 'Completion deleted successfully');
        return response.response;
      } else {
        throw new Error('Failed to delete completion');
      }
    } catch (error) {
      console.error('Failed to delete completion:', error);
      TaskTrackerUtils.showError('Failed to delete completion: ' + error.message);
      throw error;
    }
  }

  static async updateCompletion(hass, completionId, updates) {
    try {
      const params = {
        completion_id: completionId,
        ...updates
      };

      const response = await hass.callService('tasktracker', 'update_completion', params, {}, true, true);

      if (response && response.response && response.response.success) {
        TaskTrackerUtils.showSuccess(response.response.spoken_response || 'Completion updated successfully');
        return response.response;
      } else {
        throw new Error('Failed to update completion');
      }
    } catch (error) {
      console.error('Failed to update completion:', error);
      TaskTrackerUtils.showError('Failed to update completion: ' + error.message);
      throw error;
    }
  }

  // Task update utility
  static async updateTask(hass, taskId, taskType, assignedTo, updates) {
    const serviceData = {
      task_id: taskId,
      task_type: taskType,
      assigned_to: assignedTo,
      ...updates
    };

    const response = await hass.callService('tasktracker', 'update_task', serviceData, {}, true, true);

    // Fire a custom event to notify other cards
    if (response && response.response && response.response.success) {
      await TaskTrackerUtils.fireTaskEvent(hass, 'task_updated', {
        task_id: taskId,
        updates: updates,
        update_data: response.response.data
      });
    }

    return response.response;
  }

  // Leftover disposal utility
  static async disposeLeftover(hass, leftoverName, username, notes) {
    const serviceData = {
      name: leftoverName,
      event_type: 'leftover_disposed'
    };

    // Only include assigned_to if username is provided
    // If null, let backend handle user mapping via call context
    if (username) {
      serviceData.assigned_to = username;
    }

    if (notes) {
      serviceData.notes = notes;
    }

    const response = await hass.callService('tasktracker', 'complete_task_by_name', serviceData, {}, true, true);

    // Fire a custom event to notify other cards
    if (response && response.response && response.response.success) {
      await TaskTrackerUtils.fireTaskEvent(hass, 'leftover_disposed', {
        leftover_name: leftoverName,
        username: username,
        notes: notes,
        disposal_data: response.response.data
      });
    }

    return response.response;
  }

  // Event listening utility for cross-card communication
  static setupTaskCompletionListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'task_completed', callback);
  }

  // Event listening utility for leftover disposal events
  static setupLeftoverDisposalListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'leftover_disposed', callback);
  }

  // Event listening utility for task creation events
  static setupTaskCreationListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'task_created', callback);
  }

  // Event listening utility for leftover creation events
  static setupLeftoverCreationListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'leftover_created', callback);
  }

  // Event listening utility for task update events
  static setupTaskUpdateListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'task_updated', callback);
  }

  // Event listening utility for completion deletion events
  static setupCompletionDeletionListener(hass, callback) {
    return TaskTrackerUtils.setupEventListener(hass, 'completion_deleted', callback);
  }

  // Generic event listening utility for cross-card communication
  static setupEventListener(hass, eventType, callback) {
    // Use Home Assistant's event bus to listen for custom events
    // subscribeEvents returns a promise that resolves to an unsubscribe function
    let unsubscribePromise = hass.connection.subscribeEvents(
      (event) => {
        callback(event.data);
      },
      `tasktracker_${eventType}`
    );

    // Track if this subscription has been cleaned up
    let isCleanedUp = false;

    // Return cleanup function that handles the promise properly
    return async () => {
      if (isCleanedUp) {
        return; // Already cleaned up, avoid duplicate cleanup
      }

      try {
        const unsubscribe = await unsubscribePromise;
        if (typeof unsubscribe === 'function') {
          unsubscribe();
        }
      } catch (error) {
        // Only warn for unexpected errors, not "not_found" which is common during re-renders
        if (error.code !== 'not_found') {
          console.warn('Error cleaning up TaskTracker event listener:', error);
        }
      } finally {
        isCleanedUp = true;
      }
    };
  }

  // Generic event firing utility for other task actions
  static async fireTaskEvent(hass, eventType, data) {
    try {
      // Use Home Assistant's REST API to fire custom events
      const eventUrl = `/api/events/tasktracker_${eventType}`;
      await hass.callApi('POST', eventUrl.substring(5), data); // Remove '/api/' prefix as callApi adds it
    } catch (error) {
      console.warn('Failed to fire TaskTracker event:', error);
    }
  }

  // Utility functions for task editing
  static formatDateTimeForInput(dateString) {
    if (!dateString) return '';
    try {
      const date = new Date(dateString);
      // Format as YYYY-MM-DDTHH:MM for datetime-local input
      const year = date.getFullYear();
      const month = String(date.getMonth() + 1).padStart(2, '0');
      const day = String(date.getDate()).padStart(2, '0');
      const hours = String(date.getHours()).padStart(2, '0');
      const minutes = String(date.getMinutes()).padStart(2, '0');
      return `${year}-${month}-${day}T${hours}:${minutes}`;
    } catch {
      return '';
    }
  }

  static getPriorityOptions() {
    return [
      { value: 1, label: 'High' },
      { value: 2, label: 'Medium' },
      { value: 3, label: 'Low' }
    ];
  }

  static getFrequencyDaysOptions() {
    return [
      { value: 1, label: 'Daily (1 day)' },
      { value: 3, label: 'Twice Weekly (3 days)' },
      { value: 7, label: 'Weekly (7 days)' },
      { value: 14, label: 'Biweekly (14 days)' },
      { value: 30, label: 'Monthly (30 days)' },
      { value: 90, label: 'Quarterly (90 days)' },
      { value: 365, label: 'Yearly (365 days)' }
    ];
  }

  // Modal creation utilities
  static createStyledButton(text, type = 'default', onClick = null) {
    const button = document.createElement('button');
    button.textContent = text;

    if (type === 'error') {
      button.style.cssText = `
        padding: 6px 12px;
        border: 1px solid var(--error-color, #f44336);
        border-radius: 4px;
        background: transparent;
        color: var(--error-color, #f44336);
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8em;
      `;

      // Error button hover effect
      button.addEventListener('mouseenter', () => {
        button.style.background = 'var(--error-color, #f44336)';
        button.style.color = 'white';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = 'transparent';
        button.style.color = 'var(--error-color, #f44336)';
      });
    } else {
      // Default button styling
      button.style.cssText = `
        padding: 6px 12px;
        border: none;
        background: transparent;
        color: var(--secondary-text-color);
        border-radius: 4px;
        cursor: pointer;
        font-family: inherit;
        font-size: 0.8em;
      `;

      // Default button hover effect
      button.addEventListener('mouseenter', () => {
        button.style.background = 'var(--divider-color)';
        button.style.color = 'var(--primary-text-color)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = 'transparent';
        button.style.color = 'var(--secondary-text-color)';
      });
    }

    if (onClick) {
      button.addEventListener('click', onClick);
    }

    return button;
  }

  static createTaskModal(task, config, onComplete, onSave = null, availableUsers = [], enhancedUsers = null, onEdit = null) {
    const modal = document.createElement('div');
    modal.className = 'task-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: var(--card-background-color);
      border-radius: 8px;
      padding: 24px;
      width: 90%;
      max-width: 500px;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font-family: var(--primary-font-family);
    `;

    const taskName = task.name || task.task_name;
    const taskDuration = task.duration_minutes || task.task_duration_minutes || 0;
    const taskPriority = task.priority || task.task_priority_value || 2;
    const isRecurringTask = task.task_type in ['RecurringTask', 'SelfCareTask'];
    const assignedTo = task.assigned_to;
    const dueDate = task.next_due || task.due_date;

    // Declare variables for advanced inputs so they are in scope for save handler
    let energyInput, focusInput, painInput, motivationInput, severitySelect;
    let energyInputWrapper, focusInputWrapper, painInputWrapper, motivationInputWrapper;

    // Format due date for datetime-local input
    const formattedDueDate = dueDate ? TaskTrackerUtils.formatDateTimeForInput(dueDate) : '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    `;

    const title = document.createElement('h3');
    title.textContent = taskName;
    title.style.cssText = `
      margin: 0;
      color: var(--primary-text-color);
      font-size: 1.5em;
      font-weight: 500;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--secondary-text-color);
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    header.appendChild(title);
    header.appendChild(closeButton);

    // Task details grid
    const detailsGrid = document.createElement('div');
    detailsGrid.style.cssText = `
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 16px;
      margin-bottom: 20px;
    `;

    // Duration field (editable if onSave is provided)
    const durationField = document.createElement('div');
    durationField.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    const durationLabel = document.createElement('label');
    durationLabel.textContent = 'Duration';
    durationLabel.style.cssText = `
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    let durationControl;
    if (onSave) {
      durationControl = document.createElement('input');
      durationControl.type = 'number';
      durationControl.value = taskDuration;
      durationControl.min = '1';
      durationControl.style.cssText = `
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      `;
    } else {
      durationControl = document.createElement('span');
      durationControl.textContent = TaskTrackerUtils.formatDuration(taskDuration);
      durationControl.style.cssText = `
        padding: 8px;
        color: var(--primary-text-color);
        font-size: 14px;
      `;
    }

    durationField.appendChild(durationLabel);
    durationField.appendChild(durationControl);

    // Priority field (editable if onSave is provided)
    const priorityField = document.createElement('div');
    priorityField.style.cssText = 'display: flex; flex-direction: column; gap: 4px;';
    const priorityLabel = document.createElement('label');
    priorityLabel.textContent = 'Priority';
    priorityLabel.style.cssText = `
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    let priorityControl;
    if (onSave) {
      priorityControl = document.createElement('select');
      priorityControl.style.cssText = `
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      `;
      TaskTrackerUtils.getPriorityOptions().forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        optionElement.selected = option.value === taskPriority;
        priorityControl.appendChild(optionElement);
      });
    } else {
      priorityControl = document.createElement('span');
      priorityControl.textContent = TaskTrackerUtils.formatPriority(taskPriority);
      priorityControl.style.cssText = `
        padding: 8px;
        color: var(--primary-text-color);
        font-size: 14px;
      `;
    }

    priorityField.appendChild(priorityLabel);
    priorityField.appendChild(priorityControl);

    detailsGrid.appendChild(durationField);
    detailsGrid.appendChild(priorityField);

    // Due date field (editable if onSave is provided and task is recurring)
    if (isRecurringTask) {
      const dueDateField = document.createElement('div');
      dueDateField.style.cssText = 'display: flex; flex-direction: column; gap: 4px; grid-column: 1 / -1;';
      const dueDateLabel = document.createElement('label');
      dueDateLabel.textContent = 'Due Date';
      dueDateLabel.style.cssText = `
        font-size: 0.85em;
        color: var(--secondary-text-color);
        font-weight: 500;
      `;

      let dueDateControl;
      if (onSave) {
        dueDateControl = document.createElement('input');
        dueDateControl.type = 'datetime-local';
        dueDateControl.value = formattedDueDate;
        dueDateControl.style.cssText = `
          padding: 8px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 14px;
        `;
      } else {
        dueDateControl = document.createElement('span');
        dueDateControl.textContent = dueDate ? TaskTrackerUtils.formatDateTime(dueDate) : 'Not set';
        dueDateControl.style.cssText = `
          padding: 8px;
          color: var(--primary-text-color);
          font-size: 14px;
        `;
      }

      dueDateField.appendChild(dueDateLabel);
      dueDateField.appendChild(dueDateControl);
      detailsGrid.appendChild(dueDateField);
    }

    // Assignment field (editable if onSave is provided and users available)
    if (onSave && availableUsers && availableUsers.length > 0) {
      const assignmentField = document.createElement('div');
      assignmentField.style.cssText = 'display: flex; flex-direction: column; gap: 4px; grid-column: 1 / -1;';
      const assignmentLabel = document.createElement('label');
      assignmentLabel.textContent = 'Assigned To';
      assignmentLabel.style.cssText = `
        font-size: 0.85em;
        color: var(--secondary-text-color);
        font-weight: 500;
      `;

      const assignmentControl = document.createElement('select');
      assignmentControl.style.cssText = `
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      `;

      availableUsers.forEach(username => {
        const optionElement = document.createElement('option');
        optionElement.value = username;
        optionElement.textContent = TaskTrackerUtils.getUserDisplayName(username, enhancedUsers);
        optionElement.selected = username === assignedTo;
        assignmentControl.appendChild(optionElement);
      });

      assignmentField.appendChild(assignmentLabel);
      assignmentField.appendChild(assignmentControl);
      detailsGrid.appendChild(assignmentField);
    }

    // -------------------------------------------------------------
    // Advanced axis cost & overdue severity section (collapsible)
    // -------------------------------------------------------------
    if (onSave) {
      // Toggle
      const advancedToggle = document.createElement('button');
      advancedToggle.textContent = 'Advanced';
      advancedToggle.style.cssText = `
        margin-top: 8px;
        padding: 6px 10px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 0.75em;
        cursor: pointer;
        grid-column: 1 / -1;
        justify-self: start;
      `;

      // Container for advanced inputs
      const advancedContainer = document.createElement('div');
      advancedContainer.style.cssText = `
        display: none;
        grid-column: 1 / -1;
        margin-top: 12px;
        gap: 12px;
        grid-template-columns: 1fr 1fr;
      `;

      const makeNumberField = (labelText, initialValue, min, max, step = 1) => {
        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;flex-direction:column;gap:4px;';

        const lbl = document.createElement('label');
        lbl.textContent = labelText;
        lbl.style.cssText = `
          font-size: 0.75em;
          color: var(--secondary-text-color);
          font-weight: 500;
        `;

        const inp = document.createElement('input');
        inp.type = 'number';
        inp.value = initialValue;
        inp.min = min;
        inp.max = max;
        inp.step = step;
        inp.style.cssText = `
          padding: 6px;
          border: 1px solid var(--divider-color);
          border-radius: 4px;
          background: var(--card-background-color);
          color: var(--primary-text-color);
          font-size: 13px;
        `;

        wrapper.appendChild(lbl);
        wrapper.appendChild(inp);
        return { wrapper, input: inp };
      };

      // Build inputs
      ({ wrapper: energyInputWrapper, input: energyInput } = makeNumberField('Energy Cost', task.energy_cost ?? 2, 0, 5));
      ({ wrapper: focusInputWrapper, input: focusInput } = makeNumberField('Focus Cost', task.focus_cost ?? 2, 0, 5));
      ({ wrapper: painInputWrapper, input: painInput } = makeNumberField('Pain Cost', task.pain_cost ?? 0, 0, 5));
      ({ wrapper: motivationInputWrapper, input: motivationInput } = makeNumberField('Motivation Boost', task.motivation_boost ?? 0, -5, 5));

      // Overdue severity select
      const severityWrapper = document.createElement('div');
      severityWrapper.style.cssText = 'display:flex;flex-direction:column;gap:4px;';
      const sevLbl = document.createElement('label');
      sevLbl.textContent = 'Overdue Severity';
      sevLbl.style.cssText = `
        font-size: 0.75em;
        color: var(--secondary-text-color);
        font-weight: 500;
      `;
      severitySelect = document.createElement('select');
      severitySelect.style.cssText = `
        padding: 6px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 13px;
      `;
      [
        { value: 1, label: 'Low' },
        { value: 2, label: 'Medium' },
        { value: 3, label: 'High' }
      ].forEach(opt => {
        const optionEl = document.createElement('option');
        optionEl.value = opt.value;
        optionEl.textContent = opt.label;
        optionEl.selected = (task.overdue_severity ?? 2) === opt.value;
        severitySelect.appendChild(optionEl);
      });
      severityWrapper.appendChild(sevLbl);
      severityWrapper.appendChild(severitySelect);

      // Append to container (two-column grid)
      advancedContainer.appendChild(energyInputWrapper);
      advancedContainer.appendChild(focusInputWrapper);
      advancedContainer.appendChild(painInputWrapper);
      advancedContainer.appendChild(motivationInputWrapper);
      advancedContainer.appendChild(severityWrapper);

      // Toggle logic
      advancedToggle.addEventListener('click', () => {
        advancedContainer.style.display = advancedContainer.style.display === 'none' ? 'grid' : 'none';
      });

      detailsGrid.appendChild(advancedToggle);
      detailsGrid.appendChild(advancedContainer);
    }

    // Notes section
    const notesSection = document.createElement('div');
    notesSection.style.cssText = 'margin-bottom: 20px;';

    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Task Notes';
    notesLabel.style.cssText = `
      display: block;
      margin-bottom: 8px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    const taskNotes = document.createElement('div');
    taskNotes.textContent = task.notes;
    taskNotes.style.cssText = `
      padding: 12px;
      background: var(--secondary-background-color);
      border-radius: 4px;
      color: var(--primary-text-color);
      font-size: 14px;
      line-height: 1.4;
      margin-bottom: 16px;
      min-height: 40px;
    `;

    const completionNotesLabel = document.createElement('label');
    completionNotesLabel.textContent = config.show_completion_notes !== false ? 'Completion Notes (Optional)' : '';
    completionNotesLabel.style.cssText = `
      display: ${config.show_completion_notes !== false ? 'block' : 'none'};
      margin-bottom: 8px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    const completionNotesTextarea = document.createElement('textarea');
    completionNotesTextarea.placeholder = 'Add completion notes...';
    completionNotesTextarea.style.cssText = `
      width: 100%;
      min-height: 80px;
      padding: 12px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
      display: ${config.show_completion_notes !== false ? 'block' : 'none'};
    `;

    notesSection.appendChild(notesLabel);
    notesSection.appendChild(taskNotes);
    notesSection.appendChild(completionNotesLabel);
    notesSection.appendChild(completionNotesTextarea);

    // Buttons
    // Past completion section (initially hidden)
    const pastCompletionSection = document.createElement('div');
    pastCompletionSection.style.cssText = `
      display: none;
      margin-top: 16px;
      padding: 16px;
      background: var(--secondary-background-color);
      border-radius: 8px;
      border-left: 4px solid var(--primary-color);
    `;

    const pastCompletionTitle = document.createElement('h4');
    pastCompletionTitle.textContent = 'When was this completed?';
    pastCompletionTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: var(--primary-text-color);
      font-size: 1em;
      font-weight: 500;
    `;

    const quickOptionsContainer = document.createElement('div');
    quickOptionsContainer.style.cssText = `
      display: flex;
      gap: 8px;
      margin-bottom: 12px;
    `;

    const yesterdayButton = document.createElement('button');
    yesterdayButton.textContent = 'Yesterday';
    yesterdayButton.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: transparent;
      color: var(--primary-text-color);
      cursor: pointer;
      font-family: inherit;
      font-size: 0.9em;
      text-align: center;
    `;

    const customDateButton = document.createElement('button');
    customDateButton.textContent = 'Choose Date/Time';
    customDateButton.style.cssText = `
      flex: 1;
      padding: 8px 12px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: transparent;
      color: var(--primary-text-color);
      cursor: pointer;
      font-family: inherit;
      font-size: 0.9em;
      text-align: center;
    `;

    // Add hover effects for both buttons
    [yesterdayButton, customDateButton].forEach(button => {
      button.addEventListener('mouseenter', () => {
        button.style.background = 'var(--divider-color)';
      });
      button.addEventListener('mouseleave', () => {
        button.style.background = 'transparent';
      });
    });

    quickOptionsContainer.appendChild(yesterdayButton);
    quickOptionsContainer.appendChild(customDateButton);

    // Custom date/time input (initially hidden)
    const customDateContainer = document.createElement('div');
    customDateContainer.style.cssText = `
      display: none;
      margin-top: 12px;
    `;

    const customDateLabel = document.createElement('label');
    customDateLabel.textContent = 'Completion Date & Time';
    customDateLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    const customDateInput = document.createElement('input');
    customDateInput.type = 'datetime-local';
    customDateInput.style.cssText = `
      width: 100%;
      padding: 8px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font-size: 14px;
      box-sizing: border-box;
    `;

    // Set default to yesterday at current time
    const yesterday = new Date();
    yesterday.setDate(yesterday.getDate() - 1);
    customDateInput.value = TaskTrackerUtils.formatDateTimeForInput(yesterday.toISOString());

    customDateContainer.appendChild(customDateLabel);
    customDateContainer.appendChild(customDateInput);

    const pastCompletionButtons = document.createElement('div');
    pastCompletionButtons.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 12px;
    `;

    const cancelPastButton = TaskTrackerUtils.createStyledButton('Cancel');
    cancelPastButton.style.fontSize = '0.9em';
    cancelPastButton.style.padding = '6px 12px';
    cancelPastButton.style.background = 'var(--secondary-background-color)';
    cancelPastButton.style.color = 'var(--primary-text-color)';
    cancelPastButton.style.border = '1px solid var(--divider-color)';

    const confirmPastButton = TaskTrackerUtils.createStyledButton('Mark as Completed');
    confirmPastButton.style.fontSize = '0.9em';
    confirmPastButton.style.padding = '6px 12px';

    pastCompletionButtons.appendChild(cancelPastButton);
    pastCompletionButtons.appendChild(confirmPastButton);

    pastCompletionSection.appendChild(pastCompletionTitle);
    pastCompletionSection.appendChild(quickOptionsContainer);
    pastCompletionSection.appendChild(customDateContainer);
    pastCompletionSection.appendChild(pastCompletionButtons);

    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: flex-end;
      margin-top: 24px;
    `;

    const cancelButton = TaskTrackerUtils.createStyledButton('Cancel');

    // Save button (only if onSave callback provided)
    let saveButton;
    if (onSave) {
      saveButton = TaskTrackerUtils.createStyledButton('Save');
    }

    // Edit button (only if onEdit callback provided)
    let editButton;
    if (onEdit) {
      editButton = TaskTrackerUtils.createStyledButton('Edit');
    }

    const completeButton = TaskTrackerUtils.createStyledButton('Complete');
    completeButton.style.border = '1px solid var(--divider-color)';

    const completedAlreadyButton = TaskTrackerUtils.createStyledButton('Completed Already');
    completedAlreadyButton.style.background = 'transparent';
    completedAlreadyButton.style.color = 'var(--secondary-text-color)';
    completedAlreadyButton.style.border = 'none';

    // Append buttons in correct order: Cancel, Save (if exists), Edit (if exists), Completed Already, Complete
    buttonContainer.appendChild(cancelButton);
    if (saveButton) {
      buttonContainer.appendChild(saveButton);
    }
    if (editButton) {
      buttonContainer.appendChild(editButton);
    }
    buttonContainer.appendChild(completedAlreadyButton);
    buttonContainer.appendChild(completeButton);

    // Assemble modal content
    modalContent.appendChild(header);
    modalContent.appendChild(detailsGrid);
    modalContent.appendChild(notesSection);
    modalContent.appendChild(pastCompletionSection);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);

    const closeModal = () => {
      if (modal.parentNode) {
        modal.style.opacity = '0';
        setTimeout(() => {
          if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
          }
        }, 200);
      }
    };

    // Event handlers
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Save button handler
    if (saveButton && onSave) {
      saveButton.addEventListener('click', async () => {
        const updates = {};

        // Collect duration changes
        if (durationControl.value && parseInt(durationControl.value) !== taskDuration) {
          updates.duration_minutes = parseInt(durationControl.value);
        }

        // Collect priority changes
        if (priorityControl.value && parseInt(priorityControl.value) !== taskPriority) {
          updates.priority = parseInt(priorityControl.value);
        }

        // Collect due date changes (if applicable)
        if (isRecurringTask && dueDateControl.value) {
          const newDueDate = new Date(dueDateControl.value).toISOString();
          if (newDueDate !== dueDate) {
            updates.next_due = newDueDate;
          }
        }

        // Collect assignment changes (if applicable)
        const assignmentSelect = assignmentField?.querySelector('select');
        if (assignmentSelect && assignmentSelect.value !== assignedTo) {
          updates.assigned_to = assignmentSelect.value;
        }

        // Advanced fields
        if (energyInput && parseInt(energyInput.value) !== (task.energy_cost ?? 2)) {
          updates.energy_cost = parseInt(energyInput.value);
        }
        if (focusInput && parseInt(focusInput.value) !== (task.focus_cost ?? 2)) {
          updates.focus_cost = parseInt(focusInput.value);
        }
        if (painInput && parseInt(painInput.value) !== (task.pain_cost ?? 0)) {
          updates.pain_cost = parseInt(painInput.value);
        }
        if (motivationInput && parseInt(motivationInput.value) !== (task.motivation_boost ?? 0)) {
          updates.motivation_boost = parseInt(motivationInput.value);
        }
        if (severitySelect && parseInt(severitySelect.value) !== (task.overdue_severity ?? 2)) {
          updates.overdue_severity = parseInt(severitySelect.value);
        }

        if (Object.keys(updates).length > 0) {
          try {
            await onSave(updates);
            closeModal();
          } catch (error) {
            console.error('Failed to save task:', error);
            // Error handling is done in the onSave callback
          }
        } else {
          closeModal();
        }
      });
    }

    // Edit button handler
    if (editButton && onEdit) {
      editButton.addEventListener('click', () => {
        closeModal(); // Close the detail modal first
        onEdit(task); // Open the comprehensive edit modal
      });
    }

    // Complete button handler
    completeButton.addEventListener('click', async () => {
      const notes = completionNotesTextarea.value.trim();
      try {
        await onComplete(notes);
        closeModal();
      } catch (error) {
        console.error('Failed to complete task:', error);
        // Error handling is done in the onComplete callback
      }
    });

    // Completed Already button handler
    completedAlreadyButton.addEventListener('click', () => {
      pastCompletionSection.style.display = 'block';
      buttonContainer.style.display = 'none';
    });

    // Yesterday button handler
    yesterdayButton.addEventListener('click', async () => {
      const notes = completionNotesTextarea.value.trim();
      const yesterday = new Date();
      yesterday.setDate(yesterday.getDate() - 1);
      try {
        await onComplete(notes, yesterday.toISOString());
        closeModal();
      } catch (error) {
        console.error('Failed to complete task:', error);
        // Error handling is done in the onComplete callback
      }
    });

    // Choose Date/Time button handler
    customDateButton.addEventListener('click', () => {
      customDateContainer.style.display = 'block';
      quickOptionsContainer.style.display = 'none';
    });

    // Cancel past completion button handler
    cancelPastButton.addEventListener('click', () => {
      pastCompletionSection.style.display = 'none';
      buttonContainer.style.display = 'flex';
      // Reset to quick options view
      customDateContainer.style.display = 'none';
      quickOptionsContainer.style.display = 'flex';
    });

    // Confirm past completion button handler
    confirmPastButton.addEventListener('click', async () => {
      const notes = completionNotesTextarea.value.trim();
      const completedAtValue = customDateInput.value;

      if (!completedAtValue) {
        TaskTrackerUtils.showError('Please select a completion date and time');
        return;
      }

      // Convert datetime-local value to ISO string
      const completedAt = new Date(completedAtValue).toISOString();

      try {
        await onComplete(notes, completedAt);
        closeModal();
      } catch (error) {
        console.error('Failed to complete task:', error);
        // Error handling is done in the onComplete callback
      }
    });

    // Apply fade-in animation
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.transition = 'opacity 0.2s ease';
      modal.style.opacity = '1';
      // Focus the complete button for keyboard navigation
      completeButton.focus();
    }, 10);

    return modal;
  }

  static createCompletionEditModal(completion, config, onDelete, onUpdate, availableUsers = [], enhancedUsers = null) {
    const modal = document.createElement('div');
    modal.className = 'completion-edit-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: var(--card-background-color);
      border-radius: 8px;
      padding: 24px;
      width: 90%;
      max-width: 450px;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font-family: var(--primary-font-family);
    `;

    const taskName = completion.task_name || completion.name;
    const completedBy = completion.completed_by;
    const completedAt = completion.completed_at;
    const notes = completion.notes || '';

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: flex-start;
      margin-bottom: 20px;
    `;

    const title = document.createElement('h3');
    title.textContent = `Edit Completion`;
    title.style.cssText = `
      margin: 0;
      color: var(--primary-text-color);
      font-size: 1.3em;
      font-weight: 500;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--secondary-text-color);
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    header.appendChild(title);
    header.appendChild(closeButton);

    // Task name display
    const taskNameField = document.createElement('div');
    taskNameField.style.cssText = 'margin-bottom: 16px;';
    const taskNameLabel = document.createElement('label');
    taskNameLabel.textContent = 'Task Name';
    taskNameLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;
    const taskNameValue = document.createElement('div');
    taskNameValue.textContent = taskName;
    taskNameValue.style.cssText = `
      padding: 8px;
      background: var(--secondary-background-color);
      border-radius: 4px;
      color: var(--primary-text-color);
      font-size: 14px;
    `;
    taskNameField.appendChild(taskNameLabel);
    taskNameField.appendChild(taskNameValue);

    // Completed by field (editable if users are available)
    const completedByField = document.createElement('div');
    completedByField.style.cssText = 'margin-bottom: 16px;';
    const completedByLabel = document.createElement('label');
    completedByLabel.textContent = 'Completed By';
    completedByLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;

    let completedByControl;
    if (availableUsers && availableUsers.length > 0) {
      completedByControl = document.createElement('select');
      completedByControl.style.cssText = `
        width: 100%;
        padding: 8px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-size: 14px;
      `;

      availableUsers.forEach(username => {
        const optionElement = document.createElement('option');
        optionElement.value = username;
        optionElement.textContent = TaskTrackerUtils.getUserDisplayName(username, enhancedUsers);
        optionElement.selected = username === completedBy;
        completedByControl.appendChild(optionElement);
      });
    } else {
      completedByControl = document.createElement('div');
      completedByControl.textContent = TaskTrackerUtils.getUserDisplayName(completedBy, enhancedUsers);
      completedByControl.style.cssText = `
        padding: 8px;
        background: var(--secondary-background-color);
        border-radius: 4px;
        color: var(--primary-text-color);
        font-size: 14px;
      `;
    }

    completedByField.appendChild(completedByLabel);
    completedByField.appendChild(completedByControl);

    // Completion date display
    const completedAtField = document.createElement('div');
    completedAtField.style.cssText = 'margin-bottom: 16px;';
    const completedAtLabel = document.createElement('label');
    completedAtLabel.textContent = 'Completed At';
    completedAtLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;
    const completedAtValue = document.createElement('div');
    completedAtValue.textContent = TaskTrackerUtils.formatDateTime(completedAt);
    completedAtValue.style.cssText = `
      padding: 8px;
      background: var(--secondary-background-color);
      border-radius: 4px;
      color: var(--primary-text-color);
      font-size: 14px;
    `;
    completedAtField.appendChild(completedAtLabel);
    completedAtField.appendChild(completedAtValue);

    // Notes field (editable)
    const notesField = document.createElement('div');
    notesField.style.cssText = 'margin-bottom: 20px;';
    const notesLabel = document.createElement('label');
    notesLabel.textContent = 'Notes';
    notesLabel.style.cssText = `
      display: block;
      margin-bottom: 4px;
      font-size: 0.85em;
      color: var(--secondary-text-color);
      font-weight: 500;
    `;
    const notesTextarea = document.createElement('textarea');
    notesTextarea.value = notes;
    notesTextarea.placeholder = 'Add notes about this completion...';
    notesTextarea.style.cssText = `
      width: 100%;
      min-height: 80px;
      padding: 8px;
      border: 1px solid var(--divider-color);
      border-radius: 4px;
      background: var(--card-background-color);
      color: var(--primary-text-color);
      font-size: 14px;
      font-family: inherit;
      resize: vertical;
      box-sizing: border-box;
    `;
    notesField.appendChild(notesLabel);
    notesField.appendChild(notesTextarea);

    // Buttons
    const buttonContainer = document.createElement('div');
    buttonContainer.style.cssText = `
      display: flex;
      gap: 8px;
      justify-content: space-between;
      margin-top: 24px;
    `;

    const undoButton = TaskTrackerUtils.createStyledButton('Undo Completion', 'error');

    const rightButtons = document.createElement('div');
    rightButtons.style.cssText = 'display: flex; gap: 8px;';

    const cancelButton = TaskTrackerUtils.createStyledButton('Cancel');
    const updateButton = TaskTrackerUtils.createStyledButton('Update');

    rightButtons.appendChild(cancelButton);
    rightButtons.appendChild(updateButton);
    buttonContainer.appendChild(undoButton);
    buttonContainer.appendChild(rightButtons);

    // Assemble modal content
    modalContent.appendChild(header);
    modalContent.appendChild(taskNameField);
    modalContent.appendChild(completedByField);
    modalContent.appendChild(completedAtField);
    modalContent.appendChild(notesField);
    modalContent.appendChild(buttonContainer);

    modal.appendChild(modalContent);

    const closeModal = () => {
      if (modal.parentNode) {
        modal.style.opacity = '0';
        setTimeout(() => {
          if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
          }
        }, 200);
      }
    };

    // Event handlers
    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Undo button handler
    undoButton.addEventListener('click', async () => {
      try {
        await onDelete();
        closeModal();
      } catch (error) {
        console.error('Failed to delete completion:', error);
        // Error handling is done in the onDelete callback
      }
    });

    // Update button handler
    updateButton.addEventListener('click', async () => {
      const updates = {};

      // Check for completed_by changes
      if (availableUsers && availableUsers.length > 0 && completedByControl.value !== completedBy) {
        updates.completed_by = completedByControl.value;
      }

      // Check for notes changes
      if (notesTextarea.value !== notes) {
        updates.notes = notesTextarea.value;
      }

      if (Object.keys(updates).length > 0) {
        try {
          await onUpdate(updates);
          closeModal();
        } catch (error) {
          console.error('Failed to update completion:', error);
          // Error handling is done in the onUpdate callback
        }
      } else {
        closeModal();
      }
    });

    // Apply fade-in animation
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.transition = 'opacity 0.2s ease';
      modal.style.opacity = '1';
    }, 10);

    return modal;
  }

  static showModal(modal) {
    document.body.appendChild(modal);
    requestAnimationFrame(() => {
      modal.style.opacity = '1';
    });
  }

  // Configuration utilities
  static createConfigRow(label, description, inputHtml) {
    return `
      <div class="config-row">
        <label>
          ${label}
          ${description ? `<div class="config-description">${description}</div>` : ''}
        </label>
        ${inputHtml}
      </div>
    `;
  }

  static createNumberInput(value, configKey, min = null, max = null, step = null) {
    // Handle null/undefined values by using empty string or default
    const displayValue = (value === null || value === undefined) ? '' : value;

    const attrs = [
      `value="${displayValue}"`,
      `data-config-key="${configKey}"`,
      min !== null ? `min="${min}"` : '',
      max !== null ? `max="${max}"` : '',
      step !== null ? `step="${step}"` : ''
    ].filter(Boolean).join(' ');

    return `<input type="number" ${attrs} />`;
  }

  static createTextInput(value, configKey, placeholder = '') {
    return `
      <input
        type="text"
        value="${value || ''}"
        data-config-key="${configKey}"
        placeholder="${placeholder}"
      />
    `;
  }

  static createCheckboxInput(checked, configKey) {
    return `
      <input
        type="checkbox"
        ${checked ? 'checked' : ''}
        data-config-key="${configKey}"
      />
    `;
  }

  static createSelectInput(value, configKey, options) {
    const optionsHtml = options.map(option => {
      const optionValue = typeof option === 'string' ? option : option.value;
      const optionLabel = typeof option === 'string' ? option : option.label;
      const selected = value === optionValue ? 'selected' : '';
      return `<option value="${optionValue}" ${selected}>${optionLabel}</option>`;
    }).join('');

    return `<select data-config-key="${configKey}">${optionsHtml}</select>`;
  }

  static capitalize(string) {
    if (!string) return string;
    return string.charAt(0).toUpperCase() + string.slice(1);
  }

  // Common styles for cards
  static getCommonCardStyles() {
    return `
      :host {
        display: block;
      }

      .card {
        padding: 16px;
        font-family: var(--primary-font-family);
        background: var(--ha-card-background, var(--card-background-color, #fff));
        border-radius: var(--ha-card-border-radius, 12px);
        border: 1px solid var(--divider-color);
      }

      .header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
        padding-bottom: 8px;
        border-bottom: 1px solid var(--divider-color);
        position: relative;
      }

      .title {
        font-size: 1.1em;
        font-weight: 500;
        color: var(--primary-text-color);
        margin: 0;
      }

      .refresh-btn {
        background: none;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        padding: 2px;
        cursor: pointer;
        color: var(--secondary-text-color);
      }

      .refresh-btn:hover {
        background: var(--secondary-background-color);
      }

      .loading, .error, .no-tasks {
        text-align: center;
        padding: 24px 0;
        color: var(--secondary-text-color);
        font-size: 0.9em;
      }

      .error {
        color: var(--error-color);
        text-align: center;
        font-style: italic;
        padding: 16px;
      }

      .no-tasks {
        color: var(--secondary-text-color);
      }

      .no-user-warning {
        color: var(--primary-text-color);
        background: var(--secondary-background-color);
        padding: 12px;
        border-radius: 4px;
        border: 1px solid var(--divider-color);
        text-align: center;
        margin-bottom: 16px;
      }

      .refreshing-indicator {
        position: absolute;
        top: 0;
        right: 0;
        width: 2px;
        height: 100%;
        background: var(--primary-color);
        opacity: 0.6;
        animation: pulse 1s infinite;
      }

      .task-item {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 8px 12px;
          margin-bottom: 4px;
          background: var(--secondary-background-color);
          border-radius: 4px;
          border-left: 2px solid var(--secondary-text-color);
          cursor: pointer;
        }

        .task-item.needs-completion {
          border-left: 2px solid var(--primary-color);
        }

        .task-item.completed {
          border-left: 2px solid var(--success-color);
        }

        .task-item:hover {
          background: var(--divider-color);
        }

        .task-item:last-child {
          margin-bottom: 0;
        }

        .task-content {
          flex: 1;
          min-width: 0;
        }

        .task-name {
          font-weight: 500;
          color: var(--primary-text-color);
          font-size: 0.95em;
          margin-bottom: 2px;
          word-wrap: break-word;
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .completion-indicator {
          width: 6px;
          height: 6px;
          background: var(--primary-color);
          border-radius: 50%;
          flex-shrink: 0;
        }

        .task-metadata {
          font-size: 0.8em;
          color: var(--secondary-text-color);
        }

      @keyframes pulse {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 0.8; }
      }

      .complete-btn,
      .dispose-btn {
        background: transparent;
        border: none;
        color: var(--secondary-text-color);
        padding: 4px 8px;
        border-radius: 4px;
        cursor: pointer;
        font-size: 0.8em;
        transition: background-color 0.2s ease;
      }

      .complete-btn:hover,
      .dispose-btn:hover {
        background: var(--divider-color);
        color: var(--primary-text-color);
      }

      .complete-btn:active,
      .dispose-btn:active {
        transform: scale(0.95);
      }

      .category {
        margin-bottom: 16px;
      }

      .category-title {
        font-size: 1.1em;
        margin-bottom: 8px;
      }
    `;
  }

  // Common styles for config editors
  static getCommonConfigStyles() {
    return `
      .card-config {
        display: flex;
        flex-direction: column;
        gap: 16px;
        padding: 16px;
      }

      .config-row {
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 16px;
      }

      .config-row label {
        flex: 1;
        font-weight: 500;
        color: var(--primary-text-color);
      }

      .config-row input, .config-row select {
        flex: 0 0 auto;
        min-width: 120px;
        padding: 8px 12px;
        border: 1px solid var(--divider-color);
        border-radius: 4px;
        background: var(--card-background-color);
        color: var(--primary-text-color);
        font-family: inherit;
      }

      .config-row input[type="checkbox"] {
        min-width: auto;
        width: 20px;
        height: 20px;
      }

      .config-row input[type="number"] {
        width: 80px;
      }

      .config-description {
        font-size: 0.85em;
        color: var(--secondary-text-color);
        margin-top: 4px;
        font-style: italic;
      }

      .section-title {
        font-size: 1.1em;
        font-weight: 600;
        color: var(--primary-text-color);
        margin-top: 16px;
        margin-bottom: 8px;
        padding-bottom: 4px;
        border-bottom: 1px solid var(--divider-color);
      }

      .section-title:first-child {
        margin-top: 0;
      }
    `;
  }

  // Auto-refresh setup utility
  static setupAutoRefresh(refreshCallback, intervalSeconds) {
    // Validate interval before setting up the timer
    const intervalMs = intervalSeconds * 1000;
    if (isNaN(intervalMs) || intervalMs <= 0) {
      console.warn('Invalid refresh interval, skipping auto-refresh setup');
      return null;
    }

    return setInterval(refreshCallback, intervalMs);
  }

  // Array equality check utility
  static arraysEqual(arr1, arr2, compareFunction) {
    if (arr1.length !== arr2.length) return false;

    for (let i = 0; i < arr1.length; i++) {
      if (!compareFunction(arr1[i], arr2[i])) {
        return false;
      }
    }

    return true;
  }

  /**
   * Calculate days overdue for a task
   * @deprecated Use TaskTrackerDateTime.calculateDaysOverdue() instead
   * @param {string} dueDateString - ISO date string of when task is due
   * @param {Object} userContext - User context with timezone information (optional)
   * @returns {number} - Number of days overdue (0 if not overdue)
   */
  static calculateDaysOverdue(dueDateString, userContext = null) {
    if (!dueDateString) {
      return 0;
    }

    try {
      // Use logical day calculation when user context is available
      if (userContext) {
        return TaskTrackerUtils.calculateLogicalDaysOverdue(dueDateString, userContext);
      }

      // Fallback to original calendar day calculation
      const dueDate = new Date(dueDateString);
      const now = new Date();

      // Use calendar day difference instead of 24-hour periods
      // This accounts for timezone boundaries properly
      const dueDateLocal = new Date(dueDate.getFullYear(), dueDate.getMonth(), dueDate.getDate());
      const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
      const diffDays = Math.floor((nowLocal - dueDateLocal) / (1000 * 60 * 60 * 24));

      return Math.max(0, diffDays);
    } catch {
      return 0;
    }
  }

  // Calculate overdue color based on days overdue and severity
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

  // Common config value change handler for card editors
  static handleConfigValueChange(ev, editorInstance, updateConfigCallback, optionalFields = ['explicit_user', 'user', 'default_user']) {
    if (!editorInstance._config || !editorInstance._hass) {
      return;
    }

    const target = ev.target;
    const configKey = target.dataset.configKey;

    if (!configKey) {
      return;
    }

    let value;
    if (target.type === 'checkbox') {
      value = target.checked;
    } else if (target.type === 'number') {
      // Use parseFloat to handle both integers and decimals
      const parsedValue = parseFloat(target.value);
      // Handle empty values or invalid numbers by using null to trigger default fallback
      value = isNaN(parsedValue) ? null : parsedValue;
    } else {
      value = target.value || null;
    }

    // Handle empty string for optional fields
    if (optionalFields.includes(configKey) && value === '') {
      value = null;
    }

    // For text and number inputs, debounce the config update to avoid frequent API calls and focus loss
    if (target.type === 'text' || target.type === 'number') {
      // Initialize debounce timers if not exists
      if (!editorInstance._debounceTimers) {
        editorInstance._debounceTimers = {};
      }

      // Clear any existing timer for this field
      if (editorInstance._debounceTimers[configKey]) {
        clearTimeout(editorInstance._debounceTimers[configKey]);
      }

      // Set a new timer to update config after user stops typing
      editorInstance._debounceTimers[configKey] = setTimeout(() => {
        updateConfigCallback(configKey, value);
        delete editorInstance._debounceTimers[configKey];
      }, 500); // Wait 500ms after user stops typing
    } else {
      // For non-debounced inputs (checkboxes, selects), update immediately
      updateConfigCallback(configKey, value);
    }
  }

  // Daily State Management Utilities
  static getDefaultDailyState() {
    return {
      energy: 3,
      motivation: 3,
      focus: 3,
      pain: 1,
      mood: 0,
      free_time: 3
    };
  }

  static getPresetDailyStates() {
    return {
      'great': {
        label: 'Great',
        values: { energy: 5, motivation: 4, focus: 4, pain: 1, mood: 2, free_time: 4 }
      },
      'motivated': {
        label: 'Motivated',
        values: { energy: 4, motivation: 5, focus: 3, pain: 1, mood: 1, free_time: 3 }
      },
      'normal': {
        label: 'Normal',
        values: { energy: 3, motivation: 3, focus: 3, pain: 1, mood: 0, free_time: 3 }
      },
      'tired': {
        label: 'Tired',
        values: { energy: 2, motivation: 2, focus: 2, pain: 1, mood: -1, free_time: 3 }
      },
      'stressed': {
        label: 'Stressed',
        values: { energy: 3, motivation: 2, focus: 1, pain: 2, mood: -1, free_time: 1 }
      },
      'in_pain': {
        label: 'In Pain',
        values: { energy: 2, motivation: 2, focus: 2, pain: 5, mood: -1, free_time: 2 }
      },
      'lazy': {
        label: 'Lazy',
        values: { energy: 3, motivation: 1, focus: 2, pain: 1, mood: 0, free_time: 4 }
      },
      'complicated': {
        label: 'Complicated',
        values: null // Special case - switches to advanced mode
      }
    };
  }

  static findMatchingDailyStatePreset(state) {
    if (!state) return null;

    const presets = TaskTrackerUtils.getPresetDailyStates();
    for (const [key, preset] of Object.entries(presets)) {
      if (key === 'complicated' || !preset.values) continue;

      // Check if all values match exactly
      const matches = Object.keys(preset.values).every(axis =>
        state[axis] === preset.values[axis]
      );

      if (matches) {
        return key;
      }
    }

    return 'complicated'; // No exact match found
  }

  static async fetchDailyState(hass, username) {
    if (!username) return null;

    try {
      const resp = await hass.callService('tasktracker', 'get_daily_state', { username }, {}, true, true);
      if (resp && resp.response && resp.response.data) {
        return resp.response.data;
      }
    } catch (e) {
      console.warn('Failed to fetch daily state:', e);
    }

    return null;
  }

  static async saveDailyState(hass, username, stateValues) {
    if (!username) return false;

    try {
      // Filter out the date field since we're always editing the current day's state
      const { date, ...filteredStateValues } = stateValues;
      const payload = { username, ...filteredStateValues };
      await hass.callService('tasktracker', 'set_daily_state', payload, {}, true, true);
      return true;
    } catch (e) {
      console.warn('Failed to set daily state:', e);
      TaskTrackerUtils.showError('Failed to save daily state');
      return false;
    }
  }

  static getMoodLabel(value, useEmoji = true) {
    if (!useEmoji) {
      return value.toString();
    }
    const labels = { '-2': '☹️', '-1': '🙁', '0': '😐', '1': '🙂', '2': '😊' };
    return labels[value.toString()] || value.toString();
  }

  static getFreeTimeLabel(value) {
    const labels = { '1': 'Slammed', '2': 'Busy', '3': 'Moderate', '4': 'Available', '5': 'Wide-open' };
    return labels[value.toString()] || value.toString();
  }

  static createDailyStateModal(hass, username, config = {}, onSave = null) {
    const modal = document.createElement('div');
    modal.className = 'daily-state-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0; left: 0;
      width: 100%; height: 100%;
      background: rgba(0, 0, 0, 0.5);
      z-index: 10000;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    const modalContent = document.createElement('div');
    modalContent.style.cssText = `
      background: var(--card-background-color);
      border-radius: 8px;
      padding: 24px;
      width: 90%;
      max-width: 600px;
      max-height: 90%;
      overflow-y: auto;
      box-shadow: 0 8px 32px rgba(0, 0, 0, 0.3);
      font-family: var(--primary-font-family);
    `;

    // State management
    let currentState = TaskTrackerUtils.getDefaultDailyState();
    let showAdvanced = false;
    let loading = true;
    let saving = false;

    // Header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
    `;

    const title = document.createElement('h3');
    title.textContent = 'Set Your Daily State';
    title.style.cssText = `
      margin: 0;
      color: var(--primary-text-color);
      font-size: 1.5em;
      font-weight: 500;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 24px;
      cursor: pointer;
      color: var(--secondary-text-color);
      padding: 0;
      width: 24px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    header.appendChild(title);
    header.appendChild(closeButton);

    // Content container
    const contentContainer = document.createElement('div');
    contentContainer.style.cssText = 'min-height: 300px;';

    modalContent.appendChild(header);
    modalContent.appendChild(contentContainer);
    modal.appendChild(modalContent);

    const closeModal = () => {
      if (modal.parentNode) {
        modal.style.opacity = '0';
        setTimeout(() => {
          if (modal.parentNode) {
            modal.parentNode.removeChild(modal);
          }
        }, 200);
      }
    };

    const showToast = (message, type = 'success') => {
      const toast = document.createElement('div');
      toast.textContent = message;
      toast.style.cssText = `
        position: fixed;
        top: 20px;
        right: 20px;
        background: ${type === 'success' ? 'var(--success-color, #4caf50)' : 'var(--error-color, #f44336)'};
        color: white;
        padding: 12px 20px;
        border-radius: 4px;
        z-index: 10001;
        box-shadow: 0 2px 8px rgba(0,0,0,0.2);
        transform: translateX(100%);
        transition: transform 0.3s ease;
      `;

      document.body.appendChild(toast);

      requestAnimationFrame(() => {
        toast.style.transform = 'translateX(0)';
      });

      setTimeout(() => {
        toast.style.transform = 'translateX(100%)';
        setTimeout(() => {
          if (toast.parentNode) {
            toast.parentNode.removeChild(toast);
          }
        }, 300);
      }, 2000);
    };

    const renderContent = () => {
      if (loading) {
        contentContainer.innerHTML = '<div style="text-align: center; padding: 40px; color: var(--secondary-text-color);">Loading...</div>';
        return;
      }

      const useEmoji = config.use_emoji_labels !== false;
      const currentPreset = TaskTrackerUtils.findMatchingDailyStatePreset(currentState);

      contentContainer.innerHTML = `
        <style>
          .quick-flow {
            margin-bottom: 16px;
          }
          .quick-prompt {
            font-size: 16px;
            margin-bottom: 16px;
            color: var(--primary-text-color);
            text-align: center;
          }
          .preset-grid {
            display: grid;
            grid-template-columns: repeat(2, 1fr);
            gap: 8px;
            margin-bottom: 16px;
          }
          .preset-btn {
            background: var(--card-background-color);
            border: 2px solid var(--divider-color);
            border-radius: 8px;
            padding: 16px 12px;
            cursor: pointer;
            font-size: 14px;
            font-weight: 500;
            color: var(--primary-text-color);
            transition: all 0.2s ease;
            text-align: center;
            min-height: 60px;
            display: flex;
            align-items: center;
            justify-content: center;
          }
          .preset-btn:hover {
            border-color: var(--primary-color);
            background: var(--primary-color);
            color: var(--primary-text-color);
          }
          .preset-btn.selected {
            border-color: var(--primary-color);
            background: var(--primary-color);
            color: var(--primary-text-color);
          }
          .preset-btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          @media (min-width: 500px) {
            .preset-grid {
              grid-template-columns: repeat(4, 1fr);
            }
          }
          .advanced-section {
            margin-top: 16px;
            border-top: 1px solid var(--divider-color);
            padding-top: 16px;
          }
          .slider-row {
            display: grid;
            grid-template-columns: 100px 1fr 60px;
            align-items: center;
            gap: 12px;
            margin-bottom: 12px;
          }
          .slider-label {
            font-weight: 500;
            color: var(--primary-text-color);
          }
          .slider-container {
            position: relative;
          }
          input[type="range"] {
            width: 100%;
            height: 6px;
            border-radius: 3px;
            background: var(--disabled-text-color);
            outline: none;
            -webkit-appearance: none;
          }
          input[type="range"]::-webkit-slider-thumb {
            -webkit-appearance: none;
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: var(--primary-color);
            cursor: pointer;
          }
          input[type="range"]::-moz-range-thumb {
            width: 18px;
            height: 18px;
            border-radius: 50%;
            background: var(--primary-color);
            cursor: pointer;
            border: none;
          }
          .slider-value {
            text-align: center;
            font-weight: 500;
            min-width: 80px;
            color: var(--primary-text-color);
          }
          .button-row {
            display: flex;
            justify-content: space-between;
            align-items: center;
            margin-top: 20px;
          }
          .btn {
            background: var(--primary-color);
            color: var(--primary-text-color);
            border: none;
            border-radius: 4px;
            padding: 8px 16px;
            cursor: pointer;
            font-size: 14px;
            display: flex;
            align-items: center;
            gap: 4px;
            transition: opacity 0.2s;
          }
          .btn:hover {
            opacity: 0.9;
          }
          .btn:disabled {
            opacity: 0.6;
            cursor: not-allowed;
          }
          .btn-secondary {
            background: var(--secondary-background-color);
            color: var(--primary-text-color);
            border: 1px solid var(--divider-color);
          }
          .back-to-simple {
            background: none;
            border: none;
            color: var(--secondary-text-color);
            cursor: pointer;
            font-size: 12px;
            padding: 4px 8px;
            border-radius: 4px;
            transition: all 0.2s ease;
            margin-bottom: 12px;
          }
          .back-to-simple:hover {
            background: var(--secondary-background-color);
            color: var(--primary-text-color);
          }
        </style>

        ${!showAdvanced ? `
          <div class="quick-flow">
            <div class="quick-prompt">How are you feeling today?</div>
            <div class="preset-grid">
              ${Object.keys(TaskTrackerUtils.getPresetDailyStates()).map(key => {
                const preset = TaskTrackerUtils.getPresetDailyStates()[key];
                const isSelected = currentPreset === key;
                return `
                  <button class="preset-btn ${isSelected ? 'selected' : ''}"
                          data-preset="${key}"
                          ${saving ? 'disabled' : ''}>
                    ${preset.label}
                  </button>
                `;
              }).join('')}
            </div>
          </div>
        ` : ''}

        ${showAdvanced ? `
          <div class="advanced-section">
            <button class="back-to-simple">← Back to Simple</button>
            ${TaskTrackerUtils.createSliderRow('energy', 'Energy', currentState.energy, 1, 5, 'Higher energy enables more demanding tasks')}
            ${TaskTrackerUtils.createSliderRow('motivation', 'Motivation', currentState.motivation, 1, 5, 'Higher motivation suggests more challenging tasks')}
            ${TaskTrackerUtils.createSliderRow('focus', 'Focus', currentState.focus, 1, 5, 'Higher focus enables detail-oriented work')}
            ${TaskTrackerUtils.createSliderRow('pain', 'Pain', currentState.pain, 1, 5, 'Higher pain reduces strenuous task suggestions')}
            ${TaskTrackerUtils.createSliderRow('mood', 'Mood', currentState.mood, -2, 2, 'Mood affects task type and difficulty recommendations', true, useEmoji)}
            ${TaskTrackerUtils.createSliderRow('free_time', 'Free Time', currentState.free_time, 1, 5, 'More free time allows longer task suggestions', false, false, true)}
          </div>
        ` : ''}

        <div class="button-row">
          <div></div>
          <div style="display: flex; gap: 8px;">
            <button class="btn btn-secondary">Cancel</button>
            <button class="btn save-btn" ${saving ? 'disabled' : ''}>
              ${saving ? 'Saving...' : 'Save'}
            </button>
          </div>
        </div>
      `;

      // Add event listeners
      const presetButtons = contentContainer.querySelectorAll('.preset-btn');
      presetButtons.forEach(btn => {
        btn.addEventListener('click', async () => {
          const presetKey = btn.dataset.preset;
          const presets = TaskTrackerUtils.getPresetDailyStates();
          const preset = presets[presetKey];

          if (presetKey === 'complicated') {
            showAdvanced = true;
            renderContent();
            return;
          }

          if (preset && preset.values) {
            saving = true;
            renderContent();

            const success = await TaskTrackerUtils.saveDailyState(hass, username, preset.values);
            if (success) {
              showToast('Daily state saved successfully!');
              if (onSave) onSave(preset.values);
              closeModal();
            } else {
              saving = false;
              renderContent();
            }
          }
        });
      });

      const sliders = contentContainer.querySelectorAll('input[type="range"]');
      sliders.forEach(slider => {
        slider.addEventListener('input', (e) => {
          const axis = e.target.dataset.axis;
          const val = parseInt(e.target.value);
          currentState[axis] = val;

          // Update display value
          const valueDisplay = e.target.parentElement.parentElement.querySelector('.slider-value');
          if (axis === 'mood') {
            valueDisplay.textContent = TaskTrackerUtils.getMoodLabel(val, useEmoji);
          } else if (axis === 'free_time') {
            valueDisplay.textContent = TaskTrackerUtils.getFreeTimeLabel(val);
          } else {
            valueDisplay.textContent = val;
          }
        });
      });

      const backToSimpleBtn = contentContainer.querySelector('.back-to-simple');
      if (backToSimpleBtn) {
        backToSimpleBtn.addEventListener('click', () => {
          showAdvanced = false;
          renderContent();
        });
      }

      const cancelBtn = contentContainer.querySelector('.btn-secondary');
      if (cancelBtn) {
        cancelBtn.addEventListener('click', closeModal);
      }

      const saveBtn = contentContainer.querySelector('.save-btn');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          saving = true;
          renderContent();

          const success = await TaskTrackerUtils.saveDailyState(hass, username, currentState);
          if (success) {
            showToast('Daily state saved successfully!');
            if (onSave) onSave(currentState);
            closeModal();
          } else {
            saving = false;
            renderContent();
          }
        });
      }
    };

    // Load existing state
    const loadState = async () => {
      loading = true;
      renderContent();

      const existingState = await TaskTrackerUtils.fetchDailyState(hass, username);
      if (existingState) {
        currentState = existingState;
        const matchingPreset = TaskTrackerUtils.findMatchingDailyStatePreset(currentState);
        showAdvanced = matchingPreset === 'complicated';
      }

      loading = false;
      renderContent();
    };

    // Event handlers
    closeButton.addEventListener('click', closeModal);

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    // Escape key handler
    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
        document.removeEventListener('keydown', escapeHandler);
      }
    };
    document.addEventListener('keydown', escapeHandler);

    // Initialize
    loadState();

    // Apply fade-in animation
    modal.style.opacity = '0';
    setTimeout(() => {
      modal.style.transition = 'opacity 0.2s ease';
      modal.style.opacity = '1';
    }, 10);

    return modal;
  }

  static createSliderRow(key, label, value, min, max, tooltip, isMood = false, useEmoji = true, isFreeTime = false) {
    let displayValue = value;
    if (isMood) {
      displayValue = TaskTrackerUtils.getMoodLabel(value, useEmoji);
    } else if (isFreeTime) {
      displayValue = TaskTrackerUtils.getFreeTimeLabel(value);
    }

    return `
      <div class="slider-row">
        <div class="slider-label">${label}</div>
        <div class="slider-container">
          <input type="range" min="${min}" max="${max}" step="1" value="${value}" data-axis="${key}">
          <div class="tooltip" style="
            position: absolute;
            bottom: 100%;
            left: 50%;
            transform: translateX(-50%);
            background: var(--card-background-color);
            border: 1px solid var(--divider-color);
            border-radius: 4px;
            padding: 8px;
            font-size: 12px;
            white-space: nowrap;
            opacity: 0;
            pointer-events: none;
            transition: opacity 0.2s;
            z-index: 100;
            box-shadow: 0 2px 8px rgba(0,0,0,0.1);
          ">${tooltip}</div>
        </div>
        <div class="slider-value">${displayValue}</div>
      </div>
    `;
  }

  // ===========================================
  // Testing and Debugging Utilities
  // ===========================================
  //
  // Note: Previous datetime testing utilities have been removed.
  // Use TaskTrackerDateTime.debugWindowTiming() for datetime debugging.
  //
}