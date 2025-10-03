import { TaskTrackerStyles } from '../styles.js';
import { TaskTrackerDateTime } from '../datetime-utils.js';
import { createStyledButton } from './components.js';
import {
  formatDateTimeForInput,
  formatDuration,
  formatPriority,
  getPriorityOptions,
    formatDateTime,
    formatDueDate,
} from '../formatters.js';
import { getUserDisplayName } from '../users.js';
import { showError } from '../toast.js';

// Task details/completion modal (real implementation)
export function createTaskModal(
  task,
  config,
  onComplete,
  onSave = null,
  availableUsers = [],
  enhancedUsers = null,
  onEdit = null,
  onSnooze = null,
  onDelete = null,
) {
  TaskTrackerStyles.ensureGlobal();
  const modal = document.createElement('div');
  modal.className = 'tt-modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'tt-modal__content';

  const taskName = task.name || task.task_name;
  const taskDuration = task.duration_minutes || task.task_duration_minutes || 0;
  const taskPriority = task.priority_value || task.priority || task.task_priority_value || 2;
  const isRecurringTask = ['RecurringTask', 'SelfCareTask'].includes(task.task_type);
  const assignedUsers = task.assigned_users || [];
  const dueDate = task.next_due || task.due_date;

  let nameInput, isActiveInput;
  let durationControl, priorityControl;
  let energyInput, focusInput, painInput, motivationInput, severitySelect;
  let impactInput, satisfactionInput;
  let assignmentControl;
  let dueDateControl, frequencyValueInput, frequencyUnitSelect;
  let levelSelect, requiredOccurrencesInput;
  let suitableAfterHoursSelect, requiresFairWeatherCheckbox, allowedDaysContainer;
  let tagsInput, notesInput;

  const formattedDueDate = dueDate ? formatDateTimeForInput(dueDate) : '';

  // Header
  const header = document.createElement('div');
  header.className = 'tt-modal__header';
  const title = document.createElement('h3');
  title.textContent = taskName;
  title.className = 'tt-modal__title';
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.className = 'tt-modal__close';
  header.appendChild(title);
  header.appendChild(closeButton);

  // Helpers for building sections and fields
  const createSection = (titleText) => {
    const section = document.createElement('div');
    section.className = 'tt-box tt-box-sm';
    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = titleText;
    sectionTitle.className = 'tt-box-title';
    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'tt-grid-auto';
    section.appendChild(sectionTitle);
    section.appendChild(fieldsContainer);
    return { section, fieldsContainer };
  };

  const createFieldRow = (labelText, controlEl, fullWidth = false) => {
    const row = document.createElement('div');
    row.className = 'tt-form-row';
    if (fullWidth) row.classList.add('tt-col-span-full');
    const lbl = document.createElement('label');
    lbl.textContent = labelText;
    lbl.className = 'tt-label';
    row.appendChild(lbl);
    row.appendChild(controlEl);
    return row;
  };

  const createDisplay = (text) => {
    const span = document.createElement('span');
    span.textContent = text ?? '';
    return span;
  };

  const createNumberInput = (value, min, max, step = 1) => {
    const inp = document.createElement('input');
    inp.type = 'number';
    if (value !== undefined && value !== null) inp.value = value;
    if (min !== undefined) inp.min = String(min);
    if (max !== undefined) inp.max = String(max);
    inp.step = String(step);
    inp.className = 'tt-input';
    return inp;
  };

  // Form container (sections stack)
  const formContainer = document.createElement('div');
  formContainer.className = 'tt-form';

  // Section: Basic Information
  const { section: basicSection, fieldsContainer: basicFields } = createSection('Basic Information');
  // Name
  if (onSave) {
    nameInput = document.createElement('input');
    nameInput.type = 'text';
    nameInput.value = taskName;
    nameInput.className = 'tt-input';
    basicFields.appendChild(createFieldRow('Task Name', nameInput));
  } else {
    basicFields.appendChild(createFieldRow('Task Name', createDisplay(taskName)));
  }
  basicFields.appendChild(createFieldRow('Task ID', createDisplay(task.id)));
  // Active
  const isActiveOriginal = task.is_active !== false;
  if (onSave) {
    isActiveInput = document.createElement('input');
    isActiveInput.type = 'checkbox';
    isActiveInput.checked = isActiveOriginal;
    isActiveInput.className = 'tt-checkbox';
    basicFields.appendChild(createFieldRow('Active', isActiveInput));
  } else {
    basicFields.appendChild(createFieldRow('Active', createDisplay(isActiveOriginal ? 'Yes' : 'No')));
  }
  // Duration
  if (onSave) {
    durationControl = createNumberInput(taskDuration, 1, 1440);
  } else {
    durationControl = createDisplay(formatDuration(taskDuration));
  }
  basicFields.appendChild(createFieldRow('Duration', durationControl));
  formContainer.appendChild(basicSection);

  // Section: Priority
  const { section: prioritySection, fieldsContainer: priorityFields } = createSection('Priority');
  // Priority
  if (onSave) {
    priorityControl = document.createElement('select');
    priorityControl.className = 'tt-select';
    getPriorityOptions().forEach(option => {
      const optionElement = document.createElement('option');
      optionElement.value = option.value;
      optionElement.textContent = option.label;
      optionElement.selected = option.value === taskPriority;
      priorityControl.appendChild(optionElement);
    });
  } else {
    priorityControl = createDisplay(formatPriority(taskPriority));
  }
  priorityFields.appendChild(createFieldRow('Priority', priorityControl));

  // Overdue Severity
  const severityLabels = { 1: 'Minor (1)', 2: 'Important (2)', 3: 'Critical (3)' };
  if (onSave) {
    severitySelect = document.createElement('select');
    severitySelect.className = 'tt-select';
    [1, 2, 3].forEach(v => {
      const opt = document.createElement('option');
      opt.value = v;
      opt.textContent = severityLabels[v];
      opt.selected = (task.overdue_severity ?? 2) === v;
      severitySelect.appendChild(opt);
    });
    priorityFields.appendChild(createFieldRow('Overdue Severity', severitySelect));
  } else {
    priorityFields.appendChild(createFieldRow('Overdue Severity', createDisplay(severityLabels[task.overdue_severity ?? 2])));
  }
  formContainer.appendChild(prioritySection);

  // Section: Frequency (Recurring/SelfCare)
  if (isRecurringTask) {
    const { section: freqSection, fieldsContainer: freqFields } = createSection('Frequency');
    // Frequency Value
    if (onSave) {
      frequencyValueInput = createNumberInput(task.frequency_value ?? '', 1, 365);
      freqFields.appendChild(createFieldRow('Frequency Value', frequencyValueInput));
    } else {
      freqFields.appendChild(createFieldRow('Frequency Value', createDisplay(task.frequency_value ?? '—')));
    }
    // Frequency Unit
    const unitOptions = [
      { value: 'days', label: 'Days' },
      { value: 'weeks', label: 'Weeks' },
      { value: 'months', label: 'Months' },
      { value: 'years', label: 'Years' },
    ];
    if (onSave) {
      frequencyUnitSelect = document.createElement('select');
      frequencyUnitSelect.className = 'tt-select';
      unitOptions.forEach(opt => {
        const o = document.createElement('option');
        o.value = opt.value; o.textContent = opt.label; o.selected = (task.frequency_unit === opt.value);
        frequencyUnitSelect.appendChild(o);
      });
      freqFields.appendChild(createFieldRow('Frequency Unit', frequencyUnitSelect));
    } else {
      const unitLabel = unitOptions.find(o => o.value === task.frequency_unit)?.label || '—';
      freqFields.appendChild(createFieldRow('Frequency Unit', createDisplay(unitLabel)));
    }
    // Next Due
    if (onSave) {
      dueDateControl = document.createElement('input');
      dueDateControl.type = 'datetime-local';
      dueDateControl.value = formattedDueDate;
      dueDateControl.className = 'tt-input';
      freqFields.appendChild(createFieldRow('Next Due', dueDateControl));
    } else {
      const userContext = (config && (config.userContext || config.user_context)) || null;
      const nextDueDisplay = dueDate ? formatDueDate(dueDate, userContext, task) : 'Not set';
      freqFields.appendChild(createFieldRow('Next Due', createDisplay(nextDueDisplay)));
    }
    formContainer.appendChild(freqSection);
  }

  // Section: Self-Care Settings
  if (task.task_type === 'SelfCareTask') {
    const { section: scSection, fieldsContainer: scFields } = createSection('Self-Care Settings');
    const levelOptions = [
      { value: 1, label: 'Must Do (1)' },
      { value: 2, label: 'Should Do (2)' },
      { value: 3, label: 'Can Do (3)' },
    ];
    if (onSave) {
      levelSelect = document.createElement('select');
      levelSelect.className = 'tt-select';
      levelOptions.forEach(opt => {
        const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label; o.selected = (task.level === opt.value);
        levelSelect.appendChild(o);
      });
      scFields.appendChild(createFieldRow('Level', levelSelect));
    } else {
      const levelLabel = levelOptions.find(o => o.value === task.level)?.label || '—';
      scFields.appendChild(createFieldRow('Level', createDisplay(levelLabel)));
    }
    if (onSave) {
      requiredOccurrencesInput = createNumberInput(task.required_occurrences ?? 1, 1, 10);
      scFields.appendChild(createFieldRow('Required Occurrences', requiredOccurrencesInput));
    } else {
      scFields.appendChild(createFieldRow('Required Occurrences', createDisplay(String(task.required_occurrences ?? 1))));
    }
    formContainer.appendChild(scSection);
  }

  // Section: Task Fit
  {
    const { section: fitSection, fieldsContainer: fitFields } = createSection('Task Fit');
    if (onSave) {
      impactInput = createNumberInput(task.impact ?? 1, 0, 5);
      satisfactionInput = createNumberInput(task.satisfaction ?? 1, 0, 5);
      energyInput = createNumberInput(task.energy_cost ?? 2, 1, 5);
      focusInput = createNumberInput(task.focus_cost ?? 2, 1, 5);
      painInput = createNumberInput(task.pain_cost ?? 0, 0, 5);
      motivationInput = createNumberInput(task.motivation_boost ?? 0, -5, 5);
      fitFields.appendChild(createFieldRow('Impact (0-5)', impactInput));
      fitFields.appendChild(createFieldRow('Satisfaction (0-5)', satisfactionInput));
      fitFields.appendChild(createFieldRow('Energy Cost (1-5)', energyInput));
      fitFields.appendChild(createFieldRow('Focus Cost (1-5)', focusInput));
      fitFields.appendChild(createFieldRow('Pain Cost (0-5)', painInput));
      fitFields.appendChild(createFieldRow('Motivation Boost (-5 to +5)', motivationInput));
    } else {
      fitFields.appendChild(createFieldRow('Impact', createDisplay(String(task.impact ?? 1))));
      fitFields.appendChild(createFieldRow('Satisfaction', createDisplay(String(task.satisfaction ?? 1))));
      fitFields.appendChild(createFieldRow('Energy Cost', createDisplay(String(task.energy_cost ?? 2))));
      fitFields.appendChild(createFieldRow('Focus Cost', createDisplay(String(task.focus_cost ?? 2))));
      fitFields.appendChild(createFieldRow('Pain Cost', createDisplay(String(task.pain_cost ?? 0))));
      fitFields.appendChild(createFieldRow('Motivation Boost', createDisplay(String(task.motivation_boost ?? 0))));
    }
    formContainer.appendChild(fitSection);
  }

  // Section: Constraints
  {
    const { section: constraintsSection, fieldsContainer: constraintsFields } = createSection('Constraints');
    const sahOptions = [
      { value: 'yes', label: 'Yes' },
      { value: 'if_necessary', label: 'If Necessary' },
      { value: 'absolutely_not', label: 'Absolutely Not' },
    ];
    if (onSave) {
      suitableAfterHoursSelect = document.createElement('select');
      suitableAfterHoursSelect.className = 'tt-select';
      sahOptions.forEach(opt => {
        const o = document.createElement('option'); o.value = opt.value; o.textContent = opt.label; o.selected = (task.suitable_after_hours === opt.value);
        suitableAfterHoursSelect.appendChild(o);
      });
      constraintsFields.appendChild(createFieldRow('Suitable After Hours', suitableAfterHoursSelect));
    } else {
      const sahLabel = sahOptions.find(o => o.value === task.suitable_after_hours)?.label || '—';
      constraintsFields.appendChild(createFieldRow('Suitable After Hours', createDisplay(sahLabel)));
    }

    if (onSave) {
      requiresFairWeatherCheckbox = document.createElement('input');
      requiresFairWeatherCheckbox.type = 'checkbox';
      requiresFairWeatherCheckbox.checked = task.requires_fair_weather === true;
      requiresFairWeatherCheckbox.className = 'tt-checkbox';
      constraintsFields.appendChild(createFieldRow('Requires Fair Weather', requiresFairWeatherCheckbox));
    } else {
      constraintsFields.appendChild(createFieldRow('Requires Fair Weather', createDisplay(task.requires_fair_weather ? 'Yes' : 'No')));
    }

    const dayLabels = ['Monday','Tuesday','Wednesday','Thursday','Friday','Saturday','Sunday'];
    const originalAllowedDays = task.allowed_days || [];
    if (onSave) {
      allowedDaysContainer = document.createElement('div');
      allowedDaysContainer.className = 'tt-multiselect';
      dayLabels.forEach((labelText, idx) => {
        const label = document.createElement('label');
        label.className = 'tt-flex-row tt-gap-4';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.value = String(idx);
        checkbox.checked = originalAllowedDays.includes(idx);
        checkbox.className = 'tt-checkbox';
        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(labelText));
        allowedDaysContainer.appendChild(label);
      });
      constraintsFields.appendChild(createFieldRow('Allowed Days', allowedDaysContainer, true));
    } else {
      const daysDisplay = originalAllowedDays.length ? originalAllowedDays.map(i => dayLabels[i]).join(', ') : '—';
      constraintsFields.appendChild(createFieldRow('Allowed Days', createDisplay(daysDisplay), true));
    }
    formContainer.appendChild(constraintsSection);
  }

  // Section: Assignment (only if users available)
  if (availableUsers && availableUsers.length > 1) {
    const { section: assignSection, fieldsContainer: assignFields } = createSection('Assignment');
    const isSelfCare = task.task_type === 'SelfCareTask';

    if (onSave) {
      if (isSelfCare) {
        // Self-care tasks: single user dropdown
        assignmentControl = document.createElement('select');
        assignmentControl.className = 'tt-select';
        assignmentControl.name = 'assigned_users_single';
        availableUsers.forEach(username => {
          const optionElement = document.createElement('option');
          optionElement.value = username;
          optionElement.textContent = getUserDisplayName(username, enhancedUsers);
          optionElement.selected = assignedUsers.includes(username);
          assignmentControl.appendChild(optionElement);
        });
        assignFields.appendChild(createFieldRow('Assigned To', assignmentControl));
      } else {
        // Other tasks: multi-select checkboxes
        const checkboxContainer = document.createElement('div');
        checkboxContainer.className = 'tt-flex-col tt-gap-8';

        availableUsers.forEach(username => {
          const checkboxRow = document.createElement('div');
          checkboxRow.className = 'tt-flex-row tt-gap-8';

          const checkbox = document.createElement('input');
          checkbox.type = 'checkbox';
          checkbox.name = 'assigned_users';
          checkbox.value = username;
          checkbox.checked = assignedUsers.includes(username);
          checkbox.className = 'tt-checkbox';

          const label = document.createElement('label');
          label.textContent = getUserDisplayName(username, enhancedUsers);
          label.className = 'tt-label';

          checkboxRow.appendChild(checkbox);
          checkboxRow.appendChild(label);
          checkboxContainer.appendChild(checkboxRow);
        });

        assignFields.appendChild(createFieldRow('Assigned To', checkboxContainer, true));
      }
    } else {
      // Read-only display
      const displayText = assignedUsers.length > 0
        ? assignedUsers.map(user => getUserDisplayName(user, enhancedUsers) || user).join(', ')
        : '—';
      assignFields.appendChild(createFieldRow('Assigned To', createDisplay(displayText)));
    }
    formContainer.appendChild(assignSection);
  }

  // Section: Task Nudges (read-only display)
  if (!onSave) {
    const { section: nudgesSection, fieldsContainer: nudgesFields } = createSection('Task Nudges');

    if (task.task_nudges && task.task_nudges.length > 0) {
      task.task_nudges.forEach(nudge => {
        const nudgeContainer = document.createElement('div');
        nudgeContainer.className = 'tt-nudge-item';

        const triggerTypeLabels = {
          'on_due': 'When task becomes due',
          'on_overdue': 'When task becomes overdue',
          'time_of_day': 'At specific time of day',
          'after_due_delay': 'After due with delay',
          'overdue_threshold': 'When overdue threshold reached'
        };

        const triggerLabel = triggerTypeLabels[nudge.trigger_type] || nudge.trigger_type;
        let configText = '';

        if (nudge.trigger_type === 'time_of_day' && nudge.trigger_config?.time) {
          const formattedTime = TaskTrackerDateTime.formatTimeForDisplay(nudge.trigger_config.time);
          configText = ` (at ${formattedTime})`;
        } else if (nudge.trigger_type === 'after_due_delay' && nudge.trigger_config?.minutes) {
          const hours = Math.floor(nudge.trigger_config.minutes / 60);
          const mins = nudge.trigger_config.minutes % 60;
          if (hours > 0 && mins > 0) {
            configText = ` (${hours}h ${mins}m after due)`;
          } else if (hours > 0) {
            configText = ` (${hours}h after due)`;
          } else {
            configText = ` (${mins}m after due)`;
          }
        } else if (nudge.trigger_type === 'overdue_threshold' && nudge.trigger_config?.days) {
          configText = ` (${nudge.trigger_config.days} days overdue)`;
        }

        const triggerText = document.createElement('div');
        triggerText.className = 'tt-nudge-trigger';
        triggerText.textContent = `${triggerLabel}${configText}`;
        nudgeContainer.appendChild(triggerText);

        if (nudge.custom_message) {
          const messageText = document.createElement('div');
          messageText.className = 'tt-nudge-message';
          messageText.textContent = `"${nudge.custom_message}"`;
          nudgeContainer.appendChild(messageText);
        }

        const metaText = document.createElement('div');
        metaText.className = 'tt-nudge-meta';
        const parts = [];
        parts.push(`Priority: ${nudge.priority}`);
        if (!nudge.is_active) parts.push('Inactive');
        metaText.textContent = parts.join(' • ');
        nudgeContainer.appendChild(metaText);

        nudgesFields.appendChild(nudgeContainer);
      });
    } else {
      const noNudgesText = document.createElement('div');
      noNudgesText.className = 'tt-text-muted';
      noNudgesText.textContent = 'No custom nudges configured for this task';
      nudgesFields.appendChild(noNudgesText);
    }

    formContainer.appendChild(nudgesSection);
  }

  // Section: Tags & Notes
  {
    const { section: tagsSection, fieldsContainer: tagsFields } = createSection('Tags & Notes');
    const tagsArray = (task.tags || []).slice();
    if (onSave) {
      tagsInput = document.createElement('input');
      tagsInput.type = 'text';
      tagsInput.value = tagsArray.join(', ');
      tagsInput.placeholder = 'tag1, tag2';
      tagsInput.className = 'tt-input';
      tagsFields.appendChild(createFieldRow('Tags', tagsInput, true));
    } else {
      tagsFields.appendChild(createFieldRow('Tags', createDisplay(tagsArray.join(', ')), true));
    }

    if (onSave) {
      notesInput = document.createElement('textarea');
      notesInput.className = 'tt-textarea';
      notesInput.rows = 3;
      notesInput.value = task.notes || '';
      tagsFields.appendChild(createFieldRow('Task Notes', notesInput, true));
    } else {
      const notesBox = document.createElement('div');
      notesBox.className = 'tt-box';
      notesBox.textContent = task.notes || '';
      tagsFields.appendChild(createFieldRow('Task Notes', notesBox, true));
    }
    formContainer.appendChild(tagsSection);
  }

  // Completion notes
  const completionNotesSection = document.createElement('div');
  completionNotesSection.className = 'tt-section';
  const completionNotesLabel = document.createElement('label');
  completionNotesLabel.textContent = config.show_completion_notes !== false ? 'Completion Notes (Optional)' : '';
  completionNotesLabel.className = 'tt-label';
  if (config.show_completion_notes === false) completionNotesLabel.classList.add('tt-hidden');
  const completionNotesTextarea = document.createElement('textarea');
  completionNotesTextarea.placeholder = 'Add completion notes...';
  completionNotesTextarea.className = 'tt-textarea';
  if (config.show_completion_notes === false) completionNotesTextarea.classList.add('tt-hidden');
  completionNotesSection.appendChild(completionNotesLabel);
  completionNotesSection.appendChild(completionNotesTextarea);

  // Past completion section
  const pastCompletionSection = document.createElement('div');
  pastCompletionSection.className = 'tt-section tt-section--muted tt-hidden';
  const pastCompletionTitle = document.createElement('p');
  pastCompletionTitle.textContent = 'When was this completed?';
  pastCompletionTitle.className = 'tt-title--sm';
  const quickOptionsContainer = document.createElement('div');
  quickOptionsContainer.className = 'tt-flex-row tt-gap-12';
  const yesterdayButton = document.createElement('button');
  yesterdayButton.textContent = 'Yesterday';
  yesterdayButton.className = 'tt-btn tt-flex-1';
  const customDateButton = document.createElement('button');
  customDateButton.textContent = 'Choose Date/Time';
  customDateButton.className = 'tt-btn tt-flex-1';
  quickOptionsContainer.appendChild(yesterdayButton);
  quickOptionsContainer.appendChild(customDateButton);

  const customDateContainer = document.createElement('div');
  customDateContainer.className = 'tt-hidden tt-mt-12';
  const customDateLabel = document.createElement('label');
  customDateLabel.textContent = 'Completion Date & Time';
  customDateLabel.className = 'tt-label';
  const customDateInput = document.createElement('input');
  customDateInput.type = 'datetime-local';
  customDateInput.className = 'tt-input';
  const y = new Date();
  y.setDate(y.getDate() - 1);
  customDateInput.value = formatDateTimeForInput(y.toISOString());
  customDateContainer.appendChild(customDateLabel);
  customDateContainer.appendChild(customDateInput);

  pastCompletionSection.appendChild(pastCompletionTitle);
  // Render controls inside the section (consistent with delete section behavior)
  pastCompletionSection.appendChild(quickOptionsContainer);
  pastCompletionSection.appendChild(customDateContainer);
  // Footer actions only
  const pastFooterButtons = document.createElement('div');
  pastFooterButtons.className = 'tt-modal__footer-row';
  const pastControlsSpacer = document.createElement('div');
  pastControlsSpacer.className = 'tt-modal__footer-controls';
  const pastButtonsRow = document.createElement('div');
  pastButtonsRow.className = 'tt-modal__footer-actions';
  const cancelPastButton = createStyledButton('Cancel'); cancelPastButton.classList.add('tt-btn');
  const confirmPastButton = createStyledButton('Mark as Completed'); confirmPastButton.classList.add('tt-btn');
  pastButtonsRow.appendChild(cancelPastButton);
  pastButtonsRow.appendChild(confirmPastButton);
  pastFooterButtons.appendChild(pastControlsSpacer);
  pastFooterButtons.appendChild(pastButtonsRow);

  // Snooze section
  const snoozeSection = document.createElement('div');
  snoozeSection.className = 'tt-section tt-section--muted tt-section--warning tt-hidden';
  const snoozeTitle = document.createElement('p');
  snoozeTitle.textContent = 'Snooze until when?';
  snoozeTitle.className = 'tt-title--sm';
  const snoozeQuickOptionsContainer = document.createElement('div');
  snoozeQuickOptionsContainer.className = 'tt-flex-row tt-gap-12';
  const tomorrowButton = document.createElement('button');
  tomorrowButton.textContent = 'Tomorrow';
  tomorrowButton.className = 'tt-btn tt-flex-1';
  const customSnoozeButton = document.createElement('button');
  customSnoozeButton.textContent = 'Choose Date/Time';
  customSnoozeButton.className = 'tt-btn tt-flex-1';
  snoozeQuickOptionsContainer.appendChild(tomorrowButton);
  snoozeQuickOptionsContainer.appendChild(customSnoozeButton);

  const customSnoozeContainer = document.createElement('div');
  customSnoozeContainer.className = 'tt-hidden tt-mt-12';
  const customSnoozeLabel = document.createElement('label');
  customSnoozeLabel.textContent = 'Snooze Until Date & Time';
  customSnoozeLabel.className = 'tt-label';
  const customSnoozeInput = document.createElement('input');
  customSnoozeInput.type = 'datetime-local';
  customSnoozeInput.className = 'tt-input';
  const t = new Date();
  t.setDate(t.getDate() + 1);
  t.setHours(9, 0, 0, 0);
  customSnoozeInput.value = formatDateTimeForInput(t.toISOString());
  customSnoozeContainer.appendChild(customSnoozeLabel);
  customSnoozeContainer.appendChild(customSnoozeInput);

  snoozeSection.appendChild(snoozeTitle);
  // Render controls inside the section (consistent with delete section behavior)
  snoozeSection.appendChild(snoozeQuickOptionsContainer);
  snoozeSection.appendChild(customSnoozeContainer);
  // Footer actions only
  const snoozeFooterButtons = document.createElement('div');
  snoozeFooterButtons.className = 'tt-modal__footer-row';
  const snoozeControlsSpacer = document.createElement('div');
  snoozeControlsSpacer.className = 'tt-modal__footer-controls';
  const snoozeButtonsRow = document.createElement('div');
  snoozeButtonsRow.className = 'tt-modal__footer-actions';
  const cancelSnoozeButton = createStyledButton('Cancel'); cancelSnoozeButton.classList.add('tt-btn');
  const confirmSnoozeButton = createStyledButton('Snooze Task'); confirmSnoozeButton.classList.add('tt-btn');
  snoozeButtonsRow.appendChild(cancelSnoozeButton);
  snoozeButtonsRow.appendChild(confirmSnoozeButton);
  snoozeFooterButtons.appendChild(snoozeControlsSpacer);
  snoozeFooterButtons.appendChild(snoozeButtonsRow);

  // Footer buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'tt-flex-end tt-gap-12 tt-mt-24';
  const cancelButton = createStyledButton('Cancel');
  let saveButton; if (onSave) saveButton = createStyledButton('Save');
  let editButton; if (onEdit) editButton = createStyledButton('Edit');
  const completeButton = createStyledButton('Complete');
  const completedAlreadyButton = createStyledButton('Completed Already');
  let snoozeButton; if (onSnooze && (task.next_due || task.due_date)) snoozeButton = createStyledButton('Snooze');
  let deleteButton; if (onDelete) { deleteButton = createStyledButton('Delete'); deleteButton.classList.add('tt-btn'); }
  buttonContainer.appendChild(cancelButton);
  if (deleteButton) buttonContainer.appendChild(deleteButton);
  if (editButton) buttonContainer.appendChild(editButton);
  if (snoozeButton) buttonContainer.appendChild(snoozeButton);
  buttonContainer.appendChild(completedAlreadyButton);
  buttonContainer.appendChild(completeButton);
  if (saveButton) buttonContainer.appendChild(saveButton);

  // Assemble
  modalContent.appendChild(header);
  const body = document.createElement('div');
  body.className = 'tt-modal__body';
  body.appendChild(formContainer);
  body.appendChild(completionNotesSection);
  modalContent.appendChild(body);
  // Action sections should float above the footer (outside scrollable body)
  modalContent.appendChild(pastCompletionSection);
  modalContent.appendChild(snoozeSection);

  // Delete confirmation section
  const deleteSection = document.createElement('div');
  deleteSection.className = 'tt-section tt-section--muted tt-hidden';
  const deleteTitle = document.createElement('p');
  deleteTitle.textContent = 'Delete this task?';
  deleteTitle.className = 'tt-title--sm';
  const deleteText = document.createElement('div');
  deleteText.className = 'tt-text-muted';
  deleteText.textContent = 'This action cannot be undone.';
  deleteSection.appendChild(deleteTitle);
  deleteSection.appendChild(deleteText);
  // Footer buttons for delete
  const deleteFooterButtons = document.createElement('div');
  deleteFooterButtons.className = 'tt-modal__footer-row';
  const deleteControlsSpacer = document.createElement('div');
  deleteControlsSpacer.className = 'tt-modal__footer-controls';
  deleteFooterButtons.appendChild(deleteControlsSpacer);
  const deleteActions = document.createElement('div');
  deleteActions.className = 'tt-modal__footer-actions';
  const cancelDeleteButton = createStyledButton('Cancel');
  const confirmDeleteButton = createStyledButton('Confirm Delete');
  confirmDeleteButton.classList.add('tt-btn', 'tt-btn--error');
  deleteActions.appendChild(cancelDeleteButton);
  deleteActions.appendChild(confirmDeleteButton);
  deleteFooterButtons.appendChild(deleteActions);
  modalContent.appendChild(deleteSection);
  const footer = document.createElement('div');
  footer.className = 'tt-modal__footer';
  // Footer content swapper
  const setFooterContent = (container) => {
    while (footer.firstChild) footer.removeChild(footer.firstChild);
    footer.appendChild(container);
  };
  const hideAllActionSections = () => {
    pastCompletionSection.classList.add('tt-hidden');
    snoozeSection.classList.add('tt-hidden');
    deleteSection.classList.add('tt-hidden');
  };
  setFooterContent(buttonContainer);
  modalContent.appendChild(footer);
  modal.appendChild(modalContent);

  const closeModal = () => {
    if (modal.parentNode) {
      modal.classList.remove('tt-modal--visible');
      setTimeout(() => modal.remove(), 200);
    }
  };

  // Events
  closeButton.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  const escapeHandler = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escapeHandler); } };
  document.addEventListener('keydown', escapeHandler);

  if (saveButton && onSave) {
    saveButton.addEventListener('click', async () => {
      const updates = {};
      const addIfChanged = (key, newValue, originalValue) => {
        if (newValue !== undefined && newValue !== null && newValue !== '' && newValue !== originalValue) {
          updates[key] = newValue;
        }
      };

      // Basic
      if (nameInput) addIfChanged('name', nameInput.value.trim(), task.name);
      if (typeof isActiveInput?.checked === 'boolean') addIfChanged('is_active', !!isActiveInput.checked, task.is_active !== false);
      if (durationControl && durationControl.value) addIfChanged('duration_minutes', parseInt(durationControl.value, 10), task.duration_minutes || 0);

      // Priority
      if (priorityControl && priorityControl.value) addIfChanged('priority', parseInt(priorityControl.value, 10), taskPriority);
      if (severitySelect && severitySelect.value) addIfChanged('overdue_severity', parseInt(severitySelect.value, 10), task.overdue_severity ?? 2);

      // Frequency
      if (isRecurringTask) {
        if (frequencyValueInput && frequencyValueInput.value) addIfChanged('frequency_value', parseInt(frequencyValueInput.value, 10), task.frequency_value);
        if (frequencyUnitSelect && frequencyUnitSelect.value) addIfChanged('frequency_unit', frequencyUnitSelect.value, task.frequency_unit);
        if (dueDateControl && dueDateControl.value) {
          const newDueDate = new Date(dueDateControl.value).toISOString();
          addIfChanged('next_due', newDueDate, dueDate);
        }
      }

      // Self-care
      if (task.task_type === 'SelfCareTask') {
        if (levelSelect && levelSelect.value) addIfChanged('level', parseInt(levelSelect.value, 10), task.level);
        if (requiredOccurrencesInput && requiredOccurrencesInput.value) addIfChanged('required_occurrences', parseInt(requiredOccurrencesInput.value, 10), task.required_occurrences || 1);
      }

      // Task fit
      if (impactInput && impactInput.value) addIfChanged('impact', parseInt(impactInput.value, 10), task.impact ?? 1);
      if (satisfactionInput && satisfactionInput.value) addIfChanged('satisfaction', parseInt(satisfactionInput.value, 10), task.satisfaction ?? 1);
      if (energyInput && energyInput.value) addIfChanged('energy_cost', parseInt(energyInput.value, 10), task.energy_cost ?? 2);
      if (focusInput && focusInput.value) addIfChanged('focus_cost', parseInt(focusInput.value, 10), task.focus_cost ?? 2);
      if (painInput && painInput.value) addIfChanged('pain_cost', parseInt(painInput.value, 10), task.pain_cost ?? 0);
      if (motivationInput && motivationInput.value) addIfChanged('motivation_boost', parseInt(motivationInput.value, 10), task.motivation_boost ?? 0);

      // Constraints
      if (suitableAfterHoursSelect && suitableAfterHoursSelect.value) addIfChanged('suitable_after_hours', suitableAfterHoursSelect.value, task.suitable_after_hours);
      if (typeof requiresFairWeatherCheckbox?.checked === 'boolean') addIfChanged('requires_fair_weather', !!requiresFairWeatherCheckbox.checked, !!task.requires_fair_weather);
      if (allowedDaysContainer) {
        const selected = Array.from(allowedDaysContainer.querySelectorAll('input[type="checkbox"]:checked')).map(c => parseInt(c.value, 10));
        const orig = (task.allowed_days || []).slice().sort();
        const now = selected.slice().sort();
        if (JSON.stringify(now) !== JSON.stringify(orig)) updates.allowed_days = selected;
      }

      // Assignment
      const isSelfCare = task.task_type === 'SelfCareTask';
      if (isSelfCare && assignmentControl && assignmentControl.value) {
        const newAssignedUsers = [assignmentControl.value];
        if (JSON.stringify(newAssignedUsers) !== JSON.stringify(assignedUsers)) {
          updates.assigned_users = newAssignedUsers;
        }
      } else if (!isSelfCare) {
        // Multi-user assignment for non-self-care tasks
        const form = assignmentControl?.closest('form') || assignmentControl?.closest('.tt-modal__content');
        if (form) {
          const formData = new FormData(form);
          const selectedUsers = formData.getAll('assigned_users');
          if (JSON.stringify(selectedUsers.sort()) !== JSON.stringify(assignedUsers.sort())) {
            updates.assigned_users = selectedUsers;
          }
        }
      }

      // Tags and notes
      if (tagsInput) {
        const tags = tagsInput.value.split(',').map(t => t.trim()).filter(Boolean);
        const originalTags = (task.tags || []).slice().sort();
        const newTags = tags.slice().sort();
        if (JSON.stringify(newTags) !== JSON.stringify(originalTags)) updates.tags = tags;
      }
      if (notesInput) addIfChanged('notes', notesInput.value, task.notes || '');

      if (Object.keys(updates).length > 0) { try { await onSave(updates); closeModal(); } catch (error) {} } else { closeModal(); }
    });
  }

  if (editButton && onEdit) { editButton.addEventListener('click', () => { closeModal(); setTimeout(() => { onEdit(task); }, 220); }); }

  completeButton.addEventListener('click', async () => { const notesVal = completionNotesTextarea.value.trim(); try { await onComplete(notesVal); closeModal(); } catch (error) {} });

  completedAlreadyButton.addEventListener('click', () => {
    pastCompletionSection.classList.remove('tt-hidden');
    snoozeSection.classList.add('tt-hidden');
    deleteSection.classList.add('tt-hidden');
    setFooterContent(pastFooterButtons);
  });

  if (snoozeButton && onSnooze) { snoozeButton.addEventListener('click', () => { snoozeSection.classList.remove('tt-hidden'); pastCompletionSection.classList.add('tt-hidden'); deleteSection.classList.add('tt-hidden'); setFooterContent(snoozeFooterButtons); }); }
  if (deleteButton && onDelete) { deleteButton.addEventListener('click', () => { deleteSection.classList.remove('tt-hidden'); pastCompletionSection.classList.add('tt-hidden'); snoozeSection.classList.add('tt-hidden'); setFooterContent(deleteFooterButtons); }); }

  yesterdayButton.addEventListener('click', async () => {
    const notesVal = completionNotesTextarea.value.trim(); const d = new Date(); d.setDate(d.getDate() - 1);
    try { await onComplete(notesVal, d.toISOString()); closeModal(); } catch (error) {}
  });

  customDateButton.addEventListener('click', () => { customDateContainer.classList.remove('tt-hidden'); quickOptionsContainer.classList.add('tt-hidden'); });

  cancelPastButton.addEventListener('click', () => {
    pastCompletionSection.classList.add('tt-hidden');
    customDateContainer.classList.add('tt-hidden');
    quickOptionsContainer.classList.remove('tt-hidden');
    setFooterContent(buttonContainer);
  });

  confirmPastButton.addEventListener('click', async () => {
    const notesVal = completionNotesTextarea.value.trim(); const completedAtValue = customDateInput.value;
    if (!completedAtValue) { showError('Please select a completion date and time'); return; }
    const completedAtIso = new Date(completedAtValue).toISOString();
    try { await onComplete(notesVal, completedAtIso); closeModal(); } catch (error) {}
  });

  if (onSnooze) {
    tomorrowButton.addEventListener('click', async () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); try { await onSnooze(d.toISOString()); closeModal(); } catch (error) {} });
    customSnoozeButton.addEventListener('click', () => { customSnoozeContainer.classList.remove('tt-hidden'); snoozeQuickOptionsContainer.classList.add('tt-hidden'); });
    cancelSnoozeButton.addEventListener('click', () => {
      snoozeSection.classList.add('tt-hidden');
      customSnoozeContainer.classList.add('tt-hidden');
      snoozeQuickOptionsContainer.classList.remove('tt-hidden');
      setFooterContent(buttonContainer);
    });
    confirmSnoozeButton.addEventListener('click', async () => { const val = customSnoozeInput.value; if (!val) { showError('Please select a snooze date and time'); return; } const iso = new Date(val).toISOString(); if (new Date(iso) <= new Date()) { showError('Snooze time must be in the future'); return; } try { await onSnooze(iso); closeModal(); } catch (error) {} });
  }

  // Delete confirmation handlers
  cancelDeleteButton.addEventListener('click', () => { deleteSection.classList.add('tt-hidden'); setFooterContent(buttonContainer); });
  confirmDeleteButton.addEventListener('click', async () => { try { if (onDelete) await onDelete(task); closeModal(); } catch (error) {} });

  setTimeout(() => { modal.classList.add('tt-modal--visible'); }, 10);
  return modal;
}
