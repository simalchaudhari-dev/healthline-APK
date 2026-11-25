/**
 * Timed fetch — never hang forever on a dead AdminPanel.
 *
 * The timeout is a race, not an abort: aborting makes the browser raise a raw AbortError that
 * can surface as a red "unhandled" error in dev (e.g. while the server restarts). A late reply
 * after the timeout is simply ignored.
 */
export async function fetchJson(url, { timeoutMs = 8000, ...init } = {}) {
  let timer;
  const request = fetch(url, init).then(async (res) => {
    const data = await res.json().catch(() => null);
    return { res, data };
  });
  // If the timeout wins, the request may still fail later — never leave that rejection unhandled.
  request.catch(() => {});

  const timeout = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error('This is taking too long. Check your internet connection and try again.');
      err.code = 'TIMEOUT';
      reject(err);
    }, timeoutMs);
  });

  try {
    return await Promise.race([request, timeout]);
  } catch (err) {
    if (err?.code === 'TIMEOUT') throw err;
    // A raw TypeError means "offline / server down" — give callers a plain, tagged error.
    const next = new Error('Can’t connect right now. Check your internet connection and try again.');
    next.code = 'NETWORK';
    throw next;
  } finally {
    clearTimeout(timer);
  }
}
