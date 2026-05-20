import { useEffect, useState } from 'react';
import { announce } from './LiveRegion';

export type ToastType = 'success' | 'error' | 'warning' | 'info';

interface ToastProps {
  message: string;
  type?: ToastType;
  duration?: number;
  onClose: () => void;
}

export function Toast({
  message,
  type = 'info',
  duration = 3000,
  onClose,
}: ToastProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      setTimeout(onClose, 300);
    }, duration);

    return () => clearTimeout(timer);
  }, [duration, onClose]);

  const icons = {
    success: '✓',
    error: '✕',
    warning: '⚠',
    info: 'ℹ',
  };

  const colors = {
    success: 'bg-green-600',
    error: 'bg-red-600',
    warning: 'bg-amber-600',
    info: 'bg-blue-600',
  };

  return (
    <div
      role="status"
      aria-live="polite"
      className={`
        ${colors[type]}
        text-white px-4 py-3 rounded-lg shadow-lg
        flex items-center transition-all duration-300
        ${isVisible ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-2'}
      `}
    >
      <span className="font-semibold mr-2">{icons[type]}</span>
      <span className="flex-1">{message}</span>
      <button
        onClick={() => {
          setIsVisible(false);
          setTimeout(onClose, 300);
        }}
        className="ml-2 hover:bg-white/20 rounded-full p-1 transition-colors"
        aria-label="Close notification"
        type="button"
      >
        ✕
      </button>
    </div>
  );
}

// Toast container for managing multiple toasts
interface ToastItem {
  id: string;
  message: string;
  type: ToastType;
  createdAt: number;
}

let toastId = 0;
const TOAST_DEDUPE_MS = 1200;
let toastListeners: Array<(toasts: ToastItem[]) => void> = [];
let currentToasts: ToastItem[] = [];

// Cleanup function for module unload
export function cleanupToastListeners(): void {
  toastListeners = [];
  currentToasts = [];
}

export function showToast(message: string, type: ToastType = 'info') {
  const now = Date.now();

  const duplicate = currentToasts.find(
    (toast) =>
      toast.message === message &&
      toast.type === type &&
      now - toast.createdAt < TOAST_DEDUPE_MS,
  );

  if (duplicate) {
    return;
  }

  const id = String(++toastId);
  const newToast: ToastItem = { id, message, type, createdAt: now };
  currentToasts = [...currentToasts, newToast];
  toastListeners.forEach((listener) => listener(currentToasts));
  announce(message);

  setTimeout(() => {
    removeToast(id);
  }, 3500);
}

function removeToast(id: string) {
  currentToasts = currentToasts.filter((t) => t.id !== id);
  toastListeners.forEach((listener) => listener(currentToasts));
}

export function useToasts() {
  const [toasts, setToasts] = useState(currentToasts);

  useEffect(() => {
    toastListeners.push(setToasts);

    return () => {
      const index = toastListeners.indexOf(setToasts);
      if (index > -1) {
        toastListeners.splice(index, 1);
      }
    };
  }, []);

  return { toasts, removeToast };
}

export function ToastContainer() {
  const { toasts, removeToast } = useToasts();

  return (
    <div className="fixed top-4 right-4 z-[100] space-y-2 max-w-sm">
      {toasts.map((toast) => (
        <Toast
          key={toast.id}
          message={toast.message}
          type={toast.type}
          onClose={() => removeToast(toast.id)}
        />
      ))}
    </div>
  );
}