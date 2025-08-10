import { TaskTrackerDateTime } from './datetime-utils.js';

export function formatDate(dateString) {
  try {
    const date = new Date(dateString);
    return (
      date.toLocaleDateString() +
      ' ' +
      date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
    );
  } catch {
    return dateString;
  }
}

export function convertTo12HourFormat(time24) {
  try {
    const [hours, minutes] = time24.split(':');
    const hour = parseInt(hours);
    const ampm = hour < 12 ? 'AM' : 'PM';
    const hour12 = hour % 12 || 12;
    if (minutes === '00') {
      return `${hour12} ${ampm}`;
    }
    return `${hour12}:${minutes} ${ampm}`;
  } catch (error) {
    return time24;
  }
}

export function formatDuration(minutes) {
  if (!minutes) return 'Unknown';
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  const remainingMinutes = minutes % 60;
  return remainingMinutes > 0 ? `${hours}h ${remainingMinutes}m` : `${hours}h`;
}

export function formatPriority(priority) {
  const priorityStringMap = { High: 1, Medium: 2, Low: 3 };
  const priorityMap = { 3: 'Low', 2: 'Medium', 1: 'High', 4: 'Very Low', 5: 'Minimal' };
  if (priority in priorityStringMap) {
    return priorityMap[priorityStringMap[priority]];
  }
  return priorityMap[priority] || `Priority ${priority}`;
}

export function normalizePriority(priority) {
  const priorityStringMap = {
    High: 1,
    Medium: 2,
    Low: 3,
    'Very Low': 4,
    Minimal: 5,
  };
  if (typeof priority === 'string' && priority in priorityStringMap) return priorityStringMap[priority];
  if (typeof priority === 'number') return priority;
  return null;
}

export function formatDateTimeForInput(dateString) {
  if (!dateString) return '';
  try {
    const date = new Date(dateString);
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

export function getPriorityOptions() {
  return [
    { value: 1, label: 'High' },
    { value: 2, label: 'Medium' },
    { value: 3, label: 'Low' },
  ];
}

export function getFrequencyDaysOptions() {
  return [
    { value: 1, label: 'Daily (1 day)' },
    { value: 3, label: 'Twice Weekly (3 days)' },
    { value: 7, label: 'Weekly (7 days)' },
    { value: 14, label: 'Biweekly (14 days)' },
    { value: 30, label: 'Monthly (30 days)' },
    { value: 90, label: 'Quarterly (90 days)' },
    { value: 365, label: 'Yearly (365 days)' },
  ];
}

export function getMoodLabel(value, useEmoji = true) {
  if (!useEmoji) return value.toString();
  const labels = { '-2': '☹️', '-1': '🙁', '0': '😐', '1': '🙂', '2': '😊' };
  return labels[value.toString()] || value.toString();
}

export function getFreeTimeLabel(value) {
  const labels = { '1': 'Slammed', '2': 'Busy', '3': 'Moderate', '4': 'Available', '5': 'Wide-open' };
  return labels[value.toString()] || value.toString();
}

export function formatDateTime(dateString, userContext = null) {
  try {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = now - date;
    if (userContext) {
      const diffDays = TaskTrackerDateTime.calculateLogicalDayDifference(dateString, userContext);
      const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
      const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
      if (diffDays === 0) {
        if (diffHours === 0) return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
        return `${diffHours}h ago`;
      } else if (diffDays === 1) {
        return 'Yesterday';
      }
      return `${diffDays} days ago`;
    }
    const dateLocal = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    const nowLocal = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    const diffDays = Math.floor((nowLocal - dateLocal) / (1000 * 60 * 60 * 24));
    const diffHours = Math.floor((diffMs % (1000 * 60 * 60 * 24)) / (1000 * 60 * 60));
    const diffMinutes = Math.floor((diffMs % (1000 * 60 * 60)) / (1000 * 60));
    if (diffDays === 0) {
      if (diffHours === 0) return diffMinutes < 1 ? 'Just now' : `${diffMinutes}m ago`;
      return `${diffHours}h ago`;
    } else if (diffDays === 1) {
      return 'Yesterday';
    }
    return `${diffDays} days ago`;
  } catch {
    return dateString;
  }
}

// Note: formatDueDate and formatSelfCareDueDate remain to be migrated per card needs.
export function formatDueDate(dueDateString, userContext = null, task = null) {
  if (!dueDateString) return 'Unknown';
  try {
    return TaskTrackerDateTime.formatDueDateLogical(dueDateString, userContext, task);
  } catch {
    // Fallback to simple calendar day diff if something goes wrong
    const now = new Date();
    const dueDate = new Date(dueDateString);
    const diffTime = dueDate.getTime() - now.getTime();
    const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
    if (diffDays < 0) {
      const overdueDays = Math.abs(diffDays);
      if (overdueDays === 0) return 'Today';
      if (overdueDays === 1) return '1 day overdue';
      return `${overdueDays} days overdue`;
    } else if (diffDays === 0) {
      return 'Today';
    } else if (diffDays === 1) {
      return 'Tomorrow';
    }
    return `${diffDays} days`;
  }
}

export function formatSelfCareDueDate() {
  return 'Today';
}

export function capitalize(string) {
  if (!string) return string;
  return string.charAt(0).toUpperCase() + string.slice(1);
}
