/**
 * TaskTracker Task Editor Component
 *
 * A comprehensive, reusable task editing modal that supports all task types
 * (RecurringTask, AdHocTask, SelfCareTask) and all editable fields.
 */

import { TaskTrackerUtils } from './tasktracker-utils.js';

export class TaskTrackerTaskEditor {
  static openEditModal(task, config, onSave, availableUsers = [], enhancedUsers = null) {
    const modal = this.createTaskEditModal(task, config, onSave, availableUsers, enhancedUsers);
    TaskTrackerUtils.showModal(modal);
    return modal;
  }

  static createTaskEditModal(task, config, onSave, availableUsers = [], enhancedUsers = null) {
    const modal = document.createElement('div');
    modal.className = 'task-edit-modal';
    modal.style.cssText = `
      position: fixed;
      top: 0;
      left: 0;
      width: 100%;
      height: 100%;
      background: rgba(0, 0, 0, 0.5);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 1000;
    `;

    const modalContent = document.createElement('div');
    modalContent.className = 'task-edit-modal-content';
    modalContent.style.cssText = `
      background: var(--card-background-color, white);
      border-radius: 8px;
      padding: 24px;
      width: 90%;
      max-width: 600px;
      max-height: 80vh;
      overflow-y: auto;
      box-shadow: 0 4px 12px rgba(0, 0, 0, 0.15);
    `;

    // Modal header
    const header = document.createElement('div');
    header.style.cssText = `
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 20px;
      border-bottom: 1px solid var(--divider-color, #e0e0e0);
      padding-bottom: 16px;
    `;

    const title = document.createElement('h3');
    title.textContent = `Edit ${task.task_type}: ${task.name}`;
    title.style.cssText = `
      margin: 0;
      color: var(--primary-text-color, black);
      font-size: 18px;
    `;

    const closeButton = document.createElement('button');
    closeButton.innerHTML = '✕';
    closeButton.style.cssText = `
      background: none;
      border: none;
      font-size: 20px;
      cursor: pointer;
      color: var(--secondary-text-color, #666);
      padding: 4px;
    `;

    header.appendChild(title);
    header.appendChild(closeButton);

    // Form container
    const form = document.createElement('form');
    form.style.cssText = `
      display: grid;
      gap: 16px;
    `;

    // Create form sections
    const sections = this.createFormSections(task, availableUsers, enhancedUsers);
    sections.forEach(section => form.appendChild(section));

    // Modal footer
    const footer = document.createElement('div');
    footer.style.cssText = `
      display: flex;
      justify-content: flex-end;
      gap: 12px;
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--divider-color, #e0e0e0);
    `;

    const cancelButton = document.createElement('button');
    cancelButton.type = 'button';
    cancelButton.textContent = 'Cancel';
    cancelButton.style.cssText = `
      padding: 8px 16px;
      border: 1px solid var(--divider-color, #ccc);
      background: var(--card-background-color, white);
      color: var(--primary-text-color, black);
      border-radius: 4px;
      cursor: pointer;
    `;

    const saveButton = document.createElement('button');
    saveButton.type = 'submit';
    saveButton.textContent = 'Save Changes';
    saveButton.style.cssText = `
      padding: 8px 16px;
      border: none;
      background: var(--primary-color, #03a9f4);
      color: white;
      border-radius: 4px;
      cursor: pointer;
    `;

    footer.appendChild(cancelButton);
    footer.appendChild(saveButton);

    // Assemble modal
    modalContent.appendChild(header);
    modalContent.appendChild(form);
    modalContent.appendChild(footer);
    modal.appendChild(modalContent);

    // Event handlers
    const closeModal = () => {
      document.body.removeChild(modal);
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
          TaskTrackerUtils.showSuccess('Task updated successfully');
        } else {
          TaskTrackerUtils.showSuccess('No changes detected');
        }
        closeModal();
      } catch (error) {
        console.error('Failed to save task:', error);
        TaskTrackerUtils.showError(`Failed to save task: ${error.message}`);
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
    section.style.cssText = `
      border: 1px solid var(--divider-color, #e0e0e0);
      border-radius: 6px;
      padding: 16px;
      background: var(--secondary-background-color, #fafafa);
    `;

    const sectionTitle = document.createElement('h4');
    sectionTitle.textContent = title;
    sectionTitle.style.cssText = `
      margin: 0 0 12px 0;
      color: var(--primary-text-color, black);
      font-size: 14px;
      font-weight: 600;
    `;

    const fieldsContainer = document.createElement('div');
    fieldsContainer.style.cssText = `
      display: grid;
      gap: 12px;
      grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
    `;

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
      input.style.cssText = `
        width: auto;
        margin-right: 8px;
      `;
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
      container.style.cssText = `
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(120px, 1fr));
        gap: 8px;
        padding: 8px;
        border: 1px solid var(--divider-color, #ccc);
        border-radius: 4px;
        background: var(--card-background-color, white);
      `;

      options.forEach(option => {
        const label = document.createElement('label');
        label.style.cssText = `
          display: flex;
          align-items: center;
          font-size: 12px;
          cursor: pointer;
        `;

        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.name = `${name}[]`;
        checkbox.value = option.value;
        checkbox.checked = values.includes(option.value);
        checkbox.style.marginRight = '4px';

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
    wrapper.style.cssText = `
      display: flex;
      flex-direction: column;
      gap: 4px;
      align-items: flex-start;
      ${fullWidth ? 'grid-column: 1 / -1;' : ''}
    `;

    const labelElement = document.createElement('label');
    labelElement.textContent = label;
    labelElement.style.cssText = `
      font-size: 12px;
      font-weight: 500;
      color: var(--secondary-text-color, #666);
    `;

    const input = inputCreator();
    input.setAttribute('data-field', name);

    wrapper.appendChild(labelElement);
    wrapper.appendChild(input);

    return wrapper;
  }

  static styleInput(input) {
    input.style.cssText = `
      padding: 8px;
      border: 1px solid var(--divider-color, #ccc);
      border-radius: 4px;
      background: var(--card-background-color, white);
      color: var(--primary-text-color, black);
      font-size: 14px;
      width: 100%;
      box-sizing: border-box;
    `;
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