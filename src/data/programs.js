/**
 * Programs (More → Programs) come from the admin panel: GET /api/programs.
 * The lists start empty and are filled in place by applyProgramCatalog (phone cache, then server).
 */

/** [{ id, title, subtitle, programs: [program] }] — only groups that have programs. */
export const PROGRAM_GROUPS = [];
const BY_ID = new Map();

let version = '';
const listeners = new Set();

/** Use the catalog from GET /api/programs. Ignored when it is malformed. */
export function applyProgramCatalog(data) {
  const groups = Array.isArray(data?.groups) ? data.groups.filter((g) => g?.id && g?.title) : null;
  const programs = Array.isArray(data?.programs) ? data.programs.filter((p) => p?.id && p?.title) : null;
  if (!groups || !programs) return false;

  const nested = groups
    .map((g) => ({ ...g, programs: programs.filter((p) => p.group === g.id) }))
    .filter((g) => g.programs.length);
  PROGRAM_GROUPS.splice(0, PROGRAM_GROUPS.length, ...nested);
  BY_ID.clear();
  nested.forEach((g) => g.programs.forEach((p) => BY_ID.set(p.id, { ...p, groupTitle: g.title })));

  version = String(data.version || Date.now());
  listeners.forEach((fn) => fn(version));
  return true;
}

export function programCatalogVersion() {
  return version;
}

export function onProgramCatalogChange(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function getProgramById(id) {
  return BY_ID.get(id) || null;
}

/** "12 weeks · 4×/wk · core, cardio, deficit" */
export function programMeta(p) {
  return [`${p.weeks} weeks`, `${p.sessionsPerWeek}×/wk`, p.focus].filter(Boolean).join(' · ');
}

/**
 * Progress for one program from the user's saved record ({ startedAt, done: [sessionId] }).
 * Sessions the admin later removed are not counted.
 */
export function programProgress(program, record) {
  const sessions = program?.sessions || [];
  const doneIds = new Set(record?.done || []);
  const done = sessions.filter((s) => doneIds.has(s.id)).length;
  const next = sessions.find((s) => !doneIds.has(s.id)) || null;
  return {
    started: Boolean(record),
    done,
    total: sessions.length,
    pct: sessions.length ? done / sessions.length : 0,
    finished: Boolean(record) && sessions.length > 0 && done === sessions.length,
    next,
    week: next ? next.week : sessions[sessions.length - 1]?.week || 1,
  };
}
