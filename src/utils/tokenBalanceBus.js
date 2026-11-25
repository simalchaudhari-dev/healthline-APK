const listeners = new Set();

export function onTokenBalance(listener) {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function emitTokenBalance(balance) {
  const next = Math.max(0, Number(balance) || 0);
  listeners.forEach((listener) => listener(next));
}
