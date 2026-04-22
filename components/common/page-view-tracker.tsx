'use client';

import { useEffect, useRef } from 'react';

/**
 * Fires a single POST /api/stats { action: 'page_view' } on mount.
 * Placed once in the root layout so every full-page navigation counts.
 */
export function PageViewTracker() {
  const recorded = useRef(false);

  useEffect(() => {
    // Guard against React strict-mode double-mount
    if (recorded.current) return;
    recorded.current = true;

    fetch('/api/stats', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action: 'page_view' }),
    }).catch(() => {
      // best-effort, silently ignore
    });
  }, []);

  return null;
}
