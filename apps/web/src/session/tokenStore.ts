import { storage } from '@/lib/storage';

// Only the refresh token is persisted, in this browser's localStorage. The
// access token lives in memory only (15 min): a reload gets a fresh one from
// /auth/refresh. localStorage is readable by any script on this origin, so
// the app renders no HTML from the API (React escapes text) and loads no
// third-party scripts. See docs/security.md → "Web app".
export const REFRESH_TOKEN_KEY = 'holy.refreshToken';

export const tokenStore = {
  getRefreshToken: () => storage.get(REFRESH_TOKEN_KEY),
  setRefreshToken: (token: string) => storage.set(REFRESH_TOKEN_KEY, token),
  clear: () => storage.remove(REFRESH_TOKEN_KEY),
};

// Every open tab shares that one refresh token, and the API rotates it on
// each refresh and treats a reused one as theft (revoking every session).
// So refreshes are serialised across tabs: whoever holds the lock reads the
// LATEST stored token, swaps it, and stores the new one before letting go.
export function withRefreshLock<T>(run: () => Promise<T>): Promise<T> {
  if (typeof navigator !== 'undefined' && navigator.locks) {
    return navigator.locks.request('holy.refresh', run);
  }
  return run(); // very old browsers: at least one refresh per tab at a time
}
