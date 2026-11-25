import React, { createContext, useCallback, useContext, useRef, useState } from 'react';
import ConfirmModal from '../components/common/ConfirmModal';

const ConfirmContext = createContext(null);

const DEFAULTS = {
  title: 'Are you sure?',
  message: 'This cannot be undone.',
  confirmLabel: 'Confirm',
  cancelLabel: 'Cancel',
  destructive: true,
};

/**
 * App-wide confirmation. Always use `const { confirm } = useConfirm()`.
 * Renders a single shared ConfirmModal — do not add other confirm UIs.
 *
 * @example
 * const ok = await confirm({ title: 'Delete?', message: '…', confirmLabel: 'Delete' });
 * if (!ok) return;
 */
export function ConfirmProvider({ children }) {
  const [open, setOpen] = useState(false);
  // Keep the last options while the modal closes, so it never flashes the defaults.
  const [opts, setOpts] = useState(DEFAULTS);
  const resolverRef = useRef(null);

  const close = useCallback((result) => {
    const resolve = resolverRef.current;
    resolverRef.current = null;
    setOpen(false);
    // Resolve after unmount tick so callers (signOut / navigation) run cleanly.
    queueMicrotask(() => {
      if (resolve) resolve(result);
    });
  }, []);

  const confirm = useCallback((options = {}) => {
    return new Promise((resolve) => {
      // A second confirm() while one is open settles the first as cancelled.
      if (resolverRef.current) resolverRef.current(false);
      resolverRef.current = resolve;
      setOpts({ ...DEFAULTS, ...options });
      setOpen(true);
    });
  }, []);

  return (
    <ConfirmContext.Provider value={{ confirm }}>
      {children}
      <ConfirmModal
        visible={open}
        title={opts.title}
        message={opts.message}
        confirmLabel={opts.confirmLabel}
        cancelLabel={opts.cancelLabel}
        destructive={opts.destructive !== false}
        onCancel={() => close(false)}
        onConfirm={() => close(true)}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm must be used within ConfirmProvider');
  return ctx;
}
