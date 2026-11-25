import { useMemo } from 'react';
import { useAuth } from '../context/AuthContext';
import { useDiary, todayKey } from '../context/DiaryContext';
import { useSteps } from '../context/StepsContext';
import { withLiveAchievements } from '../utils/streak';
import { withLiveDiaryAll } from '../utils/achievements';

/** Catalog achievements with live numbers: streak from app opens, the rest from the diary. */
export function useLiveAchievements(list) {
  const { user } = useAuth();
  const { days: diaryDays, profile } = useDiary();
  const { days: stepDays, isPreview } = useSteps();
  const today = todayKey();

  // Overlay the phone's latest step counts so the steps badge updates before the next server sync.
  // Never the labelled sample week (web / Expo Go preview) — that must not unlock anything.
  const days = useMemo(() => {
    const live = isPreview ? [] : (stepDays || []).filter((d) => d.steps > 0);
    if (!live.length) return diaryDays;
    const merged = { ...diaryDays };
    live.forEach((d) => {
      const prev = merged[d.key];
      if (!prev || (Number(prev.steps) || 0) < d.steps) merged[d.key] = { ...(prev || {}), steps: d.steps };
    });
    return merged;
  }, [diaryDays, stepDays, isPreview]);

  return useMemo(
    () => withLiveDiaryAll(withLiveAchievements(list, user?.streak), { days, profile, today }),
    [list, user?.streak, days, profile, today],
  );
}
