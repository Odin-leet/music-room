import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { OAuth2Client } from 'google-auth-library';

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

  constructor(config: ConfigService) {
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

  // The Google sign-in page URL; `state` comes from OAuthStateService.
  buildAuthUrl(state: string) {
    return this.client.generateAuthUrl({
      scope: ['openid', 'email', 'profile'],
      state,
      // Always show the account picker (handy when testing several accounts).
      prompt: 'select_account',
    });
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
