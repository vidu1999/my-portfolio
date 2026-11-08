'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { getModelSnapshot, subscribeModelReadiness } from '@/app/lib/modelReadiness';

/**
 * Real loading progress — never a fake timer.
 *
 * Each signal carries a weight; the reported target is the weighted sum of the
 * signals that have actually resolved. The visible value eases toward that
 * target and is hard-capped at 99 until *every* signal is done and the minimum
 * display time has elapsed, so the bar can never hit 100% while the app is
 * still loading.
 *
 * Every signal also has a timeout so a failed request can never hang the
 * loader forever.
 */

// The page's 3D models dominate: the loader must stay up until they have really
// finished, so `models` carries the largest weight and the longest timeout.
const SIGNALS = [
  { id: 'document', weight: 10, timeout: 10000 },
  { id: 'fonts', weight: 8, timeout: 8000 },
  { id: 'scene', weight: 15, timeout: 4500 },
  { id: 'assets', weight: 12, timeout: 6000 },
  { id: 'mounted', weight: 5, timeout: 6000 },
  { id: 'minimum', weight: 10, timeout: 0 },
  { id: 'models', weight: 40, timeout: 18000 },
];

const TOTAL_WEIGHT = SIGNALS.reduce((sum, s) => sum + s.weight, 0);
// Raised from 7s: waiting on real models is the point, so the safety net has to
// sit above the model timeout rather than cutting it off.
const HARD_TIMEOUT = 20000;
// A page with no 3D content at all must not wait for models that never register.
const MODEL_GRACE = 3000;

export function useLoadingProgress({ minDuration = 2600, assets = [], enabled = true } = {}) {
  const [percent, setPercent] = useState(0);
  const [complete, setComplete] = useState(false);

  // Mutable progress record — written by signal callbacks, read by the rAF loop.
  const record = useRef(null);
  if (record.current === null) {
    record.current = {
      done: Object.create(null),
      partial: Object.create(null),
      start: 0,
      value: 0,
      lastInt: -1,
      finished: false,
    };
  }

  const mark = useRef((id, fraction = 1) => {
    const r = record.current;
    if (fraction >= 1) r.done[id] = true;
    else r.partial[id] = Math.max(r.partial[id] || 0, fraction);
  });

  useEffect(() => {
    if (!enabled) return undefined;

    const r = record.current;
    r.start = performance.now();
    const timers = [];
    const cleanups = [];

    const settle = (id) => mark.current(id, 1);

    // --- document readiness -------------------------------------------------
    if (document.readyState === 'complete') settle('document');
    else {
      const onLoad = () => settle('document');
      window.addEventListener('load', onLoad, { once: true });
      cleanups.push(() => window.removeEventListener('load', onLoad));
    }

    // --- webfonts -----------------------------------------------------------
    if (document.fonts && document.fonts.ready) {
      document.fonts.ready.then(() => settle('fonts')).catch(() => settle('fonts'));
    } else {
      settle('fonts');
    }

    // --- React has mounted the real page ------------------------------------
    settle('mounted');

    // --- critical images actually decoded -----------------------------------
    if (assets.length === 0) {
      settle('assets');
    } else {
      let settled = 0;
      const bump = () => {
        settled += 1;
        mark.current('assets', settled / assets.length);
      };
      assets.forEach((src) => {
        const img = new Image();
        let acted = false;
        const once = () => { if (!acted) { acted = true; bump(); } };
        img.onload = () => {
          if (typeof img.decode === 'function') img.decode().then(once, once);
          else once();
        };
        img.onerror = once; // a broken asset must not block the loader
        img.src = src;
        cleanups.push(() => { img.onload = null; img.onerror = null; acted = true; });
      });
    }

    // --- the page's real 3D models ------------------------------------------
    // Settles only when every registered Suspense boundary has finished, whether
    // it resolved or errored. A 404 or an LFS pointer still counts as finished so
    // a broken asset can never strand the loader.
    {
      const applyModels = () => {
        const { pending, settled: ok, failed: bad, started } = getModelSnapshot();
        if (started && pending === 0) {
          settle('models');
          return true;
        }
        const done = ok + bad;
        if (done + pending > 0) mark.current('models', done / (done + pending));
        return false;
      };
      if (!applyModels()) {
        const unsub = subscribeModelReadiness(applyModels);
        cleanups.push(unsub);
        // No model canvas registered within the grace window => this page has
        // no 3D content, so there is nothing to wait for.
        timers.push(setTimeout(() => {
          if (!getModelSnapshot().started) settle('models');
        }, MODEL_GRACE));
      }
    }

    // --- minimum on-screen time ---------------------------------------------
    timers.push(setTimeout(() => settle('minimum'), minDuration));

    // --- per-signal safety timeouts ------------------------------------------
    SIGNALS.forEach(({ id, timeout }) => {
      if (timeout > 0) timers.push(setTimeout(() => settle(id), timeout));
    });
    timers.push(setTimeout(() => SIGNALS.forEach((s) => settle(s.id)), HARD_TIMEOUT));

    // Authoritative completion on the wall clock. The rAF easing below can be
    // starved on a very slow GPU, so completion must not depend on frames
    // arriving — otherwise a weak device could sit near 100% indefinitely.
    timers.push(setTimeout(() => {
      if (r.finished) return;
      r.finished = true;
      r.value = 100;
      r.lastInt = 100;
      setPercent(100);
      setComplete(true);
    }, HARD_TIMEOUT + 1200));

    // --- easing loop ----------------------------------------------------------
    let raf = 0;
    let prev = performance.now();

    const tick = (now) => {
      // Track real elapsed time. A tight clamp here would make the bar crawl on
      // slow devices (few frames per second), stretching a 3s loader into 30s.
      const dt = Math.min((now - prev) / 1000, 0.5);
      prev = now;

      let earned = 0;
      let allDone = true;
      for (const { id, weight } of SIGNALS) {
        if (r.done[id]) earned += weight;
        else {
          allDone = false;
          earned += weight * (r.partial[id] || 0);
        }
      }

      // Absolute wall-clock guarantee: even at 1 fps the loader must finish.
      const overdue = now - r.start > HARD_TIMEOUT + 2000;
      if (overdue) allDone = true;

      const target = allDone ? 100 : Math.min(99, (earned / TOTAL_WEIGHT) * 100);
      // Exponential ease, frame-rate independent. Clamped so the bar can never
      // travel backwards: a progress indicator must be monotonic even if a
      // readiness signal ever reports a smaller fraction than it did before.
      const eased = r.value + (target - r.value) * (1 - Math.exp(-4.2 * dt));
      r.value = Math.max(r.value, eased);
      if (allDone && target - r.value < 0.6) r.value = 100;
      if (overdue && r.value > 96) r.value = 100;

      const shown = Math.max(
        r.lastInt,
        Math.min(allDone ? 100 : 99, Math.round(r.value))
      );
      if (shown !== r.lastInt) {
        r.lastInt = shown;
        setPercent(shown);
      }

      if (r.value >= 100 && allDone) {
        if (!r.finished) { r.finished = true; setComplete(true); }
        return;
      }
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);

    return () => {
      cancelAnimationFrame(raf);
      timers.forEach(clearTimeout);
      cleanups.forEach((fn) => fn());
    };
  }, [enabled, minDuration, assets]);

  // Stable identities so memoized children (the WebGL scene) never re-render
  // just because the percentage ticked up.
  const markSceneReady = useCallback(() => mark.current('scene', 1), []);
  const markSceneFraction = useCallback((f) => mark.current('scene', f), []);

  return { percent, complete, markSceneReady, markSceneFraction };
}
