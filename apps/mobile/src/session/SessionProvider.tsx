import type { AuthTokens } from '@music-room/shared';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { api, ApiError, type ApiOptions } from '@/api/client';
import { API_URL } from '@/config';
import { createPkcePair } from './pkce';
import { tokenStore } from './tokenStore';

type Status = 'restoring' | 'signedOut' | 'signedIn';

export type RegisterInput = { email: string; password: string; displayName: string };

// A social login that came back with an error from our API's callback, e.g.
// 'account_exists' (email taken, provider couldn't vouch for it) or
// 'access_denied' (user declined on Google's page).
export class SocialLoginError extends Error {
  constructor(readonly code: string) {
    super(code);
    this.name = 'SocialLoginError';
  }
}

type Session = {
  status: Status;
  // For calls to protected routes. Adds the access token and, when it has
  // expired (401), refreshes once and retries — the caller never sees it.
  authedApi: <T>(path: string, options?: Omit<ApiOptions, 'token'>) => Promise<T>;
  signIn: (email: string, password: string) => Promise<void>;
  // Resolves false if the user closed the browser; throws SocialLoginError otherwise.
  signInWithGoogle: () => Promise<boolean>;
  register: (input: RegisterInput) => Promise<void>;
  signOut: () => Promise<void>;
};

const SessionContext = createContext<Session | null>(null);

export function SessionProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<Status>('restoring');

  // Refs, not state: authedApi must always read the latest token, including
  // one set by a refresh that finished a moment ago in another request.
  // Access token lives in memory only (15 min); the refresh token in secure store.
  const accessTokenRef = useRef<string | null>(null);
  // The one refresh in flight, shared by everyone who needs it (see refresh()).
  const refreshInFlight = useRef<Promise<string | null> | null>(null);
  // Bumped on sign-out, so a refresh that finishes afterwards can't
  // resurrect a session the user just ended.
  const generation = useRef(0);

  const endSession = useCallback(async () => {
    generation.current += 1;
    accessTokenRef.current = null;
    await tokenStore.clear();
    setStatus('signedOut');
  }, []);

  const startSession = useCallback(async (tokens: AuthTokens) => {
    await tokenStore.setRefreshToken(tokens.refreshToken);
    accessTokenRef.current = tokens.accessToken;
    setStatus('signedIn');
  }, []);

  // Swap the stored refresh token for a new pair. Single-flight: the API
  // rotates refresh tokens and treats a reused one as theft (revoking every
  // session), so concurrent 401s must share ONE /auth/refresh, never send two.
  // Resolves to the new access token, or null if the session is over.
  const refresh = useCallback(() => {
    refreshInFlight.current ??= (async () => {
      const startedIn = generation.current;
      try {
        const refreshToken = await tokenStore.getRefreshToken();
        if (!refreshToken) return null;

        const tokens = await api<AuthTokens>('/auth/refresh', {
          method: 'POST',
          body: { refreshToken },
        });
        if (generation.current !== startedIn) return null; // signed out meanwhile
        await startSession(tokens);
        return tokens.accessToken;
      } catch (err) {
        // 401: refresh token expired/revoked/reused — the session is over.
        // Anything else (offline, 5xx): keep the stored token for later.
        if (err instanceof ApiError && err.status === 401) await endSession();
        throw err;
      } finally {
        refreshInFlight.current = null;
      }
    })();
    return refreshInFlight.current;
  }, [startSession, endSession]);

  // Restore on launch: a stored refresh token becomes a fresh access token.
  useEffect(() => {
    refresh()
      .then((accessToken) => {
        if (!accessToken) setStatus('signedOut');
      })
      .catch(() => setStatus('signedOut'));
  }, [refresh]);

  const authedApi = useCallback(
    async <T,>(path: string, options: Omit<ApiOptions, 'token'> = {}): Promise<T> => {
      // If a refresh is already running, wait for its token instead of
      // sending a request we know will 401.
      const token = refreshInFlight.current
        ? await refreshInFlight.current
        : accessTokenRef.current;
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

  // Browser route: our API runs the Google (OpenID Connect) flow and sends the
  // browser back to the app with a single-use code, which only this app can
  // exchange — it holds the PKCE verifier.
  const signInWithGoogle = useCallback(async () => {
    const { verifier, challenge } = await createPkcePair();
    // Expo Go: exp://…/--/oauth · our own builds: musicroom://oauth
    const returnUrl = Linking.createURL('oauth');
    const startUrl =
      `${API_URL}/auth/google/start` +
      `?redirect=${encodeURIComponent(returnUrl)}&code_challenge=${challenge}`;

    const result = await WebBrowser.openAuthSessionAsync(startUrl, returnUrl);
    if (result.type !== 'success') return false; // closed / dismissed

    const { queryParams } = Linking.parse(result.url);
    const code = typeof queryParams?.code === 'string' ? queryParams.code : null;
    if (!code) {
      const error = typeof queryParams?.error === 'string' ? queryParams.error : 'unknown';
      throw new SocialLoginError(error);
    }

    const tokens = await api<AuthTokens>('/auth/oauth/exchange', {
      method: 'POST',
      body: { code, codeVerifier: verifier },
    });
    await startSession(tokens);
    return true;
  }, [startSession]);

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
    await endSession();
    if (refreshToken) {
      await api('/auth/logout', { method: 'POST', body: { refreshToken } }).catch(() => {});
    }
  }, [endSession]);

  const value = useMemo<Session>(
    () => ({ status, authedApi, signIn, signInWithGoogle, register, signOut }),
    [status, authedApi, signIn, signInWithGoogle, register, signOut],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession() {
  const session = useContext(SessionContext);
  if (!session) throw new Error('useSession must be used inside <SessionProvider>');
  return session;
}
