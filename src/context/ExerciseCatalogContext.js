import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { EXERCISES, exerciseCatalogVersion, onExerciseCatalogChange } from '../data/homeExercises';
import { loadCachedExerciseCatalog, refreshExerciseCatalog } from '../services/exerciseCatalogService';
import { useNetwork } from './NetworkContext';

const ExerciseCatalogContext = createContext({ version: '', status: 'loading', refresh: () => {} });

/**
 * "Exercises at home" come only from the admin panel (GET /api/home-exercises):
 * the copy saved on the phone shows first, then the server copy replaces it.
 * status: 'loading' (nothing yet) | 'ready' | 'error' (nothing saved and the server did not answer).
 */
export function ExerciseCatalogProvider({ children }) {
  const [version, setVersion] = useState(exerciseCatalogVersion());
  const [status, setStatus] = useState(EXERCISES.length ? 'ready' : 'loading');

  useEffect(() => onExerciseCatalogChange(setVersion), []);

  const refresh = useCallback(async () => {
    if (!EXERCISES.length) setStatus('loading');
    const ok = await refreshExerciseCatalog();
    setStatus(ok || EXERCISES.length ? 'ready' : 'error');
    return ok;
  }, []);

  useEffect(() => {
    loadCachedExerciseCatalog().finally(() => {
      if (EXERCISES.length) setStatus('ready');
      refresh();
    });
  }, [refresh]);

  const { reconnectNonce } = useNetwork();
  useEffect(() => {
    if (reconnectNonce) refresh();
  }, [reconnectNonce, refresh]);

  const value = useMemo(() => ({ version, status, refresh }), [version, status, refresh]);
  return <ExerciseCatalogContext.Provider value={value}>{children}</ExerciseCatalogContext.Provider>;
}

/** Catalog version — use it in memo deps so lists refresh after an admin change. */
export function useExerciseCatalog() {
  return useContext(ExerciseCatalogContext).version;
}

/** { status, refresh } for screens that show a loader / retry while the catalog is empty. */
export function useExerciseCatalogStatus() {
  const { status, refresh } = useContext(ExerciseCatalogContext);
  return { status, refresh };
}
