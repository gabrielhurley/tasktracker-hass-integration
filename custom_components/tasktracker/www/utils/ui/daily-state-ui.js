// Shared Daily State UI for both modal and card
// Renders the quick preset grid and the advanced sliders identically in both contexts

export class TaskTrackerDailyStateUI {
  /**
   * Render the Daily State UI into a container
   *
   * options:
   * - mode: 'embedded' | 'modal' (controls presence of footer with Cancel/Save)
    * - state: { energy, motivation, focus, pain, mood, free_time, is_sick }
   * - hasExistingState: boolean
   * - showAdvanced: boolean
   * - useEmojiLabels: boolean
   * - saving: boolean
   * - presets: { [key: string]: { label: string, values: object | null } }
   * - getMoodLabel: (value: number) => string
   * - getFreeTimeLabel: (value: number) => string
   * - onSelectPreset: (presetKey: string) => void | Promise<void>
   * - onSave: () => void | Promise<void>
   * - onCancel?: () => void
   * - onToggleBackToSimple?: () => void
   * - onSliderChange: (axis: string, value: number) => void
   */
  static render(container, options) {
    let opts = { ...options };

    const renderSliderRow = (key, label, value, min, max, tooltip, isMood = false, isFreeTime = false) => {
      let displayValue = value;
      if (isMood) {
        displayValue = opts.getMoodLabel ? opts.getMoodLabel(value) : value;
      } else if (isFreeTime) {
        displayValue = opts.getFreeTimeLabel ? opts.getFreeTimeLabel(value) : value;
      }

      return `
        <div class="tt-ds-slider-row">
          <div class="tt-ds-slider-label">${label}</div>
          <div class="tt-ds-slider-container" aria-describedby="tooltip-${key}">
            <input class="tt-ds-range" type="range" min="${min}" max="${max}" step="1" value="${value}" data-axis="${key}">
            <div id="tooltip-${key}" class="tt-tooltip" role="tooltip" aria-hidden="true">${tooltip}</div>
          </div>
          <div class="tt-ds-slider-value">${displayValue}</div>
        </div>
      `;
    };

    const renderPresetButtons = () => {
      const presets = opts.presets || {};
      return Object.keys(presets).map(key => {
        const preset = presets[key];
        const isSelected = opts.hasExistingState && opts.currentPreset === key;
        return `
          <button class="tt-ds-preset-btn ${isSelected ? 'tt-selected' : ''}" data-preset="${key}" ${opts.saving ? 'disabled' : ''}>
            ${preset.label}
          </button>
        `;
      }).join('');
    };

    const updateTooltipPosition = (inputEl) => {
      const container = inputEl.closest('.tt-ds-slider-container');
      if (!container) return;
      const tooltip = container.querySelector('.tt-tooltip');
      if (!tooltip) return;
      const min = parseFloat(inputEl.min || '0');
      const max = parseFloat(inputEl.max || '100');
      const val = parseFloat(inputEl.value || String(min));
      const percent = max === min ? 0 : (val - min) / (max - min);
      tooltip.style.left = `calc(${(percent * 100).toFixed(2)}%)`;
      tooltip.setAttribute('aria-hidden', 'false');
    };

    const attachListeners = (root) => {
      // Preset buttons
      root.querySelectorAll('.tt-ds-preset-btn').forEach(btn => {
        btn.addEventListener('click', async (e) => {
          const presetKey = e.currentTarget.dataset.preset;
          if (opts.onSelectPreset) await opts.onSelectPreset(presetKey);
        });
      });

      // Advanced Save button (embedded inside advanced panel)
      const advSaveBtn = root.querySelector('.advanced-save-btn');
      if (advSaveBtn) {
        advSaveBtn.addEventListener('click', async () => {
          if (opts.onSave) await opts.onSave();
        });
      }

      // Back to simple / toggle buttons
      root.querySelectorAll('.back-to-simple, .advanced-toggle').forEach(btn => {
        btn.addEventListener('click', () => {
          if (opts.onToggleBackToSimple) opts.onToggleBackToSimple();
        });
      });

      // Sliders
      const sliders = root.querySelectorAll('input[type="range"]');
      sliders.forEach(slider => {
        // Initial position
        updateTooltipPosition(slider);

        slider.addEventListener('input', (e) => {
          const axis = e.target.dataset.axis;
          const val = parseInt(e.target.value);
          // Update tooltip and display locally for responsiveness
          updateTooltipPosition(e.target);
          const valueDisplay = e.target.closest('.tt-ds-slider-row')?.querySelector('.tt-ds-slider-value');
          if (valueDisplay) {
            if (axis === 'mood' && opts.getMoodLabel) {
              valueDisplay.textContent = opts.getMoodLabel(val);
            } else if (axis === 'free_time' && opts.getFreeTimeLabel) {
              valueDisplay.textContent = opts.getFreeTimeLabel(val);
            } else {
              valueDisplay.textContent = String(val);
            }
          }
          if (opts.onSliderChange) opts.onSliderChange(axis, val);
        });

        // Keyboard support
        slider.addEventListener('keydown', (e) => {
          if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
            e.preventDefault();
            const axis = e.target.dataset.axis;
            const currentVal = parseInt(e.target.value);
            const min = parseInt(e.target.min);
            const max = parseInt(e.target.max);
            let newVal = currentVal;
            if (e.key === 'ArrowLeft' && currentVal > min) {
              newVal = currentVal - 1;
            } else if (e.key === 'ArrowRight' && currentVal < max) {
              newVal = currentVal + 1;
            }
            e.target.value = newVal;
            updateTooltipPosition(e.target);
            if (opts.onSliderChange) opts.onSliderChange(axis, newVal);
          }
        });

        // Tooltip visibility
        slider.addEventListener('focus', (e) => updateTooltipPosition(e.target));
        slider.addEventListener('blur', (e) => {
          const container = e.target.closest('.tt-ds-slider-container');
          const tooltip = container?.querySelector('.tt-tooltip');
          if (tooltip) tooltip.setAttribute('aria-hidden', 'true');
        });
      });

      // Modal footer buttons if present
      const cancelBtn = root.querySelector('.tt-ds-modal-cancel');
      if (cancelBtn && opts.onCancel) {
        cancelBtn.addEventListener('click', () => opts.onCancel());
      }
      const saveBtn = root.querySelector('.tt-ds-modal-save');
      if (saveBtn) {
        saveBtn.addEventListener('click', async () => {
          if (opts.onSave) await opts.onSave();
        });
      }
    };

