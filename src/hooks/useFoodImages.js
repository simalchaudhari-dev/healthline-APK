import { useCallback, useEffect, useState } from 'react';
import { apiSearchFoods } from '../services/foodsService';

const EMPTY = { byId: new Map(), byName: new Map() };

// One catalog fetch shared by every screen and meal section (cleared on failure so it can retry).
let cached = null;
let pending = null;

function loadImages() {
  if (cached) return Promise.resolve(cached);
  if (!pending) {
    pending = apiSearchFoods('')
      .then((list) => {
        const byId = new Map();
        const byName = new Map();
        (list || []).forEach((food) => {
          if (!food?.imageUrl) return;
          byId.set(String(food.id), food.imageUrl);
          byName.set(String(food.name || '').trim().toLowerCase(), food.imageUrl);
        });
        cached = { byId, byName };
        return cached;
      })
      .catch(() => EMPTY)
      .finally(() => {
        pending = null;
      });
  }
  return pending;
}

/**
 * Photo for a logged food: its own imageUrl, else the catalog food with the same id or name.
 * Returns '' when there is no photo.
 */
export default function useFoodImages() {
  const [maps, setMaps] = useState(cached || EMPTY);

  useEffect(() => {
    let active = true;
    loadImages().then((next) => {
      if (active) setMaps(next);
    });
    return () => {
      active = false;
    };
  }, []);

  return useCallback(
    (item) => {
      if (item?.imageUrl) return item.imageUrl;
      const id = String(item?.foodId || item?.id || '');
      const name = String(item?.name || '').trim().toLowerCase();
      return maps.byId.get(id) || maps.byName.get(name) || '';
    },
    [maps],
  );
}
