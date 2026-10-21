import { getApiUrl } from '@/config';
import { createPkcePair } from './pkce';

export type SocialProvider = 'google' | 'facebook';

export const PROVIDER_NAME: Record<SocialProvider, string> = { google: 'Google', facebook: 'Facebook' };

// A social login (or link) in progress. The browser leaves the app for the
// provider's page and comes back to /oauth, so what the app needs to finish
// — above all the PKCE verifier — waits in sessionStorage (this tab only,
// gone when it closes). Never the tokens: those come after the exchange.
export type PendingOAuth = {
  mode: 'login' | 'link';
  provider: SocialProvider;
  verifier: string;
  returnTo: string; // where to land afterwards
  startedAt: number;
};

const KEY = 'holy.oauth';
const MAX_AGE_MS = 10 * 60_000; // the API's state token lasts 10 minutes too

// The page the API sends the browser back to. Its origin must be in the
// API's WEB_ORIGINS (see apps/api/src/auth/app-redirect.ts).
export const returnUrl = () => `${window.location.origin}/oauth`;

function save(pending: PendingOAuth) {
  sessionStorage.setItem(KEY, JSON.stringify(pending));
}

// Read once: the code / ticket is single-use, so is what finishes it.
export function takePendingOAuth(): PendingOAuth | null {
  try {
    const raw = sessionStorage.getItem(KEY);
    sessionStorage.removeItem(KEY);
    if (!raw) return null;
    const p = JSON.parse(raw) as PendingOAuth;
    return Date.now() - p.startedAt < MAX_AGE_MS ? p : null;
  } catch {
    return null;
  }
}

// "Continue with Google": off to our API, which runs the provider's flow.
export async function startSocialLogin(provider: SocialProvider, returnTo: string) {
  const { verifier, challenge } = await createPkcePair();
  save({ mode: 'login', provider, verifier, returnTo, startedAt: Date.now() });
  window.location.assign(
    `${getApiUrl()}/auth/${provider}/start?redirect=${encodeURIComponent(returnUrl())}&code_challenge=${challenge}`,
  );
}

// "Link Google" on your profile: the API gives the provider URL (it needs
// your access token to know which account to link to).
export async function startLink(
  provider: SocialProvider,
  requestLinkUrl: (body: { redirect: string; codeChallenge: string }) => Promise<{ url: string }>,
) {
  const { verifier, challenge } = await createPkcePair();
  const { url } = await requestLinkUrl({ redirect: returnUrl(), codeChallenge: challenge });
  save({ mode: 'link', provider, verifier, returnTo: '/profile', startedAt: Date.now() });
  window.location.assign(url);
}

// What the API's ?error= codes mean, for people.
export function socialErrorMessage(code: string, provider: SocialProvider, mode: 'login' | 'link' = 'login') {
  const name = PROVIDER_NAME[provider];
  if (mode === 'link') {
    return code === 'access_denied' ? `${name} was cancelled.` : `Linking ${name} failed. Please try again.`;
  }
  switch (code) {
    case 'account_exists':
      // Deliberately doesn't say *how* that account signs in: that would
      // tell anyone with this email which method to attack.
      return 'This email already has a HOLY account. Sign in the way you created it — with your password or another provider.';
    case 'email_required':
      return `Your ${name} account has no email address. Add one on ${name}, or register with email.`;
    case 'access_denied':
      return `${name} sign-in was cancelled.`;
    default:
      return `${name} sign-in failed. Please try again.`;
  }
}
