'use client';

import { useEffect, useState } from 'react';

/**
 * Tracks whether the current tab is visible so decorative animation loops can
 * pause while the user is away. This reduces CPU/GPU work without changing the
 * visible experience when the tab is active.
 */
export function usePageVisible() {
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const update = () => setVisible(document.visibilityState !== 'hidden');
    update();
    document.addEventListener('visibilitychange', update);
    return () => document.removeEventListener('visibilitychange', update);
  }, []);

  return visible;
}
