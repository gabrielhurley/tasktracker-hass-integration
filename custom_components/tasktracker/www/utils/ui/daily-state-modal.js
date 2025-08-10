import { TaskTrackerStyles } from '../../tasktracker-styles.js';
import { TaskTrackerDailyStateUI } from '../../tasktracker-daily-state-ui.js';
import {
  getDefaultDailyState,
  getPresetDailyStates,
  findMatchingDailyStatePreset,
  fetchDailyState,
  saveDailyState,
} from '../daily-state.js';
import { getMoodLabel, getFreeTimeLabel } from '../formatters.js';
import { showSuccess, showError } from '../toast.js';

// Daily State modal (real implementation)
export function createDailyStateModal(hass, username, config = {}, onSave = null) {
  TaskTrackerStyles.ensureGlobal();
  const modal = document.createElement('div');
  modal.className = 'tt-modal';

  const modalContent = document.createElement('div');
  modalContent.className = 'tt-modal__content';

  // Local state
  let currentState = getDefaultDailyState();
  let showAdvanced = false;
  let loading = true;
  let saving = false;
  let uiController = null;

  // Header
  const header = document.createElement('div');
  header.className = 'tt-modal__header';
  const title = document.createElement('h3');
  title.textContent = 'Set Your Daily State';
  title.className = 'tt-modal__title';
  const closeButton = document.createElement('button');
  closeButton.innerHTML = '&times;';
  closeButton.className = 'tt-modal__close';
  header.appendChild(title);
  header.appendChild(closeButton);

  // Content mount point
  const contentContainer = document.createElement('div');
  contentContainer.innerHTML = '<div class="tt-text-center tt-p-40 tt-text-muted">Loading...</div>';

  modalContent.appendChild(header);
  modalContent.appendChild(contentContainer);
  modal.appendChild(modalContent);

  const closeModal = () => {
    if (modal.parentNode) {
      modal.classList.remove('tt-modal--visible');
      setTimeout(() => {
        if (modal.parentNode) modal.parentNode.removeChild(modal);
      }, 200);
    }
  };

  const mountUI = () => {
    const presets = getPresetDailyStates();
    const currentPreset = findMatchingDailyStatePreset(currentState);
    const useEmoji = config.use_emoji_labels !== false;

    // Clear loading
    contentContainer.innerHTML = '';

    uiController = TaskTrackerDailyStateUI.render(contentContainer, {
      mode: 'modal',
      state: currentState,
      hasExistingState: !!currentState,
      currentPreset,
      showAdvanced,
      useEmojiLabels: useEmoji,
      saving,
      presets,
      getMoodLabel: (v) => getMoodLabel(v, useEmoji),
      getFreeTimeLabel: (v) => getFreeTimeLabel(v),
      onSelectPreset: async (presetKey) => {
        if (presetKey === 'complicated') {
          showAdvanced = true;
          uiController.update({ showAdvanced });
          return;
        }
        const preset = presets[presetKey];
        if (preset && preset.values) {
          try {
            saving = true; uiController.update({ saving });
            const ok = await saveDailyState(hass, username, preset.values);
            if (ok) {
              showSuccess('Daily state saved successfully!');
              if (onSave) onSave(preset.values);
              closeModal();
            } else {
              saving = false; uiController.update({ saving });
            }
          } catch (e) {
            saving = false; uiController.update({ saving });
            showError('Failed to save daily state');
          }
        }
      },
      onSave: async () => {
        try {
          saving = true; uiController.update({ saving });
          const ok = await saveDailyState(hass, username, currentState);
          if (ok) {
            showSuccess('Daily state saved successfully!');
            if (onSave) onSave(currentState);
            closeModal();
          } else {
            saving = false; uiController.update({ saving });
          }
        } catch (e) {
          saving = false; uiController.update({ saving });
          showError('Failed to save daily state');
        }
      },
      onCancel: closeModal,
      onToggleBackToSimple: () => {
        showAdvanced = false;
        uiController.update({ showAdvanced });
      },
      onSliderChange: (axis, value) => {
        currentState = { ...currentState, [axis]: value };
      },
    });
  };

  const loadState = async () => {
    loading = true;
    try {
      const existing = await fetchDailyState(hass, username);
      if (existing) {
        currentState = existing;
        const matchingPreset = findMatchingDailyStatePreset(currentState);
        showAdvanced = matchingPreset === 'complicated';
      }
    } catch (e) {
      // ignore, use defaults
    }
    loading = false;
    mountUI();
  };

  // Events
  closeButton.addEventListener('click', closeModal);
  modal.addEventListener('click', (e) => { if (e.target === modal) closeModal(); });
  const escapeHandler = (e) => { if (e.key === 'Escape') { closeModal(); document.removeEventListener('keydown', escapeHandler); } };
  document.addEventListener('keydown', escapeHandler);

  // Initialize
  loadState();
  setTimeout(() => { modal.classList.add('tt-modal--visible'); }, 10);
  return modal;
}
