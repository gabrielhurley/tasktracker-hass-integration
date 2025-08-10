import { TaskTrackerStyles } from '../../tasktracker-styles.js';
import { createStyledButton } from './components.js';
import {
  formatDateTimeForInput,
  formatDuration,
  formatPriority,
  getPriorityOptions,
  formatDateTime,
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
) {
  TaskTrackerStyles.ensureGlobal();
  const modal = document.createElement('div');
  modal.className = 'tt-modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'tt-modal__content';

  const taskName = task.name || task.task_name;
  const taskDuration = task.duration_minutes || task.task_duration_minutes || 0;
  const taskPriority = task.priority || task.task_priority_value || 2;
  const isRecurringTask = task.task_type in ['RecurringTask', 'SelfCareTask'];
  const assignedTo = task.assigned_to;
  const dueDate = task.next_due || task.due_date;

  let energyInput, focusInput, painInput, motivationInput, severitySelect;
  let energyInputWrapper, focusInputWrapper, painInputWrapper, motivationInputWrapper;
  let assignmentControl;
  let dueDateControl;

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

  // Task details grid
  const detailsGrid = document.createElement('div');
  detailsGrid.className = 'tt-grid-2 tt-gap-16 tt-mb-20';

  // Duration field
  const durationField = document.createElement('div');
  durationField.className = 'tt-form-row';
  const durationLabel = document.createElement('label');
  durationLabel.textContent = 'Duration';
  durationLabel.className = 'tt-label';
  let durationControl;
  if (onSave) {
    durationControl = document.createElement('input');
    durationControl.type = 'number';
    durationControl.value = taskDuration;
    durationControl.min = '1';
    durationControl.className = 'tt-input';
  } else {
    durationControl = document.createElement('span');
    durationControl.textContent = formatDuration(taskDuration);
  }
  durationField.appendChild(durationLabel);
  durationField.appendChild(durationControl);

  // Priority field
  const priorityField = document.createElement('div');
  priorityField.className = 'tt-form-row';
  const priorityLabel = document.createElement('label');
  priorityLabel.textContent = 'Priority';
  priorityLabel.className = 'tt-label';
  let priorityControl;
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
    priorityControl = document.createElement('span');
    priorityControl.textContent = formatPriority(taskPriority);
  }
  priorityField.appendChild(priorityLabel);
  priorityField.appendChild(priorityControl);

  detailsGrid.appendChild(durationField);
  detailsGrid.appendChild(priorityField);

  // Task notes
  const taskNotesField = document.createElement('div');
  taskNotesField.className = 'tt-form-row tt-col-span-full';
  const taskNotesLabel = document.createElement('label');
  taskNotesLabel.textContent = 'Task Notes';
  taskNotesLabel.className = 'tt-label';
  const taskNotes = document.createElement('div');
  taskNotes.textContent = task.notes || '';
  taskNotes.className = 'tt-box';
  taskNotesField.appendChild(taskNotesLabel);
  taskNotesField.appendChild(taskNotes);
  detailsGrid.appendChild(taskNotesField);

  // Due date
  if (isRecurringTask) {
    const dueDateField = document.createElement('div');
    dueDateField.className = 'tt-form-row tt-col-span-full';
    const dueDateLabel = document.createElement('label');
    dueDateLabel.textContent = 'Due Date';
    dueDateLabel.className = 'tt-label';
    if (onSave) {
      dueDateControl = document.createElement('input');
      dueDateControl.type = 'datetime-local';
      dueDateControl.value = formattedDueDate;
      dueDateControl.className = 'tt-input';
    } else {
      dueDateControl = document.createElement('span');
      dueDateControl.textContent = dueDate ? formatDateTime(dueDate) : 'Not set';
    }
    dueDateField.appendChild(dueDateLabel);
    dueDateField.appendChild(dueDateControl);
    detailsGrid.appendChild(dueDateField);
  }

  // Assignment
  if (onSave && availableUsers && availableUsers.length > 0) {
    const assignmentField = document.createElement('div');
    assignmentField.className = 'tt-form-row tt-col-span-full';
    const assignmentLabel = document.createElement('label');
    assignmentLabel.textContent = 'Assigned To';
    assignmentLabel.className = 'tt-label';
    assignmentControl = document.createElement('select');
    assignmentControl.className = 'tt-select';
    availableUsers.forEach(username => {
      const optionElement = document.createElement('option');
      optionElement.value = username;
      optionElement.textContent = getUserDisplayName(username, enhancedUsers);
      optionElement.selected = username === assignedTo;
      assignmentControl.appendChild(optionElement);
    });
    assignmentField.appendChild(assignmentLabel);
    assignmentField.appendChild(assignmentControl);
    detailsGrid.appendChild(assignmentField);
  }

  // Advanced
  if (onSave) {
    const advancedToggle = document.createElement('button');
    advancedToggle.textContent = 'Advanced';
    advancedToggle.className = 'tt-btn tt-col-span-full';
    const advancedContainer = document.createElement('div');
    advancedContainer.className = 'tt-form tt-col-span-full tt-hidden';

    const makeNumberField = (labelText, initialValue, min, max, step = 1) => {
      const wrapper = document.createElement('div');
      wrapper.className = 'tt-form-row';
      const lbl = document.createElement('label');
      lbl.textContent = labelText; lbl.className = 'tt-label';
      const inp = document.createElement('input');
      inp.type = 'number'; inp.value = initialValue; inp.min = min; inp.max = max; inp.step = step; inp.className = 'tt-input';
      wrapper.appendChild(lbl); wrapper.appendChild(inp);
      return { wrapper, input: inp };
    };

    ({ wrapper: energyInputWrapper, input: energyInput } = makeNumberField('Energy Cost', task.energy_cost ?? 2, 0, 5));
    ({ wrapper: focusInputWrapper, input: focusInput } = makeNumberField('Focus Cost', task.focus_cost ?? 2, 0, 5));
    ({ wrapper: painInputWrapper, input: painInput } = makeNumberField('Pain Cost', task.pain_cost ?? 0, 0, 5));
    ({ wrapper: motivationInputWrapper, input: motivationInput } = makeNumberField('Motivation Boost', task.motivation_boost ?? 0, -5, 5));

    const severityWrapper = document.createElement('div');
    severityWrapper.className = 'tt-form-row';
    const sevLbl = document.createElement('label'); sevLbl.textContent = 'Overdue Severity'; sevLbl.className = 'tt-label';
    severitySelect = document.createElement('select'); severitySelect.className = 'tt-select';
    [ { value: 1, label: 'Low' }, { value: 2, label: 'Medium' }, { value: 3, label: 'High' } ].forEach(opt => {
      const optionEl = document.createElement('option'); optionEl.value = opt.value; optionEl.textContent = opt.label; optionEl.selected = (task.overdue_severity ?? 2) === opt.value; severitySelect.appendChild(optionEl);
    });
    severityWrapper.appendChild(sevLbl); severityWrapper.appendChild(severitySelect);

    advancedContainer.appendChild(energyInputWrapper);
    advancedContainer.appendChild(focusInputWrapper);
    advancedContainer.appendChild(painInputWrapper);
    advancedContainer.appendChild(motivationInputWrapper);
    advancedContainer.appendChild(severityWrapper);

    advancedToggle.addEventListener('click', () => {
      const hidden = advancedContainer.classList.contains('tt-hidden');
      advancedContainer.classList.toggle('tt-hidden', !hidden);
    });

    detailsGrid.appendChild(advancedToggle);
    detailsGrid.appendChild(advancedContainer);
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
  const pastCompletionTitle = document.createElement('h4');
  pastCompletionTitle.textContent = 'When was this completed?';
  pastCompletionTitle.className = 'tt-modal__title tt-title--sm';
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

  const pastCompletionButtons = document.createElement('div');
  pastCompletionButtons.className = 'tt-flex-end tt-gap-12 tt-mt-12';
  const cancelPastButton = createStyledButton('Cancel');
  cancelPastButton.classList.add('tt-btn');
  const confirmPastButton = createStyledButton('Mark as Completed');
  confirmPastButton.classList.add('tt-btn');
  pastCompletionButtons.appendChild(cancelPastButton);
  pastCompletionButtons.appendChild(confirmPastButton);
  pastCompletionSection.appendChild(pastCompletionTitle);
  pastCompletionSection.appendChild(quickOptionsContainer);
  pastCompletionSection.appendChild(customDateContainer);
  pastCompletionSection.appendChild(pastCompletionButtons);

  // Snooze section
  const snoozeSection = document.createElement('div');
  snoozeSection.className = 'tt-section tt-section--muted tt-section--warning tt-hidden';
  const snoozeTitle = document.createElement('h4');
  snoozeTitle.textContent = 'Snooze until when?';
  snoozeTitle.className = 'tt-modal__title tt-title--sm';
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

  const snoozeButtons = document.createElement('div');
  snoozeButtons.className = 'tt-flex-end tt-gap-12 tt-mt-12';
  const cancelSnoozeButton = createStyledButton('Cancel');
  cancelSnoozeButton.classList.add('tt-btn');
  const confirmSnoozeButton = createStyledButton('Snooze Task');
  confirmSnoozeButton.classList.add('tt-btn');
  snoozeButtons.appendChild(cancelSnoozeButton);
  snoozeButtons.appendChild(confirmSnoozeButton);
  snoozeSection.appendChild(snoozeTitle);
  snoozeSection.appendChild(snoozeQuickOptionsContainer);
  snoozeSection.appendChild(customSnoozeContainer);
  snoozeSection.appendChild(snoozeButtons);

  // Footer buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'tt-flex-end tt-gap-12 tt-mt-24';
  const cancelButton = createStyledButton('Cancel');
  let saveButton; if (onSave) saveButton = createStyledButton('Save');
  let editButton; if (onEdit) editButton = createStyledButton('Edit');
  const completeButton = createStyledButton('Complete');
  const completedAlreadyButton = createStyledButton('Completed Already');
  let snoozeButton; if (onSnooze && (task.next_due || task.due_date)) snoozeButton = createStyledButton('Snooze');
  buttonContainer.appendChild(cancelButton);
  if (saveButton) buttonContainer.appendChild(saveButton);
  if (editButton) buttonContainer.appendChild(editButton);
  if (snoozeButton) buttonContainer.appendChild(snoozeButton);
  buttonContainer.appendChild(completedAlreadyButton);
  buttonContainer.appendChild(completeButton);

  // Assemble
  modalContent.appendChild(header);
  modalContent.appendChild(detailsGrid);
  modalContent.appendChild(completionNotesSection);
  modalContent.appendChild(pastCompletionSection);
  modalContent.appendChild(snoozeSection);
  modalContent.appendChild(buttonContainer);
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
      if (durationControl && durationControl.value && parseInt(durationControl.value) !== taskDuration) updates.duration_minutes = parseInt(durationControl.value);
      if (priorityControl && priorityControl.value && parseInt(priorityControl.value) !== taskPriority) updates.priority = parseInt(priorityControl.value);
      if (isRecurringTask && dueDateControl && dueDateControl.value) { const newDueDate = new Date(dueDateControl.value).toISOString(); if (newDueDate !== dueDate) updates.next_due = newDueDate; }
      if (assignmentControl && assignmentControl.value !== assignedTo) updates.assigned_to = assignmentControl.value;
      if (energyInput && parseInt(energyInput.value) !== (task.energy_cost ?? 2)) updates.energy_cost = parseInt(energyInput.value);
      if (focusInput && parseInt(focusInput.value) !== (task.focus_cost ?? 2)) updates.focus_cost = parseInt(focusInput.value);
      if (painInput && parseInt(painInput.value) !== (task.pain_cost ?? 0)) updates.pain_cost = parseInt(painInput.value);
      if (motivationInput && parseInt(motivationInput.value) !== (task.motivation_boost ?? 0)) updates.motivation_boost = parseInt(motivationInput.value);
      if (severitySelect && parseInt(severitySelect.value) !== (task.overdue_severity ?? 2)) updates.overdue_severity = parseInt(severitySelect.value);
      if (Object.keys(updates).length > 0) { try { await onSave(updates); closeModal(); } catch (error) {} } else { closeModal(); }
    });
  }

  if (editButton && onEdit) { editButton.addEventListener('click', () => { closeModal(); setTimeout(() => { onEdit(task); }, 220); }); }

  completeButton.addEventListener('click', async () => { const notesVal = completionNotesTextarea.value.trim(); try { await onComplete(notesVal); closeModal(); } catch (error) {} });

  completedAlreadyButton.addEventListener('click', () => { pastCompletionSection.classList.remove('tt-hidden'); buttonContainer.classList.add('tt-hidden'); });

  if (snoozeButton && onSnooze) { snoozeButton.addEventListener('click', () => { snoozeSection.classList.remove('tt-hidden'); buttonContainer.classList.add('tt-hidden'); }); }

  yesterdayButton.addEventListener('click', async () => {
    const notesVal = completionNotesTextarea.value.trim(); const d = new Date(); d.setDate(d.getDate() - 1);
    try { await onComplete(notesVal, d.toISOString()); closeModal(); } catch (error) {}
  });

  customDateButton.addEventListener('click', () => { customDateContainer.classList.remove('tt-hidden'); quickOptionsContainer.classList.add('tt-hidden'); });

  cancelPastButton.addEventListener('click', () => { pastCompletionSection.classList.add('tt-hidden'); buttonContainer.classList.remove('tt-hidden'); customDateContainer.classList.add('tt-hidden'); quickOptionsContainer.classList.remove('tt-hidden'); });

  confirmPastButton.addEventListener('click', async () => {
    const notesVal = completionNotesTextarea.value.trim(); const completedAtValue = customDateInput.value;
    if (!completedAtValue) { showError('Please select a completion date and time'); return; }
    const completedAtIso = new Date(completedAtValue).toISOString();
    try { await onComplete(notesVal, completedAtIso); closeModal(); } catch (error) {}
  });

  if (onSnooze) {
    tomorrowButton.addEventListener('click', async () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); try { await onSnooze(d.toISOString()); closeModal(); } catch (error) {} });
    customSnoozeButton.addEventListener('click', () => { customSnoozeContainer.classList.remove('tt-hidden'); snoozeQuickOptionsContainer.classList.add('tt-hidden'); });
    cancelSnoozeButton.addEventListener('click', () => { snoozeSection.classList.add('tt-hidden'); buttonContainer.classList.remove('tt-hidden'); customSnoozeContainer.classList.add('tt-hidden'); snoozeQuickOptionsContainer.classList.remove('tt-hidden'); });
    confirmSnoozeButton.addEventListener('click', async () => { const val = customSnoozeInput.value; if (!val) { showError('Please select a snooze date and time'); return; } const iso = new Date(val).toISOString(); if (new Date(iso) <= new Date()) { showError('Snooze time must be in the future'); return; } try { await onSnooze(iso); closeModal(); } catch (error) {} });
  }

  setTimeout(() => { modal.classList.add('tt-modal--visible'); }, 10);
  return modal;
}
