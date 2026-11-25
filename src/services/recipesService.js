import { apiBase } from '../config/env';
import { RECIPES as FALLBACK_RECIPES, getRecipeById as getLocalRecipeById } from '../data/recipes';
import { authHeaders } from '../utils/apiAuth';
import { fetchJson } from '../utils/fetchJson';

function normalizeRecipe(raw) {
  if (!raw) return null;
  const id = String(raw.id || '').trim();
  if (!id) return null;
  const n = raw.nutrition || {};
  return {
    id,
    title: String(raw.title || '').trim(),
    time: String(raw.time || '').trim() || '0 min',
    calories: Number(raw.calories) || 0,
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    image: String(raw.image || '').trim(),
    description: String(raw.description || '').trim(),
    nutrition: {
      carbs: Number(n.carbs) || 0,
      protein: Number(n.protein) || 0,
      fat: Number(n.fat) || 0,
    },
    ingredients: Array.isArray(raw.ingredients) ? raw.ingredients : [],
    steps: Array.isArray(raw.steps) ? raw.steps : [],
    featured: Boolean(raw.featured),
  };
}

/** Last list from the API, so RecipeDetail opens instantly from Discover. */
let cache = [];

/**
 * Active recipes from AdminPanel `GET /api/recipes`.
 * Falls back to local RECIPES if API is unreachable.
 */
export async function apiListRecipes() {
  const base = apiBase();
  if (!base) return FALLBACK_RECIPES;

  try {
    const { res, data } = await fetchJson(`${base}/api/recipes`, {
      method: 'GET',
      headers: await authHeaders(),
      timeoutMs: 8000,
    });
    if (!res.ok) return cache.length ? cache : FALLBACK_RECIPES;

    const list = Array.isArray(data?.recipes)
      ? data.recipes.map(normalizeRecipe).filter(Boolean)
      : [];
    cache = list;
    return list;
  } catch {
    return cache.length ? cache : FALLBACK_RECIPES;
  }
}

export function getCachedRecipe(id) {
  return cache.find((r) => r.id === id) || getLocalRecipeById(id) || null;
}

export async function apiGetRecipeById(id) {
  const base = apiBase();
  const recipeId = String(id || '').trim();
  if (!recipeId) return null;

  if (!base) return getLocalRecipeById(recipeId) || null;

  try {
    const { res, data } = await fetchJson(`${base}/api/recipes/${recipeId}`, {
      method: 'GET',
      headers: await authHeaders(),
      timeoutMs: 8000,
    });
    if (!res.ok) return getLocalRecipeById(recipeId) || null;
    return normalizeRecipe(data?.recipe) || getLocalRecipeById(recipeId) || null;
  } catch {
    return getCachedRecipe(recipeId);
  }
}
