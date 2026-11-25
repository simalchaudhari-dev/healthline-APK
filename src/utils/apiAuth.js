import { readAccessToken } from './sessionStore';

export { readAccessToken };

export async function authHeaders(extra = {}) {
  const headers = { Accept: 'application/json', ...extra };
  const token = await readAccessToken();
  if (token) headers.Authorization = `Bearer ${token}`;
  return headers;
}
