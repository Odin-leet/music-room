import type { AuthTokens } from '@music-room/shared';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError } from '@/api/client';
import { tokenStore } from './tokenStore';

type Status = 'restoring' | 'signedOut' | 'signedIn';

export type RegisterInput = { email: string; password: string; displayName: string };

type Session = {
  status: Status;
  // In memory only (15 min lifetime). Never persisted.
  accessToken: string | null;
  signIn: (email: string, password: string) => Promise<void>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

// Run at most once per app launch. The API rotates refresh tokens and treats a
// reused one as theft (revoking every session), so a second /auth/refresh with
// the same stored token — e.g. an effect running twice — would log us out.
let restorePromise: Promise<AuthTokens | null> | null = null;

function restoreOnce() {
  restorePromise ??= (async () => {
    const refreshToken = await tokenStore.getRefreshToken();
    if (!refreshToken) return null;
    try {
      const tokens = await api<AuthTokens>('/auth/refresh', {
        method: 'POST',
        body: { refreshToken },
      });
      await tokenStore.setRefreshToken(tokens.refreshToken);
      return tokens;
    } catch (err) {
      // 401: expired/revoked — forget it. Network error: keep it, so the
      // session can still be restored on a later launch.
      if (err instanceof ApiError && err.status === 401) await tokenStore.clear();
      return null;
    }
  })();
  return restorePromise;
}

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('restoring');
  const [accessToken, setAccessToken] = useState<string | null>(null);

  useEffect(() => {
    void restoreOnce().then((tokens) => {
      setAccessToken(tokens?.accessToken ?? null);
      setStatus(tokens ? 'signedIn' : 'signedOut');
    });
  }, []);

  const startSession = useCallback(async (tokens: AuthTokens) => {
    await tokenStore.setRefreshToken(tokens.refreshToken);
    setAccessToken(tokens.accessToken);
    setStatus('signedIn');
  }, []);

  const signIn = useCallback(
    async (email: string, password: string) => {
      const tokens = await api<AuthTokens>('/auth/login', {
        method: 'POST',
        body: { email, password },
      });
      await startSession(tokens);
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
    const refreshToken = await tokenStore.getRefreshToken();
    // Local sign-out always succeeds; telling the server is best effort.
    await tokenStore.clear();
    setAccessToken(null);
    setStatus('signedOut');
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
    }
  }, []);

  const value = useMemo<Session>(
    () => ({ status, accessToken, signIn, register, signOut }),
    [status, accessToken, signIn, register, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}
