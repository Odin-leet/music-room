import type { CurrentUser } from '@music-room/shared';
import { useEffect, useState } from 'react';
import { api, ApiError } from '@/api/client';
import { useSession } from '@/session/SessionProvider';

export type CurrentUserState =
  | { state: 'loading' }
  | { state: 'ok'; user: CurrentUser }
  | { state: 'error'; message: string };

// Loads GET /users/me for the signed-in user.
export function useCurrentUser(): CurrentUserState {
  const { accessToken, signOut } = useSession();
  const [result, setResult] = useState<CurrentUserState>({ state: 'loading' });

  useEffect(() => {
    if (!accessToken) return;
    let cancelled = false;

    api<CurrentUser>('/users/me', { token: accessToken })
      .then((user) => {
        if (!cancelled) setResult({ state: 'ok', user });
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        // 401: the access token expired (15 min) or the account is gone.
        // For now, sign out cleanly; M4 will refresh automatically instead.
        // 404: account deleted after login.
        if (err instanceof ApiError && (err.status === 401 || err.status === 404)) {
          void signOut();
          return;
        }
        setResult({
          state: 'error',
          message: err instanceof ApiError ? err.message : 'Something went wrong',
        });
      });

    return () => {
      cancelled = true;
    };
  }, [accessToken, signOut]);

  return result;
}
