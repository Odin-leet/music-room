import type { SignInMethods } from '@music-room/shared';
import { useEffect } from 'react';
import { useNavigate } from 'react-router';
import { ApiError } from '@/api/client';
import { socialErrorMessage, takePendingOAuth } from '@/session/oauthFlow';
import { useSession } from '@/session/SessionProvider';
import { Spinner } from '@/ui';

type Outcome = { to: string; state?: unknown };

// Finishing happens once per return link, even though this page can mount
// twice: React's StrictMode does it in development, and a social login
// flips the session to signed in, which swaps the route tree under it. The
// login code / link ticket is single-use, so the second mount just waits for
// the first one's result.
let current: { key: string; outcome: Promise<Outcome> } | null = null;

// Where the API sends the browser back after Google / Facebook:
//   /oauth?code=…   a sign-in: exchange the code (+ the PKCE verifier) for tokens
//   /oauth?link=…   linking a provider to your account: confirm the ticket
//   /oauth?error=…  cancelled or refused
export function OAuthReturnPage() {
  const { status, completeSocialLogin, authedApi } = useSession();
  const navigate = useNavigate();

  useEffect(() => {
    const key = window.location.search;
    if (!current || current.key !== key) {
      current = { key, outcome: finish(new URLSearchParams(key)) };
    }
    let cancelled = false;
    void current.outcome.then((o) => {
      if (!cancelled) navigate(o.to, { replace: true, state: o.state });
    });
    return () => {
      cancelled = true;
    };

    async function finish(params: URLSearchParams): Promise<Outcome> {
      const pending = takePendingOAuth();
      if (!pending) return { to: '/' }; // opened directly, or too late
      const error = params.get('error');

      if (pending.mode === 'login') {
        const code = params.get('code');
        if (error || !code) {
          return { to: '/login', state: { from: pending.returnTo, socialError: socialErrorMessage(error ?? 'unknown', pending.provider) } };
        }
        try {
          await completeSocialLogin(code, pending.verifier);
          return { to: pending.returnTo };
        } catch (err) {
          return { to: '/login', state: { socialError: err instanceof ApiError ? err.message : socialErrorMessage('unknown', pending.provider) } };
        }
      }

      // Link mode: needs the signed-in session (restored from this browser).
      const ticket = params.get('link');
      if (status !== 'signedIn') return { to: '/login' };
      if (error || !ticket) return { to: '/profile', state: { linkError: socialErrorMessage(error ?? 'unknown', pending.provider, 'link') } };
      try {
        const methods = await authedApi<SignInMethods>('/auth/link/confirm', {
          method: 'POST',
          body: { ticket, codeVerifier: pending.verifier },
        });
        return { to: '/profile', state: { linked: pending.provider, methods } };
      } catch (err) {
        // e.g. 409 "already linked to another account"
        return { to: '/profile', state: { linkError: err instanceof ApiError ? err.message : socialErrorMessage('unknown', pending.provider, 'link') } };
      }
    }
    // Runs once per mount: everything it needs is read when it starts.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="full-center">
      <Spinner large />
      <p className="muted">Signing you in…</p>
    </div>
  );
}
