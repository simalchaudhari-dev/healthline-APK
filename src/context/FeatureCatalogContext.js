import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import {
  apiFetchFeatureCatalog,
  findCatalogFeature,
  hubFeaturesFromCatalog,
  isCatalogFeatureActive,
  FALLBACK_FEATURES,
} from '../services/featuresService';
import { useNetwork } from './NetworkContext';

const FeatureCatalogContext = createContext(null);

export function FeatureCatalogProvider({ children }) {
  // Start ready with fallback so screens never hang on a slow/dead API.
  const [catalog, setCatalog] = useState(FALLBACK_FEATURES);
  const [ready, setReady] = useState(true);

  const refresh = useCallback(async () => {
    const next = await apiFetchFeatureCatalog();
    setCatalog(next);
    setReady(true);
    return next;
  }, []);

  useEffect(() => {
    let active = true;
    (async () => {
      const next = await apiFetchFeatureCatalog();
      if (!active) return;
      setCatalog(next);
      setReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const { reconnectNonce } = useNetwork();
  useEffect(() => {
    if (reconnectNonce) refresh();
  }, [reconnectNonce, refresh]);

  const hubFeatures = useMemo(() => hubFeaturesFromCatalog(catalog), [catalog]);

  const isActive = useCallback(
    (query) => isCatalogFeatureActive(catalog, query),
    [catalog]
  );

  const getFeature = useCallback((query) => findCatalogFeature(catalog, query), [catalog]);

  const value = useMemo(
    () => ({
      ready,
      catalog,
      hubFeatures,
      refresh,
      isActive,
      getFeature,
    }),
    [ready, catalog, hubFeatures, refresh, isActive, getFeature]
  );

  return (
    <FeatureCatalogContext.Provider value={value}>{children}</FeatureCatalogContext.Provider>
  );
}

export function useFeatureCatalog() {
  const ctx = useContext(FeatureCatalogContext);
  if (!ctx) {
    throw new Error('useFeatureCatalog must be used within FeatureCatalogProvider');
  }
  return ctx;
}
