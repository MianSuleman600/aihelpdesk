import { ApiError } from './apiClient';

type ToastType = 'success' | 'error' | 'info' | 'warning';

interface ToastOptions {
  message: string;
  type?: ToastType;
  duration?: number;
}

let toastContainer: HTMLDivElement | null = null;

function getToastContainer(): HTMLDivElement {
  if (!toastContainer) {
    toastContainer = document.createElement('div');
    toastContainer.className = 'toast-container';
    toastContainer.style.cssText = `
      position: fixed;
      top: 20px;
      right: 20px;
      z-index: 9999;
      display: flex;
      flex-direction: column;
      gap: 10px;
      max-width: 400px;
    `;
    document.body.appendChild(toastContainer);
  }
  return toastContainer;
}

const colors = {
  success: { bg: 'rgba(16, 185, 129, 0.15)', border: 'rgba(16, 185, 129, 0.4)', text: '#34d399' },
  error: { bg: 'rgba(244, 63, 94, 0.15)', border: 'rgba(244, 63, 94, 0.4)', text: '#ff8a9b' },
  info: { bg: 'rgba(99, 102, 241, 0.15)', border: 'rgba(99, 102, 241, 0.4)', text: '#c0c1ff' },
  warning: { bg: 'rgba(245, 158, 11, 0.15)', border: 'rgba(245, 158, 11, 0.4)', text: '#fbbf24' },
};

function showToast({ message, type = 'info', duration = 5000 }: ToastOptions) {
  const container = getToastContainer();
  const toast = document.createElement('div');
  const color = colors[type];

  toast.style.cssText = `
    padding: 12px 16px;
    border-radius: 8px;
    background: ${color.bg};
    border: 1px solid ${color.border};
    color: ${color.text};
    font-size: 14px;
    font-weight: 500;
    box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
    animation: slideIn 0.3s ease-out;
    display: flex;
    align-items: center;
    gap: 10px;
  `;

  const icon = type === 'success' ? '✓' : type === 'error' ? '✕' : type === 'warning' ? '⚠' : 'ℹ';
  toast.innerHTML = `<span style="font-size: 16px">${icon}</span><span>${message}</span>`;

  container.appendChild(toast);

  setTimeout(() => {
    toast.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => toast.remove(), 300);
  }, duration);
}

function handleError(error: unknown): void {
  if (error instanceof ApiError) {
    if (error.errors) {
      Object.entries(error.errors).forEach(([field, messages]) => {
        showToast({ message: `${field}: ${messages.join(', ')}`, type: 'error' });
      });
    } else {
      showToast({ message: error.message, type: 'error' });
    }
  } else if (error instanceof Error) {
    showToast({ message: error.message, type: 'error' });
  } else {
    showToast({ message: 'An unexpected error occurred', type: 'error' });
  }
}

const style = document.createElement('style');
style.textContent = `
  @keyframes slideIn {
    from { opacity: 0; transform: translateX(100px); }
    to { opacity: 1; transform: translateX(0); }
  }
  @keyframes slideOut {
    from { opacity: 1; transform: translateX(0); }
    to { opacity: 0; transform: translateX(100px); }
  }
`;
document.head.appendChild(style);

export const toast = {
  success: (message: string) => showToast({ message, type: 'success' }),
  error: (message: string) => showToast({ message, type: 'error' }),
  info: (message: string) => showToast({ message, type: 'info' }),
  warning: (message: string) => showToast({ message, type: 'warning' }),
};

export { handleError };