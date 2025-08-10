export function createConfigRow(label, description, inputHtml) {
  const desc = description ? `<div class="config-description">${description}</div>` : '';
  return `\n      <div class="config-row">\n        <label>\n          ${label}\n          ${desc}\n        </label>\n        ${inputHtml}\n      </div>\n    `;
}

export function createNumberInput(value, configKey, min = null, max = null, step = null) {
  const displayValue = (value === null || value === undefined) ? '' : value;
  const attrs = [
    `value="${displayValue}"`,
    `data-config-key="${configKey}"`,
    min !== null ? `min="${min}"` : '',
    max !== null ? `max="${max}"` : '',
    step !== null ? `step="${step}"` : '',
  ].filter(Boolean).join(' ');
  return `<input type="number" ${attrs} />`;
}

export function createTextInput(value, configKey, placeholder = '') {
  return `\n      <input type="text" value="${value || ''}" data-config-key="${configKey}" placeholder="${placeholder}" />\n    `;
}

export function createCheckboxInput(checked, configKey) {
  return `\n      <input type="checkbox" ${checked ? 'checked' : ''} data-config-key="${configKey}" />\n    `;
}

export function createSelectInput(value, configKey, options) {
  const optionsHtml = options.map(option => {
    const optionValue = typeof option === 'string' ? option : option.value;
    const optionLabel = typeof option === 'string' ? option : option.label;
    const selected = value === optionValue ? 'selected' : '';
    return `<option value="${optionValue}" ${selected}>${optionLabel}</option>`;
  }).join('');
  return `<select data-config-key="${configKey}">${optionsHtml}</select>`;
}

export function getCommonConfigStyles() {
  return `
      .card-config { display: flex; flex-direction: column; gap: 16px; padding: 16px; }
      .config-row { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
      .config-row label { flex: 1; font-weight: 500; color: var(--primary-text-color); }
      .config-row input, .config-row select { flex: 0 0 auto; min-width: 120px; padding: 8px 12px; border: 1px solid var(--divider-color); border-radius: 4px; background: var(--card-background-color); color: var(--primary-text-color); font-family: inherit; }
      .config-row input[type="checkbox"] { min-width: auto; width: 20px; height: 20px; }
      .config-row input[type="number"] { width: 80px; }
      .config-description { font-size: 0.85em; color: var(--secondary-text-color); margin-top: 4px; font-style: italic; }
      .section-title { font-size: 1.1em; font-weight: 600; color: var(--primary-text-color); margin-top: 16px; margin-bottom: 8px; padding-bottom: 4px; border-bottom: 1px solid var(--divider-color); }
      .section-title:first-child { margin-top: 0; }
    `;
}

export function handleConfigValueChange() {
  // Stub for editor debounced updates
}
