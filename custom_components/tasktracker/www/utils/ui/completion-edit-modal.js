import { TaskTrackerStyles } from '../../tasktracker-styles.js';
import { createStyledButton } from './components.js';
import { formatDateTimeForInput } from '../formatters.js';
import { getUserDisplayName } from '../users.js';

// Completion edit modal (real implementation)
// Mirrors the previous TaskTrackerUtils.createCompletionEditModal behavior
export function createCompletionEditModal(
  completion,
  config,
  onDelete,
  onUpdate,
  availableUsers = [],
  enhancedUsers = null,
  userContext = null,
) {
  TaskTrackerStyles.ensureGlobal();
  const modal = document.createElement('div');
  modal.className = 'tt-modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'tt-modal__content tt-modal__content--w-450';

  const taskName = completion.task_name || completion.name;
  const completedBy = completion.completed_by;
  const completedAt = completion.completed_at;
  const notes = completion.notes || '';

  // Header
  const header = document.createElement('div');
  header.className = 'tt-modal__header';
  const title = document.createElement('h3');
  title.textContent = 'Edit Completion';
  title.className = 'tt-modal__title';
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.className = 'tt-modal__close';
  header.appendChild(title);
  header.appendChild(closeButton);

  // Task name
  const taskNameField = document.createElement('div');
  taskNameField.className = 'tt-section';
  const taskNameLabel = document.createElement('label');
  taskNameLabel.textContent = 'Task Name';
  taskNameLabel.className = 'tt-label';
  const taskNameValue = document.createElement('div');
  taskNameValue.textContent = taskName;
  taskNameValue.className = 'tt-box';
  taskNameField.appendChild(taskNameLabel);
  taskNameField.appendChild(taskNameValue);

  // Completed by
  const completedByField = document.createElement('div');
  completedByField.className = 'tt-section';
  const completedByLabel = document.createElement('label');
  completedByLabel.textContent = 'Completed By';
  completedByLabel.className = 'tt-label';

  let completedByControl;
  if (availableUsers && availableUsers.length > 0) {
    completedByControl = document.createElement('select');
    completedByControl.className = 'tt-select';
    availableUsers.forEach(username => {
      const optionElement = document.createElement('option');
      optionElement.value = username;
      optionElement.textContent = getUserDisplayName(username, enhancedUsers);
      optionElement.selected = username === completedBy;
      completedByControl.appendChild(optionElement);
    });
  } else {
    completedByControl = document.createElement('div');
    completedByControl.textContent = getUserDisplayName(completedBy, enhancedUsers);
    completedByControl.className = 'tt-box';
  }
  completedByField.appendChild(completedByLabel);
  completedByField.appendChild(completedByControl);

  // Completed at
  const completedAtField = document.createElement('div');
  completedAtField.className = 'tt-section';
  const completedAtLabel = document.createElement('label');
  completedAtLabel.textContent = 'Completed At';
  completedAtLabel.className = 'tt-label';
  const completedAtInput = document.createElement('input');
  completedAtInput.type = 'datetime-local';
  completedAtInput.className = 'tt-input';
  if (completedAt) {
    completedAtInput.value = formatDateTimeForInput(completedAt);
  }
  completedAtField.appendChild(completedAtLabel);
  completedAtField.appendChild(completedAtInput);

  // Notes
  const notesField = document.createElement('div');
  notesField.className = 'tt-section';
  const notesLabel = document.createElement('label');
  notesLabel.textContent = 'Notes';
  notesLabel.className = 'tt-label';
  const notesTextarea = document.createElement('textarea');
  notesTextarea.value = notes;
  notesTextarea.placeholder = 'Add notes about this completion...';
  notesTextarea.className = 'tt-textarea';
  notesField.appendChild(notesLabel);
  notesField.appendChild(notesTextarea);

  // Buttons
  const buttonContainer = document.createElement('div');
  buttonContainer.className = 'tt-justify-between tt-mt-24';
  const undoButton = createStyledButton('Undo Completion', 'error');
  const rightButtons = document.createElement('div');
  rightButtons.className = 'tt-flex-row tt-gap-8';
  const cancelButton = createStyledButton('Cancel');
  const updateButton = createStyledButton('Update');
  rightButtons.appendChild(cancelButton);
  rightButtons.appendChild(updateButton);
  buttonContainer.appendChild(undoButton);
  buttonContainer.appendChild(rightButtons);

  // Assemble
  modalContent.appendChild(header);
  modalContent.appendChild(taskNameField);
  modalContent.appendChild(completedByField);
  modalContent.appendChild(completedAtField);
  modalContent.appendChild(notesField);
  modalContent.appendChild(buttonContainer);
  modal.appendChild(modalContent);

  const closeModal = () => {
    if (modal.parentNode) {
      modal.classList.remove('tt-modal--visible');
      setTimeout(() => {
        if (modal.parentNode) {
          modal.parentNode.removeChild(modal);
        }
      }, 200);
    }
  };

  // Events
  closeButton.addEventListener('click', closeModal);
  cancelButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  const escapeHandler = (e) => {
    if (e.key === 'Escape') {
      closeModal();
      document.removeEventListener('keydown', escapeHandler);
    }
  };
  document.addEventListener('keydown', escapeHandler);

  undoButton.addEventListener('click', async () => {
    try {
      await onDelete();
      closeModal();
    } catch (error) {
      // handled upstream
    }
  });

  updateButton.addEventListener('click', async () => {
    const updates = {};
    if (availableUsers && availableUsers.length > 0 && completedByControl.value !== completedBy) {
      updates.completed_by = completedByControl.value;
    }
    if (notesTextarea.value !== notes) {
      updates.notes = notesTextarea.value;
    }
    if (completedAtInput && completedAtInput.value) {
      const newCompletedAtIso = new Date(completedAtInput.value).toISOString();
      if (newCompletedAtIso !== completedAt) {
        updates.completed_at = newCompletedAtIso;
      }
    }
    if (Object.keys(updates).length > 0) {
      try {
        await onUpdate(updates);
        closeModal();
      } catch (error) {
        // handled upstream
      }
    } else {
      closeModal();
    }
  });

  setTimeout(() => { modal.classList.add('tt-modal--visible'); }, 10);
  return modal;
}
