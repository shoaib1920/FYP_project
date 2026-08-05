// Minimal pub-sub store behind the app-wide toast notifications — plain
// importable functions (not a hook/context) so any component, however
// deeply nested, can call `showToast(...)` without prop-drilling or being
// wrapped in a provider. `components/Toast` subscribes to render the queue.
let toasts = [];
let listeners = [];
let idCounter = 0;

const emit = () => listeners.forEach((listener) => listener(toasts));

export const subscribeToasts = (listener) => {
  listeners.push(listener);
  listener(toasts);
  return () => {
    listeners = listeners.filter((l) => l !== listener);
  };
};

export const dismissToast = (id) => {
  toasts = toasts.filter((t) => t.id !== id);
  emit();
};

/**
 * @param {string} message
 * @param {"success"|"error"|"warning"|"info"} type
 * @param {number} duration - ms before auto-dismiss; 0 disables auto-dismiss
 */
export const showToast = (message, type = "info", duration = 4500) => {
  const id = ++idCounter;
  toasts = [...toasts, { id, message, type }];
  emit();
  if (duration > 0) {
    setTimeout(() => dismissToast(id), duration);
  }
  return id;
};
