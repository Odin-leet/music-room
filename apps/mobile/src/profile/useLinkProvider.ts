import type { SignInMethods } from '@music-room/shared';
import * as Linking from 'expo-linking';
import * as WebBrowser from 'expo-web-browser';
import { useCallback } from 'react';
import { createPkcePair } from '@/session/pkce';
import { SocialLoginError, useSession, type SocialProvider } from '@/session/SessionProvider';

// Link Google / Facebook to the logged-in account (API: docs in
// account-links.controller.ts). Same browser flow as "Continue with Google",
// but the browser brings back a short ticket instead of a login code, and
// the app confirms it with its access token + PKCE verifier: only this app,
// logged in as this user, can complete the link.
// Resolves to the new sign-in methods, or null if the browser was closed.
export function useLinkProvider() {
  const { authedApi } = useSession();

  return useCallback(
    async (provider: SocialProvider): Promise<SignInMethods | null> => {
      const { verifier, challenge } = await createPkcePair();
      // Expo Go: exp://…/--/oauth · our own builds: musicroom://oauth
      const returnUrl = Linking.createURL('oauth');
      const { url } = await authedApi<{ url: string }>(`/auth/${provider}/link`, {
        method: 'POST',
        body: { redirect: returnUrl, codeChallenge: challenge },
      });

      const result = await WebBrowser.openAuthSessionAsync(url, returnUrl);
      if (result.type !== 'success') return null;

      const { queryParams } = Linking.parse(result.url);
      const ticket = typeof queryParams?.link === 'string' ? queryParams.link : null;
      if (!ticket) {
        throw new SocialLoginError(typeof queryParams?.error === 'string' ? queryParams.error : 'unknown');
      }
      return authedApi<SignInMethods>('/auth/link/confirm', {
        method: 'POST',
        body: { ticket, codeVerifier: verifier },
      });
    },
    [authedApi],
  );
}
