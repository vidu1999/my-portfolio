'use client';

/**
 * Global render pause.
 *
 * While the cinematic loader is on screen the portfolio underneath is already
 * mounted (so it can load and lay out), but its WebGL canvases and particle
 * loops have no reason to draw — nothing is visible yet. Pausing them keeps
 * exactly one 3D scene rendering at a time, which cuts peak GPU memory and CPU
 * during the most expensive moment of the visit.
 *
 * Tiny external store: no context provider, no re-render cascades.
 */

let pauseCount = 0;
const listeners = new Set();

function emit() {
  listeners.forEach((fn) => {
    try { fn(pauseCount > 0); } catch { /* listener went away */ }
  });
}

/** Reference-counted so overlapping callers cannot un-pause each other. */
export function setRenderPaused(on) {
  pauseCount = Math.max(0, pauseCount + (on ? 1 : -1));
  emit();
  return () => {
    pauseCount = Math.max(0, pauseCount - 1);
    emit();
  };
}

export function isRenderPaused() {
  return pauseCount > 0;
}

export function subscribeRenderPaused(fn) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}
