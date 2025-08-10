import { TaskTrackerStyles } from '../../tasktracker-styles.js';

export function createStyledButton(text, type = 'default', onClick = null) {
  const button = document.createElement('button');
  button.textContent = text;
  TaskTrackerStyles.ensureGlobal();
  button.className = 'tt-btn';
  if (type === 'error') button.classList.add('tt-btn--error');
  if (type === 'link') button.classList.add('tt-btn--link');
  if (onClick) button.addEventListener('click', onClick);
  return button;
}

export function showModal(modal) {
  TaskTrackerStyles.ensureGlobal();
  document.querySelectorAll('.tt-modal').forEach((existing) => {
    if (existing !== modal) existing.remove();
  });
  document.body.appendChild(modal);
  if (modal.classList && modal.classList.contains('tt-modal')) {
    modal.classList.add('tt-modal--visible');
  }
  requestAnimationFrame(() => {
    if (modal.classList && modal.classList.contains('tt-modal')) {
      modal.classList.add('tt-modal--visible');
    }
  });
}
