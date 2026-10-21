import type { AuthTokens } from '@music-room/shared';
import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { api, ApiError, type ApiOptions } from '@/api/client';
import { REFRESH_TOKEN_KEY, tokenStore, withRefreshLock } from './tokenStore';

type Status = 'restoring' | 'signedOut' | 'signedIn';

export type RegisterInput = { email: string; password: string; displayName: string };

type Session = {
  status: Status;
  // For calls to protected routes. Adds the access token and, when it has
  // expired (401), refreshes once and retries — the caller never sees it.
  authedApi: <T>(path: string, options?: Omit<ApiOptions, 'token'>) => Promise<T>;
  // For connections that carry the token themselves (the realtime sockets).
  getAccessToken: () => string | null;
  refreshAccessToken: () => Promise<string | null>;
  signIn: (email: string, password: string) => Promise<void>;
  // The end of a social login: the code from /oauth + the PKCE verifier.
  completeSocialLogin: (code: string, verifier: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

// Same model as the mobile app (apps/mobile/src/session/SessionProvider.tsx):
// access token in memory, refresh token persisted, one refresh at a time —
// here across every open tab (see tokenStore.ts).
export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('restoring');

  // Refs, not state: authedApi must always read the latest token.
  const accessTokenRef = useRef<string | null>(null);
  // The one refresh in flight in this tab, shared by everyone who needs it.
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  // Bumped on sign-out, so a refresh that finishes afterwards can't
  // resurrect a session the user just ended.
  const generation = useRef(0);

  const endSession = useCallback(() => {
    generation.current += 1;
    accessTokenRef.current = null;
    tokenStore.clear();
    setStatus('signedOut');
  }, []);

  const startSession = useCallback((tokens: AuthTokens) => {
    tokenStore.setRefreshToken(tokens.refreshToken);
    accessTokenRef.current = tokens.accessToken;
    setStatus('signedIn');
  }, []);

  // Swap the stored refresh token for a new pair. Resolves to the new access
  // token, or null if the session is over.
  const refresh = useCallback(() => {
    refreshInFlight.current ??= (async () => {
      const startedIn = generation.current;
      try {
        return await withRefreshLock(async () => {
          // Read inside the lock: another tab may have just rotated it.
          const refreshToken = tokenStore.getRefreshToken();
          if (!refreshToken) return null;
          const tokens = await api<AuthTokens>('/auth/refresh', { method: 'POST', body: { refreshToken } });
          if (generation.current !== startedIn) return null; // signed out meanwhile
          startSession(tokens);
          return tokens.accessToken;
        });
      } catch (err) {
        // 401: refresh token expired / revoked / reused — the session is over.
        // Anything else (offline, 5xx): keep the stored token for later.
        if (err instanceof ApiError && err.status === 401) endSession();
        throw err;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    return refreshInFlight.current;
  }, [startSession, endSession]);

  // Restore on load: a stored refresh token becomes a fresh access token.
  useEffect(() => {
    refresh()
      .then((accessToken) => {
        if (!accessToken) setStatus('signedOut');
      })
      .catch(() => setStatus('signedOut'));
  }, [refresh]);

  // Other tabs: signing out there signs out here; signing in there (while
  // signed out here) signs in here too.
  useEffect(() => {
    const onStorage = (e: StorageEvent) => {
      if (e.key !== REFRESH_TOKEN_KEY) return;
      if (e.newValue === null && accessTokenRef.current) {
        generation.current += 1;
        accessTokenRef.current = null;
        setStatus('signedOut');
      } else if (e.newValue && !accessTokenRef.current) {
        void refresh().catch(() => undefined);
      }
    };
    window.addEventListener('storage', onStorage);
    return () => window.removeEventListener('storage', onStorage);
  }, [refresh]);

  const authedApi = useCallback(
    async <T,>(path: string, options: Omit<ApiOptions, 'token'> = {}): Promise<T> => {
      // If a refresh is already running, wait for its token instead of
      // sending a request we know will 401.
      const token = refreshInFlight.current ? await refreshInFlight.current : accessTokenRef.current;
      try {
        return await api<T>(path, { ...options, token });
      } catch (err) {
        if (!(err instanceof ApiError) || err.status !== 401) throw err;
        // Expired access token: refresh once, retry once.
        const fresh = await refresh();
        if (!fresh) throw err;
        return api<T>(path, { ...options, token: fresh });
      }
    },
    [refresh],
  );

  const getAccessToken = useCallback(() => accessTokenRef.current, []);
  const refreshAccessToken = useCallback(() => refresh().catch(() => null), [refresh]);

  const signIn = useCallback(
    async (email: string, password: string) => {
      startSession(await api<AuthTokens>('/auth/login', { method: 'POST', body: { email, password } }));
    },
    [startSession],
  );

  const completeSocialLogin = useCallback(
    async (code: string, verifier: string) => {
      startSession(
        await api<AuthTokens>('/auth/oauth/exchange', { method: 'POST', body: { code, codeVerifier: verifier } }),
      );
    },
    [startSession],
  );

  const register = useCallback(
    async (input: RegisterInput) => {
      await api('/auth/register', { method: 'POST', body: input });
      await signIn(input.email, input.password);
    },
    [signIn],
  );

  const signOut = useCallback(async () => {
    const refreshToken = tokenStore.getRefreshToken();
    // Local sign-out always succeeds; telling the server is best effort.
    endSession();
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
    }
  }, [endSession]);

  const value = useMemo<Session>(
    () => ({ status, authedApi, getAccessToken, refreshAccessToken, signIn, completeSocialLogin, register, signOut }),
    [status, authedApi, getAccessToken, refreshAccessToken, signIn, completeSocialLogin, register, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}
