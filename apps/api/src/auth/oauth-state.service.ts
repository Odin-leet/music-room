import { BadRequestException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';

// Shared by every social-login provider (Google, Facebook).

// Where the API may send the browser back to: the mobile app only.
// exp:// = Expo Go in development, musicroom:// = our own builds (app.json scheme).
// Anything else is refused, so a crafted link can't redirect a login elsewhere.
const ALLOWED_APP_REDIRECTS = [/^exp:\/\//, /^musicroom:\/\//];

// PKCE S256 challenge = base64url(SHA-256(verifier)) = always 43 characters.
const PKCE_CHALLENGE = /^[A-Za-z0-9_-]{43}$/;

export type OAuthProvider = 'google' | 'facebook';
// linkUserId: null = sign in; a user id = "link this provider account to
// that (already logged-in) user" (see account-links.service.ts). It's inside
// the signed state, so it can't be changed on the way through the provider.
export type OAuthState = { redirect: string; codeChallenge: string; linkUserId: string | null };

// `state` is the OAuth parameter that round-trips through the provider and
// comes back to our callback. We make it a signed, 10-minute JWT holding the
// app's return link and PKCE challenge, so the callback can trust where to
// send the user, and a forged or replayed-late callback is rejected.
@Injectable()
export class OAuthStateService {
  constructor(private readonly jwtService: JwtService) {}

  // Validates what the app sent to /start, then signs it.
  create(provider: OAuthProvider, redirect?: string, codeChallenge?: string, linkUserId: string | null = null): string {
    const state: OAuthState = {
      redirect: this.assertAllowedAppRedirect(redirect),
      codeChallenge: this.assertValidChallenge(codeChallenge),
      linkUserId,
    };
    return this.jwtService.sign({ purpose: `${provider}-oauth-state`, ...state }, { expiresIn: '10m' });
  }

  // The purpose check stops a Google state being replayed into Facebook's callback.
  read(provider: OAuthProvider, token: string | undefined): OAuthState {
    try {
      const payload = this.jwtService.verify<OAuthState & { purpose: string }>(token ?? '');
      if (payload.purpose !== `${provider}-oauth-state`) throw new Error('wrong purpose');
      return {
        redirect: this.assertAllowedAppRedirect(payload.redirect),
        codeChallenge: this.assertValidChallenge(payload.codeChallenge),
        linkUserId: typeof payload.linkUserId === 'string' ? payload.linkUserId : null,
      };
    } catch {
      throw new BadRequestException('Invalid or expired sign-in attempt');
    }
  }

  private assertAllowedAppRedirect(redirect: string | undefined): string {
    if (!redirect || !ALLOWED_APP_REDIRECTS.some((re) => re.test(redirect))) {
      throw new BadRequestException('redirect must be an app deep link');
    }
    return redirect;
  }

  private assertValidChallenge(codeChallenge: string | undefined): string {
    if (!codeChallenge || !PKCE_CHALLENGE.test(codeChallenge)) {
      throw new BadRequestException('code_challenge must be a PKCE S256 challenge');
    }
    return codeChallenge;
  }
}
