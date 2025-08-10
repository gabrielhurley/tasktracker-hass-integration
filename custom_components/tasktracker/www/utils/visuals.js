export function getOverdueColor(daysOverdue, overdueSeverity = 1) {
  if (daysOverdue <= 0) return null;
  switch (overdueSeverity) {
    case 3: // Immediate red
      return `rgb(255, 70, 40)`;
    case 2: // Orange then to red
      if (daysOverdue <= 7) return `rgb(255, 160, 70)`;
      const progress = Math.min((daysOverdue - 7) / 7, 1);
      const red = Math.round(255);
      const green = Math.round(160 - 90 * progress);
      const blue = Math.round(70 - 30 * progress);
      return `rgb(${red}, ${green}, ${blue})`;
    case 1:
    default:
      if (daysOverdue <= 7) return null;
      if (daysOverdue <= 21) {
        const p = (daysOverdue - 7) / 14;
        const red2 = Math.round(200 + 55 * p);
        const green2 = Math.round(140 + 20 * p);
        const blue2 = Math.round(60 + 10 * p);
        return `rgb(${red2}, ${green2}, ${blue2})`;
      }
      const p2 = Math.min((daysOverdue - 21) / 14, 1);
      const r3 = Math.round(220 + 35 * p2);
      const g3 = Math.round(100 - 30 * p2);
      const b3 = Math.round(80 - 40 * p2);
      return `rgb(${r3}, ${g3}, ${b3})`;
  }
}

export function getTaskBorderStyle(task, taskType = 'task', daysOverdue = 0) {
  let isOverdue, isDue, borderStyle, borderClass = '';
  const overdueSeverity = task.overdue_severity || 1;
  if (task.is_overdue !== undefined || task.days_overdue !== undefined) {
    isOverdue = task.is_overdue || false;
    daysOverdue = task.days_overdue || 0;
    isDue = daysOverdue === 0 && !!(task.due_date || task.next_due);
  } else {
    const dueDate = task.due_date || task.next_due;
    isOverdue = !!(dueDate && daysOverdue > 0);
    isDue = !!(dueDate && daysOverdue === 0);
  }
  if (isOverdue) {
    const overdueColor = getOverdueColor(daysOverdue, overdueSeverity);
    if (overdueColor) {
      borderStyle = `border-left: 2px solid ${overdueColor} !important;`;
      borderClass = 'tt-task-border--overdue-custom';
    } else {
      borderClass = 'tt-task-border--overdue';
    }
  } else if (isDue) {
    borderClass = 'tt-task-border--due';
  }
  return {
    borderStyle,
    borderClass,
    cssClasses: {
      isOverdue,
      isDue,
      needsCompletion: isOverdue || isDue,
      overdue: isOverdue,
      dueToday: isDue && !isOverdue,
    },
  };
}
