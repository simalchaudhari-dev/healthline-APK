import React, {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  useEffect,
  useRef,
} from 'react';
import { AppState } from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { readDiaryState, writeDiaryState } from '../utils/diaryVault';
import { GROCERY_SECTIONS } from '../data/grocery';
import { DAY_KEYS, getDayMeals } from '../data/mealPlan';
import { useAuth } from './AuthContext';
import { useNetwork } from './NetworkContext';
import {
  apiAddFavorite,
  apiFetchDiary,
  apiFetchDiaryDay,
  apiFetchFavorites,
  apiRemoveFavorite,
  apiSaveDiaryDay,
  apiFetchUserData,
  apiSaveUserData,
} from '../services/authService';
import { toast } from '../utils/toast';
import { applyServerWorkoutProgress, resetWorkoutProgressAccount } from '../utils/workoutProgress';
import { applyServerReplyLanguage, resetReplyLanguageAccount } from '../utils/replyLanguage';
import { applyServerProgramProgress, resetProgramProgressAccount } from '../utils/programProgress';
import { oneServing } from '../utils/foodServing';
import { aiChatsRevision, applyServerAiChats, resetAiChatsAccount } from '../utils/aiChats';

const DiaryContext = createContext(null);

/** Days of history pulled from the server on sign-in (older days load on demand). */
const DIARY_SYNC_DAYS = 90;
const SAVE_DEBOUNCE_MS = 600;
/** Diary days edited on this phone that have not reached the server yet (JSON array of keys). */
const UNSENT_DAYS_KEY = 'healthline.diary.unsentDays.v1';

