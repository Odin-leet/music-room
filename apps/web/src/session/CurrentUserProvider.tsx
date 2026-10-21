import type { CurrentUser } from '@music-room/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ApiError } from '@/api/client';
import { useSession } from './SessionProvider';

export type CurrentUserState =
  | { state: 'loading' }
  | { state: 'ok'; user: CurrentUser }
  | { state: 'error'; message: string };

type CurrentUserContextValue = {
  me: CurrentUserState;
  reload: () => Promise<void>;
};

const CurrentUserContext = createContext<CurrentUserContextValue | null>(null);

// Loads GET /users/me once for the whole signed-in area, so every screen (and
// the (app) layout, which needs emailVerified to pick a screen) shares it.
// Expired access tokens are refreshed by authedApi; if the session is truly
// over, SessionProvider signs out and the router leaves the (app) group.
export function CurrentUserProvider({ children }: { children: ReactNode }) {
  const { authedApi, signOut } = useSession();
  const [me, setMe] = useState<CurrentUserState>({ state: 'loading' });

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
      if (!cancelled && next) setMe(next);
    });
    return () => {
      cancelled = true;
    };
  }, [load]);

  const reload = useCallback(async () => {
    const next = await load();
    if (next) setMe(next);
  }, [load]);

  const value = useMemo(() => ({ me, reload }), [me, reload]);
  return <CurrentUserContext.Provider value={value}>{children}</CurrentUserContext.Provider>;
}

export function useCurrentUser() {
  const value = useContext(CurrentUserContext);
  if (!value) throw new Error('useCurrentUser must be used inside <CurrentUserProvider>');
  return value;
}
