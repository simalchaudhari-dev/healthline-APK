import { useCallback, useEffect } from 'react';
import { useFeatureCatalog } from '../context/FeatureCatalogContext';
import { toast } from '../utils/toast';

/**
 * Block a stack screen when its App Feature is Inactive in admin.
 * Main tabs are never blocked (see featuresService.TAB_ROUTES).
 */
export function useFeatureGate(navigation, { key, route, aiKey, label } = {}) {
  const { ready, isActive, getFeature } = useFeatureCatalog();
  const active = isActive({ key, route, aiKey });
  const feature = getFeature({ key, route, aiKey });
  const title = label || feature?.label || 'This feature';

  useEffect(() => {
    if (!ready || active) return;
    toast.warning(`${title} is currently unavailable`);
    navigation?.goBack?.();
  }, [ready, active, navigation, title]);

  const requireActive = useCallback(() => {
    if (active) return true;
    toast.warning(`${title} is currently unavailable`);
    return false;
  }, [active, title]);

  return { ready, allowed: active, requireActive, feature };
}
