/**
 * Imperative toast API (AdminPanel / sonner style).
 * ToastProvider registers the handler on mount.
 *
 * toast.success('Saved')
 * toast.error('Failed')
 * toast.warning('Check this')
 * toast.info('Heads up')
 */

let pushToast = null;

export function registerToastHandler(handler) {
  pushToast = handler;
  return () => {
    if (pushToast === handler) pushToast = null;
  };
}

function show(type, message, options = {}) {
  const text = typeof message === 'string' ? message.trim() : '';
  if (!text || !pushToast) return;
  pushToast({
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    message: text,
    duration: options.duration ?? 3200,
  });
}

export const toast = {
  success: (message, options) => show('success', message, options),
  error: (message, options) => show('error', message, options),
  warning: (message, options) => show('warning', message, options),
  info: (message, options) => show('info', message, options),
  /** Helper for `{ ok, error }` API-style results */
  fromResult: (result, successMessage) => {
    if (result?.ok) {
      if (successMessage) show('success', successMessage);
      return;
    }
    if (result?.error) show('error', result.error);
  },
};

export default toast;
