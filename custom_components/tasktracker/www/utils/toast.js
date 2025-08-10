import { TaskTrackerStyles } from '../tasktracker-styles.js';

export function showSuccess(message) {
  TaskTrackerStyles.ensureGlobal();
  const toast = document.createElement('div');
  toast.className = 'tt-toast tt-toast--success';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('tt-show'));
  setTimeout(() => toast.remove(), 3000);
}

export function showError(message) {
  TaskTrackerStyles.ensureGlobal();
  const toast = document.createElement('div');
  toast.className = 'tt-toast tt-toast--error';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('tt-show'));
  setTimeout(() => toast.remove(), 5000);
}
