/**
 * Imperative global loader (API overlay).
 *
 * loader.show('Saving...')
 * loader.hide()
 * await loader.wrap(promise, 'Uploading...')
 */

let pushLoader = null;
let depth = 0;

export function registerLoaderHandler(handler) {
  pushLoader = handler;
  return () => {
    if (pushLoader === handler) pushLoader = null;
  };
}

function setVisible(visible, message = '') {
  if (!pushLoader) return;
  pushLoader({ visible, message: message || '' });
}

export const loader = {
  show(message = 'Please wait...') {
    depth += 1;
    setVisible(true, message);
  },
  hide() {
    depth = Math.max(0, depth - 1);
    if (depth === 0) setVisible(false, '');
  },
  /** Force-close even if nested show() calls remain. */
  reset() {
    depth = 0;
    setVisible(false, '');
  },
  async wrap(promiseOrFn, message = 'Please wait...') {
    loader.show(message);
    try {
      const result = typeof promiseOrFn === 'function' ? promiseOrFn() : promiseOrFn;
      return await result;
    } finally {
      loader.hide();
    }
  },
};

export default loader;
