import { apiBase } from '../config/env';
import { authHeaders } from '../utils/apiAuth';
import { fetchJson } from '../utils/fetchJson';

let cache = null;
let pending = null;

/** Model names saved in Admin Settings. The OpenRouter key is not included. */
export async function loadAiModels() {
  if (cache) return cache;
  if (!pending) {
    pending = (async () => {
      const base = apiBase();
      if (!base) return { textModel: '', visionModel: '' };
      let res;
      let data;
      try {
        ({ res, data } = await fetchJson(`${base}/api/ai-config`, {
          method: 'GET',
          headers: await authHeaders(),
        }));
      } catch {
        // Slow / offline: use defaults now, try again next time (not cached).
        return { textModel: '', visionModel: '' };
      }
      if (!res.ok || data?.empty) return { textModel: '', visionModel: '' };
      cache = {
        textModel: String(data?.textModel || '').trim(),
        visionModel: String(data?.visionModel || '').trim(),
      };
      return cache;
    })().finally(() => {
      pending = null;
    });
  }
  return pending;
}

export function modelLabel(name) {
  const text = String(name || '').trim();
  if (!text) return '';
  return text.split('/').pop();
}
