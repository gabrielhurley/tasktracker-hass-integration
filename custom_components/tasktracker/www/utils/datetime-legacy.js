// Deprecated legacy datetime helpers. Prefer TaskTrackerDateTime utilities.

/**
 * Convert a Date object to the user's timezone using user context
 * @deprecated Use TaskTrackerDateTime utilities instead
 * @param {Date} date - The date to convert
 * @param {Object} userContext - User context with timezone information
 * @returns {Date} - Date in user's timezone (approximation)
 */
export function dateToUserTimezone(date, userContext) {
  if (!userContext || !userContext.timezone) {
    return date; // Fallback to original date
  }

  try {
    // Use Intl.DateTimeFormat to get the offset for the user's timezone
    const userDate = new Date(date.toLocaleString('en-US', { timeZone: userContext.timezone }));
    const localDate = new Date(date.toLocaleString('en-US'));
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
export function getUserLogicalDate(userContext, now = null) {
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
  const userTime = dateToUserTimezone(currentTime, userContext);

  // Parse reset time (format: "HH:MM:SS")
  const resetTimeParts = (userContext.daily_reset_time || '05:00:00').split(':');
  const resetHour = parseInt(resetTimeParts[0]);
  const resetMinute = parseInt(resetTimeParts[1]);

  // If current time is before reset time, we're still in previous logical day
  if (
    userTime.getHours() < resetHour ||
    (userTime.getHours() === resetHour && userTime.getMinutes() < resetMinute)
  ) {
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
export function calculateLogicalDaysOverdue(dueDateString, userContext, now = null) {
  if (!dueDateString || !userContext) {
    return 0;
  }

  try {
    const dueDate = new Date(dueDateString);
    const currentLogicalDate = getUserLogicalDate(userContext, now);
    const dueDateInUserTz = dateToUserTimezone(dueDate, userContext);
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
export function isWithinCurrentLogicalDay(dateInput, userContext) {
  if (!dateInput || !userContext) {
    return false;
  }

  try {
    const date = typeof dateInput === 'string' ? new Date(dateInput) : dateInput;
    const dateInUserTz = dateToUserTimezone(date, userContext);
    const dateLogical = dateInUserTz.toISOString().split('T')[0];
    const currentLogical = getUserLogicalDate(userContext);

    return dateLogical === currentLogical;
  } catch (error) {
    console.warn('Error checking logical day:', error);
    return false;
  }
}

/**
 * Calculate days overdue for a task
 * @deprecated Use TaskTrackerDateTime.calculateDaysOverdue() instead
 */
export function calculateDaysOverdue(dueDateString, userContext = null) {
  if (!dueDateString) {
    return 0;
  }

  try {
    // Use logical day calculation when user context is available
    if (userContext) {
      return calculateLogicalDaysOverdue(dueDateString, userContext);
    }

    // Fallback to original calendar day calculation
    const dueDate = new Date(dueDateString);
    const now = new Date();

    // Use calendar day difference instead of 24-hour periods
    // This accounts for timezone boundaries properly
    const dueDateLocal = new Date(
      dueDate.getFullYear(),
      dueDate.getMonth(),
      dueDate.getDate(),
    );
    const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((nowLocal - dueDateLocal) / (1000 * 60 * 60 * 24));

    return Math.max(0, diffDays);
  } catch {
    return 0;
  }
}