    const render = () => {
      const s = opts.state || { energy: 3, motivation: 3, focus: 3, pain: 1, mood: 0, free_time: 3, is_sick: false };

      container.innerHTML = `
        ${!opts.showAdvanced ? `
          <div class="tt-ds-quick-flow">
            <div class="tt-ds-quick-prompt">How are you feeling today?</div>
            <div class="tt-ds-preset-grid">
              ${renderPresetButtons()}
            </div>
          </div>
        ` : ''}

        ${opts.showAdvanced ? `
            <div class="tt-ds-advanced">
                <div class="tt-ds-button-row tt-flex-end">
                    <button class="tt-btn tt-btn--link back-to-simple">← Back to Simple</button>
                </div>
                ${renderSliderRow('energy', 'Energy', s.energy, 1, 5, 'Higher energy enables more demanding tasks')}
                ${renderSliderRow('motivation', 'Motivation', s.motivation, 1, 5, 'Higher motivation suggests more challenging tasks')}
                ${renderSliderRow('focus', 'Focus', s.focus, 1, 5, 'Higher focus enables detail-oriented work')}
                ${renderSliderRow('pain', 'Pain', s.pain, 1, 5, 'Higher pain reduces strenuous task suggestions')}
                ${renderSliderRow('mood', 'Mood', s.mood, -2, 2, 'Mood affects task type and difficulty recommendations', true)}
                ${renderSliderRow('free_time', 'Free Time', s.free_time, 1, 5, 'More free time allows longer task suggestions', false, true)}
                <div class="tt-form-row">
                  <label class="tt-ds-label">
                    <input type="checkbox" class="tt-checkbox" data-axis="is_sick" ${s.is_sick ? 'checked' : ''} /> I'm sick today
                  </label>
                </div>

            ${opts.mode === 'embedded' ? `
              <button class="complete-btn advanced-save-btn" ${opts.saving ? 'disabled' : ''}>
                ${opts.saving ? 'Saving...' : 'Save'}
              </button>
            ` : ''}
          </div>
        ` : ''}

        ${opts.mode === 'modal' ? `
          <div class="tt-ds-button-row">
            <div></div>
            <div class="tt-flex-row tt-gap-8">
              <button class="tt-btn tt-ds-modal-cancel">Cancel</button>
              <button class="tt-btn tt-btn--primary tt-ds-modal-save" ${opts.saving ? 'disabled' : ''}>${opts.saving ? 'Saving...' : 'Save'}</button>
            </div>
          </div>
        ` : ''}
      `;

      attachListeners(container);
      // Attach checkbox listener for is_sick
      const sickToggle = container.querySelector('input[type="checkbox"][data-axis="is_sick"]');
      if (sickToggle) {
        sickToggle.addEventListener('change', (e) => {
          if (opts.onSliderChange) opts.onSliderChange('is_sick', !!e.target.checked);
        });
      }
    };

    render();

    return {
      update(newOptions) {
        opts = { ...opts, ...newOptions };
        render();
      }
    };
  }
}
