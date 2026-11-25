import { apiBase } from '../config/env';
import { authHeaders } from '../utils/apiAuth';
import { fetchJson } from '../utils/fetchJson';

/** Privacy policy or terms saved in Admin Panel. Returns null when the API is unreachable. */
export async function fetchLegalPage(key) {
  const base = apiBase();
  if (!base) return null;
  try {
    const { res, data } = await fetchJson(`${base}/api/legal/${key}`, {
      method: 'GET',
      headers: await authHeaders(),
    });
    if (!res.ok || !data?.page) return null;
    return data.page;
  } catch {
    return null;
  }
}
