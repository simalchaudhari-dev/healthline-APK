import { apiBase } from '../config/env';
import { PLANS as FALLBACK_PLANS } from '../config/plans';
import { authHeaders } from '../utils/apiAuth';
import { fetchJson } from '../utils/fetchJson';

/**
 * Active subscription plans from AdminPanel.
 * Falls back to local PLANS if the API is unreachable.
 */
export async function apiFetchPlans() {
  const base = apiBase();
  if (!base) return FALLBACK_PLANS;

  try {
    const { res, data } = await fetchJson(`${base}/api/plans`, {
      method: 'GET',
      headers: await authHeaders(),
      timeoutMs: 8000,
    });
    if (!res.ok) return FALLBACK_PLANS;

    const plans = Array.isArray(data?.plans) ? data.plans : [];
    if (!plans.length) return FALLBACK_PLANS;

    const mapped = plans.map((plan) => ({
      id: plan.id || plan.code,
      name: plan.name,
      tagline: plan.tagline || '',
      priceMonthly: Number(plan.priceMonthly) || 0,
      priceYearly:
        plan.priceYearly === null || plan.priceYearly === undefined || plan.priceYearly === ''
          ? null
          : Number(String(plan.priceYearly).replace(/[^\d.]/g, '')) || null,
      highlight: !!plan.highlight,
      features: Array.isArray(plan.features) ? plan.features : [],
      aiFeatures: Array.isArray(plan.aiFeatures) ? plan.aiFeatures : [],
      tokenAllowance: Number(plan.tokenAllowance) || 0,
    }));

    return mapped;
  } catch {
    return FALLBACK_PLANS;
  }
}
