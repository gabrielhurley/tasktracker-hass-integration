/**
 * TaskTracker Task Editor Component
 *
 * A comprehensive, reusable task editing modal that supports all task types
 * (RecurringTask, AdHocTask, SelfCareTask) and all editable fields.
 */

import { TaskTrackerStyles } from '../styles.js';
import { showModal, createStyledButton } from './components.js';
import { showSuccess, showError } from '../toast.js';

export class TaskTrackerTaskEditor {
  static openEditModal(task, config, onSave, availableUsers = [], enhancedUsers = null) {
    const modal = this.createTaskEditModal(task, config, onSave, availableUsers, enhancedUsers);
    showModal(modal);
    return modal;
  }

  static createTaskEditModal(task, config, onSave, availableUsers = [], enhancedUsers = null) {
    TaskTrackerStyles.ensureGlobal();
    const modal = document.createElement('div');
    modal.className = 'tt-modal';

    const modalContent = document.createElement('div');
    modalContent.className = 'tt-modal__content tt-modal__content--w-600';

    // Modal header
    const header = document.createElement('div');
    header.className = 'tt-modal__header';

    const title = document.createElement('h3');
    title.textContent = `Edit ${task.task_type}: ${task.name}`;
    title.className = 'tt-modal__title';

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '&times;';
    closeButton.className = 'tt-modal__close';

    header.appendChild(title);
    header.appendChild(closeButton);

    // Form container
    const form = document.createElement('form');
    form.className = 'tt-form';

    // Create form sections
    const sections = this.createFormSections(task, availableUsers, enhancedUsers);
    sections.forEach(section => form.appendChild(section));

    // Modal footer
    const footer = document.createElement('div');
    footer.className = 'tt-flex-end tt-gap-12 tt-mt-24';

    const cancelButton = createStyledButton('Cancel');
    cancelButton.type = 'button';

    const saveButton = createStyledButton('Save Changes');
    saveButton.type = 'submit';

    footer.appendChild(cancelButton);
    footer.appendChild(saveButton);

    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(form);
    modalContent.appendChild(footer);
    modal.appendChild(modalContent);

    // Event handlers
    const closeModal = () => {
      if (modal.parentNode) {
        modal.classList.remove('tt-modal--visible');
        setTimeout(() => {
          if (modal.parentNode) modal.parentNode.removeChild(modal);
        }, 200);
      }
      document.removeEventListener('keydown', escapeHandler);
    };

    const escapeHandler = (e) => {
      if (e.key === 'Escape') {
        closeModal();
      }
    };

    closeButton.addEventListener('click', closeModal);
    cancelButton.addEventListener('click', closeModal);

    // Save handler - direct implementation instead of relying on form submission
    const handleSave = async () => {
      try {
        const updates = this.collectFormData(form, task);
        if (Object.keys(updates).length > 0) {
          await onSave(task, updates);
          showSuccess('Task updated successfully');
        } else {
          showSuccess('No changes detected');
        }
        closeModal();
      } catch (error) {
        console.error('Failed to save task:', error);
        showError(`Failed to save task: ${error.message}`);
      }
    };

    // Save button click handler
    saveButton.addEventListener('click', async (e) => {
      e.preventDefault();
      e.stopPropagation();
      await handleSave();
    });

    modal.addEventListener('click', (e) => {
      if (e.target === modal) {
        closeModal();
      }
    });

    document.addEventListener('keydown', escapeHandler);

    // Form submission handler (for Enter key support)
    form.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSave();
    });

    return modal;
  }

  static createFormSections(task, availableUsers, enhancedUsers) {
    const sections = [];

    // Basic Information Section
    sections.push(this.createSection('Basic Information', [
      this.createTextField('name', 'Task Name', task.name),
      this.createCheckboxField('is_active', 'Active', task.is_active !== false),
      this.createNumberField('duration_minutes', 'Duration (minutes)', task.duration_minutes, 5, 480),
    ]));

    // Priority Information Section
    sections.push(this.createSection('Priority', [
      this.createSelectField('priority', 'Priority', task.priority_value, [
        { value: 1, label: 'High (1)' },
        { value: 2, label: 'Medium (2)' },
        { value: 3, label: 'Low (3)' }
      ]),
      this.createSelectField('overdue_severity', 'Overdue Severity', task.overdue_severity, [
        { value: 1, label: 'Minor (1)' },
        { value: 2, label: 'Important (2)' },
        { value: 3, label: 'Critical (3)' }
      ]),
    ]));

    // Frequency Section (for RecurringTask and SelfCareTask)
    if (task.task_type === 'RecurringTask' || task.task_type === 'SelfCareTask') {
      const frequencyFields = [
        this.createNumberField('frequency_value', 'Frequency Value', task.frequency_value, 1, 365),
        this.createSelectField('frequency_unit', 'Frequency Unit', task.frequency_unit, [
          { value: 'days', label: 'Days' },
          { value: 'weeks', label: 'Weeks' },
          { value: 'months', label: 'Months' },
          { value: 'years', label: 'Years' }
        ]),
      ];

      if (task.due_date) {
        frequencyFields.push(this.createDateTimeField('next_due', 'Next Due', task.due_date));
      }

      sections.push(this.createSection('Frequency', frequencyFields));
    }

    // SelfCare Specific Section
    if (task.task_type === 'SelfCareTask') {
      sections.push(this.createSection('Self-Care Settings', [
        this.createSelectField('level', 'Level', task.level, [
          { value: 1, label: 'Must Do (1)' },
          { value: 2, label: 'Should Do (2)' },
          { value: 3, label: 'Can Do (3)' }
        ]),
        this.createNumberField('required_occurrences', 'Required Occurrences', task.required_occurrences || 1, 1, 10),
      ]));
    }

    // Task Fit Section
    sections.push(this.createSection('Task Fit', [
      this.createNumberField('impact', 'Impact (0-5)', task.impact ?? 1, 0, 5),
      this.createNumberField('satisfaction', 'Satisfaction (0-5)', task.satisfaction ?? 1, 0, 5),
      this.createNumberField('energy_cost', 'Energy Cost (1-5)', task.energy_cost ?? 2, 1, 5),
      this.createNumberField('focus_cost', 'Focus Cost (1-5)', task.focus_cost ?? 2, 1, 5),
      this.createNumberField('pain_cost', 'Pain Cost (0-5)', task.pain_cost ?? 0, 0, 5),
      this.createNumberField('motivation_boost', 'Motivation Boost (-5 to +5)', task.motivation_boost ?? 0, -5, 5),
    ]));

    // Constraints Section
    const constraintFields = [
      this.createSelectField('suitable_after_hours', 'Suitable After Hours', task.suitable_after_hours, [
        { value: 'yes', label: 'Yes' },
        { value: 'if_necessary', label: 'If Necessary' },
        { value: 'absolutely_not', label: 'Absolutely Not' }
      ]),
      this.createCheckboxField('requires_fair_weather', 'Requires Fair Weather', task.requires_fair_weather, true),
      this.createMultiSelectField('allowed_days', 'Allowed Days', task.allowed_days || [], [
        { value: 0, label: 'Monday' },
        { value: 1, label: 'Tuesday' },
        { value: 2, label: 'Wednesday' },
        { value: 3, label: 'Thursday' },
        { value: 4, label: 'Friday' },
        { value: 5, label: 'Saturday' },
        { value: 6, label: 'Sunday' }
      ], true),
    ];

    sections.push(this.createSection('Constraints', constraintFields));

    // Assignment Section (if multiple users available)
    if (availableUsers && availableUsers.length > 1) {
      const userOptions = availableUsers.map(username => ({ value: username, label: username }));
      sections.push(this.createSection('Assignment', [
        this.createSelectField('assigned_to', 'Assigned To', task.assigned_to, userOptions)
      ]));
    }

    // Tags Section
    sections.push(this.createSection('Tags', [
      this.createTagsField('tags', 'Tags', task.tags ?? [], true),
      this.createTextAreaField('notes', 'Notes', task.notes ?? '', true)
    ]));

    return sections;
  }

  static createSection(title, fields) {
    const section = document.createElement('div');
    section.className = 'tt-box';

    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = title;
    sectionTitle.className = 'tt-box-title';

    const fieldsContainer = document.createElement('div');
    fieldsContainer.className = 'tt-grid-auto';

    section.appendChild(sectionTitle);
    section.appendChild(fieldsContainer);

    fields.forEach(field => {
      if (field) fieldsContainer.appendChild(field);
    });

    return section;
  }

  static createTextField(name, label, value, fullWidth = false) {
    return this.createFieldWrapper(name, label, () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = name;
      input.value = value ?? '';
      this.styleInput(input);
      return input;
    }, fullWidth);
  }

  static createTextAreaField(name, label, value, fullWidth = false) {
    return this.createFieldWrapper(name, label, () => {
      const textarea = document.createElement('textarea');
      textarea.name = name;
      textarea.value = value ?? '';
      textarea.rows = 3;
      this.styleInput(textarea);
      return textarea;
    }, fullWidth);
  }

  static createNumberField(name, label, value, min, max, fullWidth = false) {
    return this.createFieldWrapper(name, label, () => {
      const input = document.createElement('input');
      input.type = 'number';
      input.name = name;
      input.value = value ?? '';
      if (min !== undefined) input.min = min;
      if (max !== undefined) input.max = max;
      this.styleInput(input);
      return input;
    }, fullWidth);
  }

  static createSelectField(name, label, value, options, fullWidth = false) {
    return this.createFieldWrapper(name, label, () => {
      const select = document.createElement('select');
      select.name = name;
      this.styleInput(select);

      // Add empty option if value is null/undefined
      if (value === null || value === undefined) {
        const emptyOption = document.createElement('option');
        emptyOption.value = '';
        emptyOption.textContent = '-- Select --';
        select.appendChild(emptyOption);
      }

      options.forEach(option => {
        const optionElement = document.createElement('option');
        optionElement.value = option.value;
        optionElement.textContent = option.label;
        optionElement.selected = option.value == value;
        select.appendChild(optionElement);
      });

      return select;
    }, fullWidth);
  }

  static createCheckboxField(name, label, checked, fullWidth = false) {
    return this.createFieldWrapper(name, label, () => {
      const input = document.createElement('input');
      input.type = 'checkbox';
      input.name = name;
      input.checked = checked;
      input.className = 'tt-checkbox';
      return input;
    }, fullWidth);
  }

  static createDateTimeField(name, label, value, fullWidth = false) {
    return this.createFieldWrapper(name, label, () => {
      const input = document.createElement('input');
      input.type = 'datetime-local';
      input.name = name;
      if (value) {
        // Convert ISO string to datetime-local format
        const date = new Date(value);
        const localDateTime = new Date(date.getTime() - (date.getTimezoneOffset() * 60000))
          .toISOString().slice(0, 16);
        input.value = localDateTime;
      }
      this.styleInput(input);
      return input;
    }, fullWidth);
  }

  static createMultiSelectField(name, label, values, options, fullWidth = false) {
    return this.createFieldWrapper(name, label, () => {
      const container = document.createElement('div');
      container.className = 'tt-multiselect';

      options.forEach(option => {
        const label = document.createElement('label');
        label.className = 'tt-flex-row tt-gap-4';

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = `${name}[]`;
        checkbox.value = option.value;
        checkbox.checked = values.includes(option.value);
        checkbox.className = 'tt-checkbox';

        label.appendChild(checkbox);
        label.appendChild(document.createTextNode(option.label));
        container.appendChild(label);
      });

      return container;
    }, fullWidth);
  }

  static createTagsField(name, label, tags, fullWidth = false) {
    return this.createFieldWrapper(name, label, () => {
      const input = document.createElement('input');
      input.type = 'text';
      input.name = name;
      input.value = tags.join(', ');
      input.placeholder = 'Enter tags separated by commas';
      this.styleInput(input);
      return input;
    }, fullWidth);
  }

  static createFieldWrapper(name, label, inputCreator, fullWidth = false) {
    const wrapper = document.createElement('div');
    wrapper.className = 'tt-form-row';
    if (fullWidth) wrapper.classList.add('tt-col-span-full');

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.className = 'tt-label';

    const input = inputCreator();
    input.setAttribute('data-field', name);

    wrapper.appendChild(labelElement);
    wrapper.appendChild(input);

    return wrapper;
  }

  static styleInput(input) {
    // Apply shared input classes
    if (input.tagName === 'SELECT') {
      input.className = 'tt-select';
    } else if (input.tagName === 'TEXTAREA') {
      input.className = 'tt-textarea';
    } else {
      input.className = 'tt-input';
    }
  }

  static collectFormData(form, originalTask) {
    const updates = {};
    const formData = new FormData(form);

    // Helper to compare values and add to updates if changed
    const addIfChanged = (key, newValue, originalValue) => {
      if (newValue !== originalValue && newValue !== '' && newValue !== null) {
        updates[key] = newValue;
      }
    };

    // Basic fields
    addIfChanged('name', formData.get('name'), originalTask.name);
    addIfChanged('notes', formData.get('notes'), originalTask.notes || '');

    // Number fields
    const numberFields = [
      'priority', 'duration_minutes', 'energy_cost', 'focus_cost', 'pain_cost',
      'motivation_boost', 'satisfaction', 'impact', 'frequency_value',
      'level', 'required_occurrences', 'overdue_severity'
    ];

    numberFields.forEach(field => {
      const value = formData.get(field);
      if (value !== null && value !== '') {
        const numValue = parseInt(value, 10);
        const originalValue = originalTask[field] ?? (field.includes('cost') || field.includes('satisfaction') || field.includes('impact') ? 1 :
                                                       field === 'motivation_boost' ? 0 : undefined);
        if (numValue !== originalValue) {
          updates[field] = numValue;
        }
      }
    });

    // String fields
    const stringFields = ['frequency_unit', 'suitable_after_hours', 'assigned_to'];
    stringFields.forEach(field => {
      const value = formData.get(field);
      if (value && value !== originalTask[field]) {
        updates[field] = value;
      }
    });

    // Boolean fields
    const booleanFields = ['is_active', 'requires_fair_weather'];
    booleanFields.forEach(field => {
      const checked = formData.get(field) === 'on';
      const originalValue = originalTask[field] !== false;
      if (checked !== originalValue) {
        updates[field] = checked;
      }
    });

    // DateTime field
    const nextDue = formData.get('next_due');
    if (nextDue) {
      const dateTime = new Date(nextDue).toISOString();
      if (dateTime !== originalTask.due_date) {
        updates.next_due = dateTime;
      }
    }

    // Multi-select fields (allowed_days)
    const allowedDays = formData.getAll('allowed_days[]').map(day => parseInt(day, 10));
    const originalAllowedDays = originalTask.allowed_days || [];
    if (JSON.stringify(allowedDays.sort()) !== JSON.stringify(originalAllowedDays.sort())) {
      updates.allowed_days = allowedDays;
    }

    // Tags field
    const tagsValue = formData.get('tags');
    if (tagsValue !== null) {
      const tags = tagsValue.split(',').map(tag => tag.trim()).filter(tag => tag);
      const originalTags = originalTask.tags || [];
      if (JSON.stringify(tags.sort()) !== JSON.stringify(originalTags.sort())) {
        updates.tags = tags;
      }
    }

    return updates;
  }
}