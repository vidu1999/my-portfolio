/**
 * Tracks the page's real 3D content so the loading screen can stay up until the
 * models have actually loaded, instead of leaving on a fixed timer.
 *
 * The wrapper that owns a model canvas registers on mount and settles when its
 * Suspense content commits, its error boundary catches, or it unmounts. Because
 * React runs child effects before parent effects, a cached model can resolve
 * before its wrapper registers — so finished ids are remembered and a later
 * begin for an already-finished id is a no-op. That makes the pair order-
 * independent instead of relying on mount timing.
 *
 * Failures settle too. A model that 404s or turns out to be a Git LFS pointer
 * must not strand the loader — "settled" means finished, not necessarily happy.
 */

const pending = new Set();
const finished = new Set();
let settled = 0;
let failed = 0;
let started = false;

const listeners = new Set();
const emit = () => { for (const fn of listeners) fn(); };

/** The page has a model canvas, so 3D content is expected. Idempotent per id. */
export function beginModelWork(id) {
  if (!id || finished.has(id) || pending.has(id)) return;
  pending.add(id);
  started = true;
  emit();
}

/** That content resolved (ok), errored, or went away (!ok). Idempotent per id. */
export function endModelWork(id, ok = true) {
  if (!id || finished.has(id)) return;
  finished.add(id);
  pending.delete(id);
  if (ok) settled += 1;
  else failed += 1;
  started = true;
  emit();
}

export function getModelSnapshot() {
  return { pending: pending.size, settled, failed, started };
}

export function subscribeModelReadiness(fn) {
  listeners.add(fn);
  return () => { listeners.delete(fn); };
}

/** Test/dev helper — not used by the app. */
export function resetModelReadiness() {
  pending.clear();
  finished.clear();
  settled = 0;
  failed = 0;
  started = false;
  emit();
}
