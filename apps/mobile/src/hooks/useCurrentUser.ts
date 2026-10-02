import type { CurrentUser } from '@music-room/shared';
import { useCallback, useEffect, useState } from 'react';
import { ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';

export type CurrentUserState =
  | { state: 'loading' }
  | { state: 'ok'; user: CurrentUser }
  | { state: 'error'; message: string };

// Loads GET /users/me for the signed-in user. An expired access token is
// refreshed transparently by authedApi; if the session is truly over, the
// SessionProvider signs out and the router leaves this screen.
export function useCurrentUser() {
  const { authedApi, signOut } = useSession();
  const [result, setResult] = useState<CurrentUserState>({ state: 'loading' });

  const load = useCallback(
    () =>
      authedApi<CurrentUser>('/users/me').then(
        (user): CurrentUserState => ({ state: 'ok', user }),
        (err: unknown): CurrentUserState | null => {
          // 404: the account was deleted after login.
          if (err instanceof ApiError && err.status === 404) {
            void signOut();
            return null;
          }
          // 401 here means the refresh failed too: already signed out.
          if (err instanceof ApiError && err.status === 401) return null;
          return {
            state: 'error',
            message: err instanceof ApiError ? err.message : 'Something went wrong',
          };
        },
      ),
    [authedApi, signOut],
  );

  useEffect(() => {
    let cancelled = false;
    void load().then((next) => {
      if (!cancelled && next) setResult(next);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = useCallback(async () => {
    const next = await load();
    if (next) setResult(next);
  }, [load]);

  return { me: result, reload };
}
