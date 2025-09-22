export async function showSuccess(message) {
  // Ensure global styles are loaded before creating toast
  const existingStyles = document.getElementById('tt-global-styles');
  if (!existingStyles) {
    const { TaskTrackerStyles } = await import('./styles.js');
    TaskTrackerStyles.ensureGlobal();
  }

  const toast = document.createElement('div');
  toast.className = 'tt-toast tt-toast--success';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('tt-show'));
  setTimeout(() => toast.remove(), 3000);
}

export async function showError(message) {
  // Ensure global styles are loaded before creating toast
  const existingStyles = document.getElementById('tt-global-styles');
  if (!existingStyles) {
    const { TaskTrackerStyles } = await import('./styles.js');
    TaskTrackerStyles.ensureGlobal();
  }

  const toast = document.createElement('div');
  toast.className = 'tt-toast tt-toast--error';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('tt-show'));
  setTimeout(() => toast.remove(), 5000);
}
