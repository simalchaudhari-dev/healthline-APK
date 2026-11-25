import React, { useEffect, useRef } from 'react';
import LoadingScreen from './LoadingScreen';
import { useAiEntitlement } from '../../hooks/useAiEntitlement';

/**
 * Only mounts children when the AI feature is Active + plan-unlocked.
 * Denied users get a toast and are sent to Subscription (or back) — no stuck loader.
 */
export function AiFeatureGate({ featureId, label, navigation, children }) {
  const { ready, allowed, requireFeature } = useAiEntitlement(featureId);
  const handled = useRef(false);

  useEffect(() => {
    if (!ready || allowed || handled.current) return;
    handled.current = true;
    requireFeature(navigation, label);
  }, [ready, allowed, navigation, requireFeature, label]);

  if (!ready) {
    return <LoadingScreen fullScreen message="Checking plan..." />;
  }
  if (!allowed) {
    return null;
  }

  return children;
}
