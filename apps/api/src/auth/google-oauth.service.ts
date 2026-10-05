import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { OAuth2Client } from 'google-auth-library';

// Where the API may send the browser back to: the mobile app only.
// exp:// = Expo Go in development, musicroom:// = our own builds (app.json scheme).
// Anything else is refused, so a crafted link can't redirect a login elsewhere.
const ALLOWED_APP_REDIRECTS = [/^exp:\/\//, /^musicroom:\/\//];

const STATE_PURPOSE = 'google-oauth-state';

export type GoogleProfile = {
  googleId: string;
  email: string;
  emailVerified: boolean;
  name: string;
};

// "Sign in with Google" = OpenID Connect, Authorization Code flow, with our
// API as the confidential client (the client secret never leaves the server).
@Injectable()
export class GoogleOAuthService {
  private readonly client: OAuth2Client;
  private readonly clientId: string;

  constructor(
    config: ConfigService,
    private readonly jwtService: JwtService,
  ) {
    this.clientId = config.getOrThrow<string>('GOOGLE_CLIENT_ID');
    this.client = new OAuth2Client({
      clientId: this.clientId,
      clientSecret: config.getOrThrow<string>('GOOGLE_CLIENT_SECRET'),
      // Must match an "Authorized redirect URI" in Google Cloud Console.
      redirectUri: config.get<string>(
        'GOOGLE_REDIRECT_URI',
        'http://localhost:3000/auth/google/callback',
      ),
    });
  }

  assertAllowedAppRedirect(redirect: string | undefined): string {
    if (!redirect || !ALLOWED_APP_REDIRECTS.some((re) => re.test(redirect))) {
      throw new BadRequestException('redirect must be an app deep link');
    }
    return redirect;
  }

  // The Google sign-in page URL. `state` round-trips through Google and comes
  // back to the callback: it's signed and short-lived, so the callback can
  // trust where to send the user and can't be fed a forged request.
  buildAuthUrl(appRedirect: string) {
    const state = this.jwtService.sign(
      { purpose: STATE_PURPOSE, redirect: appRedirect },
      { expiresIn: '10m' },
    );
    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      // Always show the account picker (handy when testing several accounts).
      prompt: 'select_account',
    });
  }

  // Returns the app redirect stored in state, or throws if state is forged/expired.
  readState(state: string | undefined): string {
    try {
      const payload = this.jwtService.verify<{ purpose: string; redirect: string }>(state ?? '');
      if (payload.purpose !== STATE_PURPOSE) throw new Error('wrong purpose');
      return this.assertAllowedAppRedirect(payload.redirect);
    } catch {
      throw new BadRequestException('Invalid or expired sign-in attempt');
    }
  }

  // Swap Google's one-time code for tokens, then verify the ID token's
  // signature (Google's public keys), audience (our client ID), issuer and expiry.
  async profileFromCode(code: string): Promise<GoogleProfile> {
    const { tokens } = await this.client.getToken(code);
    if (!tokens.id_token) throw new BadRequestException('Google returned no ID token');

    const ticket = await this.client.verifyIdToken({
      idToken: tokens.id_token,
      audience: this.clientId,
    });
    const payload = ticket.getPayload();
    if (!payload?.sub || !payload.email) {
      throw new BadRequestException('Google account has no email');
    }
    return {
      googleId: payload.sub,
      email: payload.email.toLowerCase(),
      emailVerified: payload.email_verified === true,
      name: payload.name ?? payload.email.split('@')[0],
    };
  }
}
