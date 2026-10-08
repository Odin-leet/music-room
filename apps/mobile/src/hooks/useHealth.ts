import type { HealthResponse } from '@music-room/shared';
import { useCallback, useEffect, useState } from 'react';
import { getApiUrl } from '@/config';

export type Health =
  | { state: 'loading' }
  | { state: 'ok'; data: HealthResponse }
  | { state: 'error'; message: string };

async function fetchHealth(): Promise<Health> {
  try {
    const res = await fetch(`${getApiUrl()}/health`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return { state: 'ok', data: (await res.json()) as HealthResponse };
  } catch (err) {
    return { state: 'error', message: err instanceof Error ? err.message : String(err) };
  }
}

// Calls GET /health on mount; `check` re-runs it.
export function useHealth() {
  // Starts as 'loading', so the first request doesn't need to set it.
  const [health, setHealth] = useState<Health>({ state: 'loading' });

  useEffect(() => {
    let cancelled = false;
    void fetchHealth().then((result) => {
      if (!cancelled) setHealth(result);
    });
    // Don't update state if the screen unmounted before the response came back.
    return () => {
      cancelled = true;
    };
  }, []);

  const check = useCallback(async () => {
    setHealth({ state: 'loading' });
    setHealth(await fetchHealth());
  }, []);

  return { health, check };
}
