import { Controller, Get, Logger, Query, Redirect } from '@nestjs/common';
import { GoogleOAuthService } from './google-oauth.service';

// Browser-facing routes: these answer with redirects, not JSON.
@Controller('auth/google')
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name);

  constructor(private readonly google: GoogleOAuthService) {}

  // Step 1: the app opens this in a browser tab; we send the user to Google.
  @Get('start')
  @Redirect()
  start(@Query('redirect') redirect?: string) {
    const appRedirect = this.google.assertAllowedAppRedirect(redirect);
    return { url: this.google.buildAuthUrl(appRedirect) };
  }

  // Step 2: Google sends the browser back here with ?code&state.
  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const appRedirect = this.google.readState(state);
    const back = (params: Record<string, string>) => ({
      url: `${appRedirect}?${new URLSearchParams(params).toString()}`,
    });

    // User pressed "Cancel" on Google's page, or Google refused.
    if (error || !code) return back({ error: error ?? 'missing_code' });

    try {
      const profile = await this.google.profileFromCode(code);
      // TEMPORARY (SG2 experiment): send the profile back to prove the round
      // trip. SG3 replaces this with a one-time code the app exchanges (PKCE).
      return back({
        email: profile.email,
        name: profile.name,
        verified: String(profile.emailVerified),
      });
    } catch (err) {
      this.logger.error('Google sign-in failed', err);
      return back({ error: 'google_signin_failed' });
    }
  }
}
