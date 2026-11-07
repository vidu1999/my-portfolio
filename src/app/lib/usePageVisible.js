'use client';

import { useEffect, useState } from 'react';
import { isRenderPaused, subscribeRenderPaused } from './renderPause';

/**
 * Tracks whether decorative animation loops should run.
 *
 * False when the tab is hidden, and also while the cinematic loader owns the
 * screen (see renderPause) so the portfolio's canvases don't burn GPU behind an
 * opaque overlay. Reduces CPU/GPU work without changing the visible experience.
 */
export function usePageVisible() {
  const [visible, setVisible] = useState(true);
  const [paused, setPaused] = useState(false);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  useEffect(() => {
    setPaused(isRenderPaused());
    return subscribeRenderPaused(setPaused);
  }, []);

  return visible && !paused;
}
