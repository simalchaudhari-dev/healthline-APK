import { useCallback, useEffect, useMemo, useState } from 'react';
import { useAuth } from '../context/AuthContext';
import { useFeatureCatalog } from '../context/FeatureCatalogContext';
import { apiFetchPlans } from '../services/plansService';
import { PLANS as FALLBACK_PLANS } from '../config/plans';
import { hasAiFeature } from '../config/aiFeatures';
import { toast } from '../utils/toast';

function leavePremiumScreen(navigation, toSubscription) {
  if (!navigation) return;
  if (toSubscription) {
    // Replace so the blocked AI screen is not left underneath a stuck loader.
    if (typeof navigation.replace === 'function') {
      navigation.replace('Subscription');
      return;
    }
    navigation.navigate?.('Subscription');
    return;
  }
  if (navigation.canGoBack?.()) {
    navigation.goBack();
    return;
  }
  navigation.navigate?.('Main');
}

/**
 * Gate AI screens by:
 * 1) App Feature Active in admin catalog
 * 2) User subscription plan entitlements
 */
export function useAiEntitlement(featureId) {
  const { user } = useAuth();
  const { ready: catalogReady, isActive, getFeature } = useFeatureCatalog();
  const [plans, setPlans] = useState(FALLBACK_PLANS);
  const [plansReady, setPlansReady] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      const next = await apiFetchPlans();
      if (!active) return;
      setPlans(next);
      setPlansReady(true);
    })();
    return () => {
      active = false;
    };
  }, []);

  const catalogActive = !featureId || isActive({ aiKey: featureId });
  const featureMeta = featureId ? getFeature({ aiKey: featureId }) : null;

  const planAllowed = useMemo(() => {
    if (!featureId) return true;
    return hasAiFeature(user?.plan || 'Free', featureId, plans);
  }, [featureId, plans, user?.plan]);

  const ready = catalogReady && plansReady;
  const allowed = catalogActive && planAllowed;

  const requireFeature = useCallback(
    (navigation, label) => {
      const title = label || featureMeta?.label || 'this AI feature';
      if (!catalogActive) {
        toast.warning(`${title} is currently unavailable`);
        leavePremiumScreen(navigation, false);
        return false;
      }
      if (!planAllowed) {
        toast.warning(`Upgrade your plan to unlock ${title}`);
        leavePremiumScreen(navigation, true);
        return false;
      }
      return true;
    },
    [catalogActive, planAllowed, featureMeta?.label]
  );

  return {
    ready,
    allowed,
    catalogActive,
    planAllowed,
    requireFeature,
    plan: user?.plan || 'Free',
  };
}
