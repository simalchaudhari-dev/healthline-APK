import { apiBase } from '../config/env';
import { FOODS as FALLBACK_FOODS, getFoodById as getLocalFoodById, getLocalFoodByBarcode } from '../data/foods';
import { authHeaders } from '../utils/apiAuth';
import { fetchJson } from '../utils/fetchJson';

function normalizeFood(raw) {
  if (!raw) return null;
  const id = String(raw.id || '').trim();
  if (!id) return null;
  return {
    id,
    name: String(raw.name || '').trim(),
    brand: String(raw.brand || '').trim(),
    serving: String(raw.serving || '1 serving').trim(),
    calories: Number(raw.calories) || 0,
    carbs: Number(raw.carbs) || 0,
    protein: Number(raw.protein) || 0,
    fat: Number(raw.fat) || 0,
    fiber: Number(raw.fiber) || 0,
    sugar: Number(raw.sugar) || 0,
    sodium: Number(raw.sodium) || 0,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    barcode: String(raw.barcode || '').trim(),
    imageUrl: String(raw.imageUrl || '').trim(),
  };
}

/**
 * Approved foods from AdminPanel `GET /api/foods`.
 * Falls back to local FOODS if API is unreachable.
 */
export async function apiSearchFoods(query = '') {
  const base = apiBase();
  const q = String(query || '').trim();

  if (!base) {
    return filterLocal(q);
  }

  try {
    const params = new URLSearchParams();
    if (q) params.set('q', q);
    const qs = params.toString();
    const { res, data } = await fetchJson(`${base}/api/foods${qs ? `?${qs}` : ''}`, {
      method: 'GET',
      headers: await authHeaders(),
      timeoutMs: 8000,
    });
    if (!res.ok) return filterLocal(q);

    const list = Array.isArray(data?.foods) ? data.foods.map(normalizeFood).filter(Boolean) : [];
    return list.length ? list : filterLocal(q);
  } catch {
    return filterLocal(q);
  }
}

export async function apiGetFoodById(id) {
  const base = apiBase();
  const foodId = String(id || '').trim();
  if (!foodId) return null;

  if (!base) return getLocalFoodById(foodId);

  try {
    const { res, data } = await fetchJson(`${base}/api/foods/${foodId}`, {
      method: 'GET',
      headers: await authHeaders(),
      timeoutMs: 8000,
    });
    if (!res.ok) return getLocalFoodById(foodId);
    return normalizeFood(data?.food) || getLocalFoodById(foodId);
  } catch {
    return getLocalFoodById(foodId);
  }
}

export async function apiGetFoodByBarcode(code) {
  const base = apiBase();
  const barcode = String(code || '').trim();
  if (!barcode) return null;

  if (!base) return getLocalFoodByBarcode(barcode);

  try {
    const params = new URLSearchParams({ barcode });
    const { res, data } = await fetchJson(`${base}/api/foods?${params.toString()}`, {
      method: 'GET',
      headers: await authHeaders(),
      timeoutMs: 8000,
    });
    if (!res.ok) return getLocalFoodByBarcode(barcode);
    const list = Array.isArray(data?.foods) ? data.foods.map(normalizeFood).filter(Boolean) : [];
    return list[0] || getLocalFoodByBarcode(barcode);
  } catch {
    return getLocalFoodByBarcode(barcode);
  }
}

function filterLocal(q) {
  if (!q) return FALLBACK_FOODS.map((f) => ({ ...f }));
  const s = q.toLowerCase();
  return FALLBACK_FOODS.filter(
    (f) =>
      f.name.toLowerCase().includes(s) ||
      (f.brand || '').toLowerCase().includes(s) ||
      (f.tags || []).some((t) => String(t).toLowerCase().includes(s))
  ).map((f) => ({ ...f }));
}