function shiftKey(key, delta) {
  const [y, m, d] = String(key).split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  const yy = date.getFullYear();
  const mm = String(date.getMonth() + 1).padStart(2, '0');
  const dd = String(date.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

export const todayKey = () => {
  const d = new Date();
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
};

function emptyMeals() {
  return { breakfast: [], lunch: [], dinner: [], snacks: [] };
}

function emptyDay() {
  return { meals: emptyMeals(), exercise: [], water: 0 };
}

const isDemoEntry = (item) => String(item?.logId || '').startsWith('demo-');

/** Old builds seeded sample meals (logId "demo-…"); never upload those as real diary data. */
function withoutDemoEntries(day) {
  if (!day) return null;
  const meals = day.meals || {};
  return {
    ...day,
    meals: {
      breakfast: (meals.breakfast || []).filter((i) => !isDemoEntry(i)),
      lunch: (meals.lunch || []).filter((i) => !isDemoEntry(i)),
      dinner: (meals.dinner || []).filter((i) => !isDemoEntry(i)),
      snacks: (meals.snacks || []).filter((i) => !isDemoEntry(i)),
    },
    exercise: (day.exercise || []).filter((i) => !isDemoEntry(i)),
  };
}

function dayHasEntries(day) {
  if (!day) return false;
  const meals = Object.values(day.meals || {}).some((list) => Array.isArray(list) && list.length);
  return meals || (day.exercise || []).length > 0 || Number(day.water) > 0;
}

/** Diary starts empty — real days come from the signed-in user's account. */
function seedDays() {
  return {};
}

const DEFAULT_PROFILE = {
  name: 'Alex',
  email: '',
  firstName: '',
  lastName: '',
  sex: '',
  age: 30,
  heightCm: 168,
  activity: 'Moderate',
  calories: 2200,
  carbs: 220,
  protein: 140,
  fat: 73,
  waterGoal: 8,
  weight: 72.4,
  goalWeight: 68,
  diet: [],
  allergies: [],
  conditions: [],
  focusGoals: [],
  workoutLevel: '',
  workoutRoutine: '',
};

/**
 * Only toggles the user actually set (onboarding or Reminders screen).
 * Missing keys fall back to the admin's "ON by default" — see isReminderOn in remindersService.
 */
const DEFAULT_REMINDERS = {};

function seedGrocery() {
  return GROCERY_SECTIONS.flatMap((s) =>
    s.items.map((item) => ({
      ...item,
      aisle: s.aisle,
      checked: false,
    })),
  );
}

function seedMealPlan() {
  const out = {};
  DAY_KEYS.forEach((day) => {
    out[day] = getDayMeals(day).map((m, i) => ({
      id: `mp-${day}-${i}`,
      ...m,
    }));
  });
  return out;
}

/** The starter grocery list / meal plan — not uploaded as "user data" unless the user changed them. */
const SEED_GROCERY_JSON = JSON.stringify(seedGrocery());
const SEED_MEAL_PLAN_JSON = JSON.stringify(seedMealPlan());
const PLANNER_SAVE_DEBOUNCE_MS = 1500;

const DEFAULT_STATE = {
  dateKey: todayKey(),
  days: seedDays(),
  goal: 'lose',
  profile: DEFAULT_PROFILE,
  weightLogs: [],
  favorites: [],
  recentFoods: [],
  customFoods: [],
  reminders: DEFAULT_REMINDERS,
  grocery: seedGrocery(),
  mealPlan: seedMealPlan(),
};

function dayOrEmpty(days, key) {
  const day = days[key] || emptyDay();
  const meals = day.meals || emptyMeals();
  return {
    ...day,
    meals: {
      breakfast: Array.isArray(meals.breakfast) ? meals.breakfast : [],
      lunch: Array.isArray(meals.lunch) ? meals.lunch : [],
      dinner: Array.isArray(meals.dinner) ? meals.dinner : [],
      snacks: Array.isArray(meals.snacks) ? meals.snacks : [],
    },
    exercise: Array.isArray(day.exercise) ? day.exercise : [],
    water: Number.isFinite(Number(day.water)) ? Number(day.water) : 0,
  };
}

export function DiaryProvider({ children }) {
  const [hydrated, setHydrated] = useState(false);
  const [dateKey, setDateKeyState] = useState(DEFAULT_STATE.dateKey);
  // The calendar day now. Checked again just after midnight and whenever the app comes back to
  // the front, so an app left open overnight does not keep showing yesterday as "today".
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    let timer;
    const check = () => setToday((prev) => (todayKey() === prev ? prev : todayKey()));
    const scheduleMidnight = () => {
      const now = new Date();
      const next = new Date(now.getFullYear(), now.getMonth(), now.getDate() + 1, 0, 0, 5);
      timer = setTimeout(() => {
        check();
        scheduleMidnight();
      }, next.getTime() - now.getTime());
    };
    scheduleMidnight();
    const sub = AppState.addEventListener('change', (state) => {
      if (state === 'active') check();
    });
    return () => {
      clearTimeout(timer);
      sub.remove();
    };
  }, []);
  // A diary that was showing "today" moves on to the new day; a past day picked stays put.
  const prevTodayRef = useRef(today);
  useEffect(() => {
    const prev = prevTodayRef.current;
    prevTodayRef.current = today;
    if (prev !== today) setDateKeyState((key) => (key === prev ? today : key));
  }, [today]);
  const [days, setDays] = useState(() => seedDays());
  const [goal, setGoal] = useState('lose');
  const [profile, setProfile] = useState(DEFAULT_PROFILE);
  const [weightLogs, setWeightLogs] = useState([]);
  const [favorites, setFavorites] = useState([]);
  const [recentFoods, setRecentFoods] = useState([]);
  const [customFoods, setCustomFoods] = useState([]);
  const [reminders, setReminders] = useState(DEFAULT_REMINDERS);
  const [grocery, setGrocery] = useState(() => seedGrocery());
  const [mealPlan, setMealPlan] = useState(() => seedMealPlan());
  const skipSave = useRef(true);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const saved = await readDiaryState();
        if (cancelled) return;
        // Days edited offline before the app was closed: still to be uploaded.
        try {
          const unsent = JSON.parse((await AsyncStorage.getItem(UNSENT_DAYS_KEY)) || 'null');
          // { userId, days } (an older build saved a bare list of days).
          const raw = Array.isArray(unsent) ? unsent : unsent?.days;
          if (Array.isArray(raw)) {
            const list = raw.filter((k) => /^\d{4}-\d{2}-\d{2}$/.test(String(k)));
            dirtyDaysRef.current = list;
            dirtyRef.current = list.length > 0;
            dirtyOwnerRef.current = Array.isArray(unsent) ? null : unsent?.userId || null;
          }
        } catch {
          // nothing saved
        }
        if (cancelled) return;
        if (saved) {
          // Always open on today; cached days are an offline copy until the server responds.
          setDateKeyState(todayKey());
          setDays(saved.days && typeof saved.days === 'object' ? saved.days : {});
          setGoal(saved.goal || 'lose');
          setProfile({ ...DEFAULT_PROFILE, ...(saved.profile || {}) });
          setWeightLogs(Array.isArray(saved.weightLogs) ? saved.weightLogs : []);
          // Older builds stored bare food ids; only full food snapshots are kept now.
          setFavorites(
            Array.isArray(saved.favorites)
              ? saved.favorites.filter((f) => f && typeof f === 'object' && (f.id || f.foodId))
              : [],
          );
          // Older builds saved recents with the eaten amount ("3 × 1 bowl"); keep one serving.
          setRecentFoods(
            Array.isArray(saved.recentFoods)
              ? saved.recentFoods.map((f) => ({ ...oneServing(f), perServing: true }))
              : [],
          );
          setCustomFoods(Array.isArray(saved.customFoods) ? saved.customFoods : []);
          setReminders({ ...DEFAULT_REMINDERS, ...(saved.reminders || {}) });
          setGrocery(Array.isArray(saved.grocery) && saved.grocery.length ? saved.grocery : seedGrocery());
          setMealPlan(
            saved.mealPlan && typeof saved.mealPlan === 'object' && Object.keys(saved.mealPlan).length
              ? saved.mealPlan
              : seedMealPlan(),
          );
        } else {
          setDays(seedDays());
        }
      } catch {
        // keep defaults
      } finally {
        if (!cancelled) {
          setHydrated(true);
          skipSave.current = false;
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!hydrated || skipSave.current) return;
    const payload = {
      dateKey,
      days,
      goal,
      profile,
      weightLogs,
      favorites,
      recentFoods,
      customFoods,
      reminders,
      grocery,
      mealPlan,
    };
    writeDiaryState(payload).catch(() => {});
  }, [
    hydrated,
    dateKey,
    days,
    goal,
    profile,
    weightLogs,
    favorites,
    recentFoods,
    customFoods,
    reminders,
    grocery,
    mealPlan,
  ]);

  // ---- Server sync (signed-in user's own diary) ---------------------------
  const { accessToken, hydrated: authHydrated, user } = useAuth();
  const workoutAccountRef = useRef(false);
  // Bumps when the connection returns (or Retry is tapped) → reload history and upload offline edits.
  const { reconnectNonce } = useNetwork();
  const tokenRef = useRef(accessToken);
  tokenRef.current = accessToken;
  const userIdRef = useRef(user?.id || null);
  userIdRef.current = user?.id || null;
  /** A diary day changed locally and hasn't reached the server yet. */
  const dirtyRef = useRef(false);
  /**
   * Which days those unsent edits are for: the day each edit was made, even after midnight.
   * Kept on the phone too, so closing the app (or a reload) does not lose an offline edit.
   */
  const dirtyDaysRef = useRef([]);
  /** Bumped on every local edit so an older save can't clear a newer change. */
  const editVersionRef = useRef(0);
  /** Account the unsent days belong to, so only that account uploads them after a new sign-in. */
  const dirtyOwnerRef = useRef(null);
  const storeDirtyDays = useCallback((list, owner = dirtyOwnerRef.current || userIdRef.current) => {
    dirtyDaysRef.current = list;
    dirtyRef.current = list.length > 0;
    dirtyOwnerRef.current = list.length ? owner || null : null;
    if (list.length) {
      AsyncStorage.setItem(
        UNSENT_DAYS_KEY,
        JSON.stringify({ userId: dirtyOwnerRef.current, days: list }),
      ).catch(() => {});
    } else AsyncStorage.removeItem(UNSENT_DAYS_KEY).catch(() => {});
  }, []);
  const markDirty = useCallback(
    (key) => {
      if (!dirtyDaysRef.current.includes(key)) storeDirtyDays([...dirtyDaysRef.current, key]);
      else dirtyRef.current = true;
    },
    [storeDirtyDays],
  );
  const clearDirtyDay = useCallback(
    (key) => storeDirtyDays(dirtyDaysRef.current.filter((k) => k !== key)),
    [storeDirtyDays],
  );
  // Same account as the last sync: days opened on demand (older than the sync window) are kept.
  const diaryUserRef = useRef(null);
  const [syncing, setSyncing] = useState(false);
  /** Token whose diary / favourites have been fetched once (success or failure) — drives first-load loaders. */
  const [diaryLoadedFor, setDiaryLoadedFor] = useState(null);
  const [favoritesLoadedFor, setFavoritesLoadedFor] = useState(null);

  // Sign-in / account switch: replace local days with this user's days from the server.
  useEffect(() => {
    if (!hydrated || !authHydrated) return undefined;
    // Another account (or signed out): old days fetched before belong to someone else.
    // The same account (token renewed, reconnect) keeps them.
    const sameUser = !!accessToken && !!diaryUserRef.current && diaryUserRef.current === userIdRef.current;
    if (!sameUser) fetchedOldDaysRef.current.clear();
    diaryUserRef.current = accessToken ? userIdRef.current : null;
    if (!accessToken) {
      // Signed out (on purpose, or the sign-in expired): unsent days are kept, only those, so the
      // same account uploads them after signing in again. Nothing else of this account is kept.
      const unsent = dirtyDaysRef.current;
      setDays((prev) => {
        const held = {};
        unsent.forEach((key) => {
          if (prev[key]) held[key] = prev[key];
        });
        return held;
      });
      if (!unsent.length) storeDirtyDays([]);
      setFavorites([]);
      setDateKeyState(todayKey());
      return undefined;
    }
    // Unsent days with a known owner that is a DIFFERENT account: never upload them here.
    // An unknown owner (null — an old build's bare list) is adopted by the first account to sign
    // in: on a single-user device upgrade that is the same user, so their offline days are kept.
    const owner = dirtyOwnerRef.current;
    if (dirtyDaysRef.current.length && userIdRef.current && owner && owner !== userIdRef.current) {
      const theirs = dirtyDaysRef.current;
      storeDirtyDays([]);
      setDays((prev) => {
        const next = { ...prev };
        theirs.forEach((key) => delete next[key]);
        return next;
      });
    } else if (dirtyDaysRef.current.length && userIdRef.current && !owner) {
      // Adopt the unknown-owner unsent days for this account so they upload under it.
      storeDirtyDays(dirtyDaysRef.current, userIdRef.current);
    }
    let cancelled = false;
    // Favourites live on the user's account.
    apiFetchFavorites(accessToken)
      .then((data) => {
        if (!cancelled && Array.isArray(data?.favorites)) setFavorites(data.favorites);
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setFavoritesLoadedFor(accessToken);
      });
    (async () => {
      setSyncing(true);
      try {
        const today = todayKey();
        // An edit made while this fetch is running is newer than what it brings back.
        const versionAtFetch = editVersionRef.current;
        const data = await apiFetchDiary(accessToken, {
          from: shiftKey(today, -(DIARY_SYNC_DAYS - 1)),
          to: today,
          today,
        });
        if (cancelled) return;
        setDays((prev) => {
          const windowStart = shiftKey(today, -(DIARY_SYNC_DAYS - 1));
          const next = {};
          if (sameUser) {
            Object.keys(prev).forEach((k) => {
              if (k < windowStart) next[k] = prev[k];
            });
          }
          Object.assign(next, data?.days || {});
          // Keep every day with unsent local edits (logged offline, or a save that failed before a
          // reload, even if it was yesterday). If the server has nothing for today yet, upload it.
          const keep = new Set(dirtyDaysRef.current);
          const localToday = withoutDemoEntries(prev[today]);
          if (localToday && !next[today] && dayHasEntries(localToday)) keep.add(today);
          // Today was edited (and maybe already saved) while the fetch ran: the server copy it
          // returned is older, so keep the phone's.
          if (localToday && editVersionRef.current !== versionAtFetch) keep.add(today);
          let kept = false;
          keep.forEach((key) => {
            const local = withoutDemoEntries(prev[key]);
            if (!local) return;
            next[key] = local;
            kept = true;
          });
          if (kept) {
            storeDirtyDays([...keep].filter((key) => next[key]));
            editVersionRef.current += 1;
          }
          return next;
        });
      } catch {
        // Offline — keep the cached copy.
      } finally {
        if (!cancelled) {
          setSyncing(false);
          setDiaryLoadedFor(accessToken);
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [hydrated, authHydrated, accessToken, reconnectNonce, storeDirtyDays]);

  // ---- Planner + home-workout sync (GET / PUT /api/user-data) ----------
  /** JSON of what the server holds per field (null = not loaded yet). A different local value = unsaved edit. */
  const plannerSyncedRef = useRef({ weightLogs: null, grocery: null, mealPlan: null });
  const plannerLatestRef = useRef({ weightLogs, grocery, mealPlan });
  plannerLatestRef.current = { weightLogs, grocery, mealPlan };
  const [plannerLoadedFor, setPlannerLoadedFor] = useState(null);

  useEffect(() => {
    if (!hydrated || !authHydrated) return undefined;
    if (!accessToken) {
      // Signed out: forget this account's planner so the next account never inherits (or uploads) it.
      plannerSyncedRef.current = { weightLogs: null, grocery: null, mealPlan: null };
      setPlannerLoadedFor(null);
      setWeightLogs([]);
      setGrocery(seedGrocery());
      setMealPlan(seedMealPlan());
      // Only on a real sign-out — on a fresh start this would wipe the language picked in onboarding.
      if (workoutAccountRef.current) {
        resetWorkoutProgressAccount();
        resetReplyLanguageAccount();
        resetProgramProgressAccount();
      }
      workoutAccountRef.current = false;
      resetAiChatsAccount();
      return undefined;
    }
    workoutAccountRef.current = true;
    let cancelled = false;
    const seenChats = aiChatsRevision();
    apiFetchUserData(accessToken)
      .then((res) => {
        if (cancelled) return;
        const server = res?.data || {};
        const fields = {
          weightLogs: { set: setWeightLogs, empty: '[]' },
          grocery: { set: setGrocery, empty: SEED_GROCERY_JSON },
          mealPlan: { set: setMealPlan, empty: SEED_MEAL_PLAN_JSON },
        };
        Object.entries(fields).forEach(([key, { set, empty }]) => {
          const synced = plannerSyncedRef.current[key];
          const local = JSON.stringify(plannerLatestRef.current[key]);
          const editedOffline = synced != null && local !== synced;
          if (server[key] == null) {
            // Never saved on the account: the phone's own (non-default) copy gets uploaded below.
            plannerSyncedRef.current[key] = empty;
          } else if (!editedOffline) {
            plannerSyncedRef.current[key] = JSON.stringify(server[key]);
            set(server[key]);
          }
          // editedOffline → keep the local edit; the save effect uploads it.
        });
        setPlannerLoadedFor(accessToken);
        applyServerWorkoutProgress(server.workoutProgress ?? null, accessToken, user?.id || null);
        applyServerReplyLanguage(server.replyLanguage ?? null, accessToken);
        applyServerProgramProgress(server.programProgress ?? null, accessToken);
        applyServerAiChats(server.aiChats ?? null, seenChats);
      })
      .catch(() => {
        // Offline — keep the phone's copy; retried on reconnect.
      });
    return () => {
      cancelled = true;
    };
  }, [hydrated, authHydrated, accessToken, user?.id, reconnectNonce]);

  // Upload whichever planner list changed, shortly after the last edit.
  useEffect(() => {
    if (!accessToken || plannerLoadedFor !== accessToken) return undefined;
    const current = { weightLogs, grocery, mealPlan };
    const changes = {};
    Object.keys(current).forEach((key) => {
      const synced = plannerSyncedRef.current[key];
      if (synced != null && JSON.stringify(current[key]) !== synced) changes[key] = current[key];
    });
    if (!Object.keys(changes).length) return undefined;
    const t = setTimeout(async () => {
      try {
        await apiSaveUserData(accessToken, changes);
        Object.entries(changes).forEach(([key, value]) => {
          plannerSyncedRef.current[key] = JSON.stringify(value);
        });
      } catch {
        // Stays unsaved — retried on the next edit or reconnect.
      }
    }, PLANNER_SAVE_DEBOUNCE_MS);
    return () => clearTimeout(t);
  }, [weightLogs, grocery, mealPlan, accessToken, plannerLoadedFor, reconnectNonce]);

  /**
   * Days older than the synced window are not in `days` until asked for. Fetch one read-only.
   * Each day is asked once per session (a failed fetch can be asked again).
   */
  const fetchedOldDaysRef = useRef(new Set());
  const loadDay = useCallback((key) => {
    const token = tokenRef.current;
    if (!token || !key || key >= shiftKey(todayKey(), -(DIARY_SYNC_DAYS - 1))) return;
    if (fetchedOldDaysRef.current.has(key)) return;
    fetchedOldDaysRef.current.add(key);
    apiFetchDiaryDay(token, key)
      .then((data) => {
        if (data?.day) setDays((prev) => ({ ...prev, [key]: data.day }));
      })
      .catch(() => {
        fetchedOldDaysRef.current.delete(key);
      });
  }, []);

  const setDateKey = useCallback(
    (key) => {
      setDateKeyState(key);
      setDays((prev) => (prev[key] ? prev : { ...prev, [key]: emptyDay() }));
      loadDay(key);
    },
    [loadDay],
  );

  /** Only today can change. Past and future days are view-only. */
  const patchDay = useCallback(
    (key, updater) => {
      if (key !== todayKey()) return false;
      markDirty(key);
      editVersionRef.current += 1;
      setDays((prev) => {
        const current = dayOrEmpty(prev, key);
        const next = typeof updater === 'function' ? updater(current) : { ...current, ...updater };
        return { ...prev, [key]: next };
      });
      return true;
    },
    [markDirty],
  );

  // Push unsent diary days to the server shortly after each change (or after a reload brings
  // back unsent days). One save at a time.
  const daysRef = useRef(days);
  daysRef.current = days;
  const diarySaveRef = useRef(null);
  useEffect(() => {
    if (!dirtyRef.current || !accessToken) return undefined;
    // Wait for this account's first diary sync: before it, the phone copy may still be partial
    // and the merge decides which unsent days are kept.
    if (diaryLoadedFor !== accessToken) return undefined;
    let cancelled = false;
    const t = setTimeout(() => {
      const run = async () => {
        if (diarySaveRef.current) {
          await diarySaveRef.current.catch(() => {});
          if (cancelled || !dirtyRef.current) return;
        }
        // Each unsent day goes up under its own date (an edit from before midnight is still
        // yesterday's), oldest first.
        const pendingDays = [...dirtyDaysRef.current].sort();
        for (const key of pendingDays) {
          if (cancelled) return;
          // No copy of this day on the phone (e.g. the cache could not be read after a restart):
          // never upload an empty day over what the server has. It stays listed until it is back.
          if (!daysRef.current[key]) continue;
          const d = dayOrEmpty(daysRef.current, key);
          const version = editVersionRef.current;
          try {
            // eslint-disable-next-line no-await-in-loop
            await apiSaveDiaryDay(accessToken, key, {
              today: key,
              meals: d.meals,
              exercise: d.exercise,
              water: d.water,
            });
            // Only today can still change; an older day is done once it is saved.
            if (key !== todayKey() || editVersionRef.current === version) clearDirtyDay(key);
          } catch (err) {
            // 403: the server will not take a day this old any more, so stop retrying it.
            if (err?.status === 403) clearDirtyDay(key);
            // Otherwise it stays unsent and is retried on the next change or reload.
            console.warn('Diary save failed', err?.message);
          }
        }
      };
      const flight = run();
      diarySaveRef.current = flight;
      flight.finally(() => {
        if (diarySaveRef.current === flight) diarySaveRef.current = null;
      });
    }, SAVE_DEBOUNCE_MS);
    return () => {
      cancelled = true;
      clearTimeout(t);
    };
  }, [days, accessToken, reconnectNonce, clearDirtyDay, diaryLoadedFor]);

  const canEdit = dateKey === todayKey();

  /** Removing entries only works while viewing today. */
  const ensureEditable = useCallback(() => {
    if (dateKey === todayKey()) return true;
    toast.info('Past days are view-only.');
    return false;
  }, [dateKey]);

  /** New entries always go to today; jump the diary back to today so the user sees them. */
  const writeToday = useCallback(
    (updater) => {
      const today = todayKey();
      patchDay(today, updater);
      if (dateKey !== today) setDateKeyState(today);
    },
    [dateKey, patchDay],
  );

  const day = dayOrEmpty(days, dateKey);
  const meals = day.meals;
  const exercise = day.exercise;
  const water = day.water;

  useEffect(() => {
    if (canEdit && water > profile.waterGoal) {
      patchDay(dateKey, (d) => ({ ...d, water: profile.waterGoal }));
    }
  }, [canEdit, profile.waterGoal, water, dateKey, patchDay]);

  const totals = useMemo(() => {
    const all = [...meals.breakfast, ...meals.lunch, ...meals.dinner, ...meals.snacks];
    return all.reduce(
      (acc, item) => ({
        calories: acc.calories + item.calories,
        carbs: acc.carbs + item.carbs,
        protein: acc.protein + item.protein,
        fat: acc.fat + item.fat,
      }),
      { calories: 0, carbs: 0, protein: 0, fat: 0 },
    );
  }, [meals]);

  const burned = useMemo(
    () => exercise.reduce((sum, item) => sum + item.calories, 0),
    [exercise],
  );

  const remaining = profile.calories - totals.calories + burned;

  /** Recent foods keep ONE serving, so picking one again is not multiplied twice. */
  const pushRecent = useCallback((logged) => {
    const food = oneServing(logged);
    const entry = {
      id: food.id || food.foodId || `custom-${Date.now()}`,
      name: food.name,
      brand: food.brand || 'Custom',
      serving: food.serving,
      calories: food.calories,
      carbs: food.carbs,
      protein: food.protein,
      fat: food.fat,
      // Kept so logging it again from Recent does not save these as 0.
      ...(Number.isFinite(Number(food.fiber)) ? { fiber: Number(food.fiber) } : null),
      ...(Number.isFinite(Number(food.sugar)) ? { sugar: Number(food.sugar) } : null),
      ...(Number.isFinite(Number(food.sodium)) ? { sodium: Number(food.sodium) } : null),
      imageUrl: food.imageUrl || '',
      // Already one serving: loading it later must not divide it again.
      perServing: true,
    };
    setRecentFoods((prev) => {
      const filtered = prev.filter((f) => f.id !== entry.id && f.name !== entry.name);
      return [entry, ...filtered].slice(0, 20);
    });
  }, []);

  const addFood = useCallback(
    /** `source`: 'ai-scan' | 'ai-voice' | 'barcode' — counts toward achievements. */
    (meal, food, { source = '' } = {}) => {
      const entry = {
        logId: `log-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        ...(source ? { source } : {}),
        foodId: food.id || food.foodId,
        name: food.name,
        serving: food.serving,
        calories: food.calories,
        carbs: food.carbs || 0,
        protein: food.protein || 0,
        fat: food.fat || 0,
        fiber: food.fiber || 0,
        sugar: food.sugar || 0,
        sodium: food.sodium || 0,
        imageUrl: food.imageUrl || '',
      };
      writeToday((d) => ({
        ...d,
        meals: {
          ...d.meals,
          [meal]: [...(d.meals[meal] || []), entry],
        },
      }));
      pushRecent(food);
    },
    [writeToday, pushRecent],
  );

  const removeFood = useCallback(
    (meal, logId) => {
      if (!ensureEditable()) return;
      patchDay(dateKey, (d) => ({
        ...d,
        meals: {
          ...d.meals,
          [meal]: (d.meals[meal] || []).filter((item) => item.logId !== logId),
        },
      }));
    },
    [dateKey, patchDay, ensureEditable],
  );

  const addCustomFood = useCallback((food) => {
    const entry = {
      id: `cf-${Date.now()}`,
      brand: food.brand || 'Custom',
      ...food,
    };
    setCustomFoods((prev) => [entry, ...prev]);
    return entry;
  }, []);

  const addExercise = useCallback(
    (item) => {
      writeToday((d) => ({
        ...d,
        exercise: [...d.exercise, { logId: `ex-${Date.now()}`, ...item }],
      }));
    },
    [writeToday],
  );

  /**
   * Add today's entry, or replace it when one with the same logId is already there
   * (a home session saved when paused / left, then finished later).
   */
  const upsertExercise = useCallback(
    (item) => {
      if (!item?.logId) return;
      writeToday((d) => {
        const at = d.exercise.findIndex((e) => e.logId === item.logId);
        if (at < 0) return { ...d, exercise: [...d.exercise, item] };
        const exercise = [...d.exercise];
        exercise[at] = item;
        return { ...d, exercise };
      });
    },
    [writeToday],
  );

  const removeExercise = useCallback(
    (logId) => {
      if (!ensureEditable()) return;
      patchDay(dateKey, (d) => ({
        ...d,
        exercise: d.exercise.filter((item) => item.logId !== logId),
      }));
    },
    [dateKey, patchDay, ensureEditable],
  );

  const addWater = useCallback(() => {
    writeToday((d) => ({
      ...d,
      water: Math.min(d.water + 1, profile.waterGoal),
    }));
  }, [writeToday, profile.waterGoal]);

  const addWaterAmount = useCallback(
    (glasses) => {
      const n = Number(glasses) || 0;
      if (n <= 0) return;
      writeToday((d) => ({
        ...d,
        water: Math.min(d.water + n, profile.waterGoal),
      }));
    },
    [writeToday, profile.waterGoal],
  );

  const resetWater = useCallback(() => {
    if (!ensureEditable()) return;
    patchDay(dateKey, (d) => ({ ...d, water: 0 }));
  }, [dateKey, patchDay, ensureEditable]);

  const resetDay = useCallback(() => {
    if (!ensureEditable()) return;
    patchDay(dateKey, emptyDay());
  }, [dateKey, patchDay, ensureEditable]);

  const resetForTesting = useCallback(() => {
    skipSave.current = true;
    setDateKeyState(todayKey());
    setDays(seedDays());
    setGoal('lose');
    setProfile(DEFAULT_PROFILE);
    setWeightLogs([]);
    setFavorites([]);
    setRecentFoods([]);
    setCustomFoods([]);
    setReminders(DEFAULT_REMINDERS);
    setGrocery(seedGrocery());
    setMealPlan(seedMealPlan());
    writeDiaryState({
      ...DEFAULT_STATE,
      dateKey: todayKey(),
      days: seedDays(),
    })
      .catch(() => {})
      .finally(() => {
        skipSave.current = false;
      });
  }, []);

  const updateProfile = useCallback((patch) => {
    setProfile((prev) => ({ ...prev, ...patch }));
  }, []);

  const addWeightLog = useCallback((weight) => {
    const value = Number(weight);
    if (!value || Number.isNaN(value)) return;
    const now = new Date();
    const entry = {
      id: `w-${now.getTime()}`,
      date: todayKey(),
      // Every update is kept with its time, so the history shows each one (several a day too).
      at: now.toISOString(),
      weight: Math.round(value * 10) / 10,
    };
    setWeightLogs((prev) => [entry, ...prev]);
    setProfile((prev) => ({ ...prev, weight: entry.weight }));
  }, []);

  const favoriteIdOf = (f) => String(f?.id || f?.foodId || '');

  const isFavorite = useCallback(
    (foodId) => !!foodId && favorites.some((f) => favoriteIdOf(f) === String(foodId)),
    [favorites],
  );

  /**
   * Heart / un-heart a food. Pass the food object (needed to add); an id is enough to remove.
   * Updates instantly, then saves to the user's account — reverts if the server says no.
   */
  const toggleFavorite = useCallback(
    async (foodOrId) => {
      const food = typeof foodOrId === 'object' ? foodOrId : null;
      const foodId = String(food ? food.id || food.foodId || '' : foodOrId || '');
      if (!foodId) return;

      const snapshot = favorites;
      const exists = favorites.some((f) => favoriteIdOf(f) === foodId);
      if (!exists && !food) return;

      const entry = food ? { ...food, id: foodId, foodId } : null;
      setFavorites(exists ? favorites.filter((f) => favoriteIdOf(f) !== foodId) : [entry, ...favorites]);

      const token = tokenRef.current;
      if (!token) return;
      try {
        const data = exists
          ? await apiRemoveFavorite(token, foodId)
          : await apiAddFavorite(token, foodId);
        if (Array.isArray(data?.favorites)) setFavorites(data.favorites);
        toast.success(exists ? 'Removed from favorites' : 'Added to favorites');
      } catch (err) {
        setFavorites(snapshot);
        toast.error(err?.message || 'Could not update favorites');
      }
    },
    [favorites],
  );

  const updateReminder = useCallback((key, value) => {
    setReminders((prev) => ({ ...prev, [key]: value }));
  }, []);

  const toggleGroceryItem = useCallback((id) => {
    setGrocery((prev) =>
      prev.map((item) => (item.id === id ? { ...item, checked: !item.checked } : item)),
    );
  }, []);

  const addGroceryItem = useCallback((item) => {
    setGrocery((prev) => [
      {
        id: `g-${Date.now()}`,
        aisle: item.aisle || 'Other',
        name: item.name,
        qty: item.qty || '1',
        checked: false,
      },
      ...prev,
    ]);
  }, []);

  const removeGroceryItem = useCallback((id) => {
    setGrocery((prev) => prev.filter((item) => item.id !== id));
  }, []);

  const updateGroceryItem = useCallback((id, patch) => {
    setGrocery((prev) => prev.map((item) => (item.id === id ? { ...item, ...patch } : item)));
  }, []);

  const addMealPlanItem = useCallback((dayKey, item) => {
    setMealPlan((prev) => ({
      ...prev,
      [dayKey]: [
        ...(prev[dayKey] || []),
        {
          id: `mp-${Date.now()}`,
          mealType: item.mealType || 'Snack',
          name: item.name,
          calories: Number(item.calories) || 0,
          protein: Number(item.protein) || 0,
          carbs: Number(item.carbs) || 0,
          fat: Number(item.fat) || 0,
        },
      ],
    }));
  }, []);

  const removeMealPlanItem = useCallback((dayKey, id) => {
    setMealPlan((prev) => ({
      ...prev,
      [dayKey]: (prev[dayKey] || []).filter((m) => m.id !== id),
    }));
  }, []);

  const updateMealPlanItem = useCallback((dayKey, id, patch) => {
    setMealPlan((prev) => ({
      ...prev,
      [dayKey]: (prev[dayKey] || []).map((m) => (m.id === id ? { ...m, ...patch } : m)),
    }));
  }, []);

  // First load only: nothing to show yet. Cached days (from a previous session) show straight away instead.
  const hasCachedDays = Object.values(days).some(dayHasEntries);
  const diaryLoading =
    !hydrated || !authHydrated || (!!accessToken && diaryLoadedFor !== accessToken && !hasCachedDays);
  const favoritesLoading = !!accessToken && favoritesLoadedFor !== accessToken && !favorites.length;

  const value = {
    hydrated,
    /** true until the diary has something to show — use for a full-screen loader */
    diaryLoading,
    favoritesLoading,
    dateKey,
    setDateKey,
    /** Fetch a day older than the synced window (screens that keep their own date call this). */
    loadDay,
    /** Today's date key; changes at midnight so screens can follow it. */
    today,
    canEdit,
    syncing,
    days,
    meals,
    exercise,
    water,
    goal,
    setGoal,
    profile,
    updateProfile,
    totals,
    burned,
    remaining,
    addFood,
    removeFood,
    addCustomFood,
    customFoods,
    recentFoods,
    addExercise,
    upsertExercise,
    removeExercise,
    addWater,
    addWaterAmount,
    resetWater,
    resetDay,
    resetForTesting,
    weightLogs,
    addWeightLog,
    favorites,
    isFavorite,
    toggleFavorite,
    reminders,
    updateReminder,
    grocery,
    toggleGroceryItem,
    addGroceryItem,
    removeGroceryItem,
    updateGroceryItem,
    mealPlan,
    addMealPlanItem,
    removeMealPlanItem,
    updateMealPlanItem,
  };

  return <DiaryContext.Provider value={value}>{children}</DiaryContext.Provider>;
}

export function useDiary() {
  const ctx = useContext(DiaryContext);
  if (!ctx) throw new Error('useDiary must be used within DiaryProvider');
  return ctx;
}
