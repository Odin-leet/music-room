import type { TrackSummary } from '@music-room/shared';
import { useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';

// Search Deezer (through our API) as you type: from 2 letters, a moment
// after the last key. Older answers never overwrite a newer search.
export function useTrackSearch(query: string) {
  const { authedApi } = useSession();
  const [results, setResults] = useState<TrackSummary[] | null>(null);
  const [searching, setSearching] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const q = query.trim();

  useEffect(() => {
    if (q.length < 2) return;
    let cancelled = false;
    const timer = setTimeout(() => {
      setSearching(true);
      setError(null);
      authedApi<TrackSummary[]>(`/music/search?q=${encodeURIComponent(q)}`)
        .then(
          (r) => {
            if (!cancelled) setResults(r);
          },
          (err: unknown) => {
            if (!cancelled) setError(err instanceof ApiError ? err.message : 'Search failed');
          },
        )
        .finally(() => {
          if (!cancelled) setSearching(false);
        });
    }, 350);
    return () => {
      cancelled = true;
      clearTimeout(timer);
    };
  }, [authedApi, q]);

  return { results: q.length >= 2 ? results : null, searching, error };
}

export const duration = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
