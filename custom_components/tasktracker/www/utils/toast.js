export function showSuccess(message) {
  const toast = document.createElement('div');
  toast.className = 'tt-toast tt-toast--success';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('tt-show'));
  setTimeout(() => toast.remove(), 3000);
}

export function showError(message) {
  const toast = document.createElement('div');
  toast.className = 'tt-toast tt-toast--error';
  toast.textContent = message;
  document.body.appendChild(toast);
  requestAnimationFrame(() => toast.classList.add('tt-show'));
  setTimeout(() => toast.remove(), 5000);
}
