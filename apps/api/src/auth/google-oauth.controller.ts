import { Controller, Get, Logger, Query, Redirect } from '@nestjs/common';
import { GoogleOAuthService } from './google-oauth.service';
import { AccountExistsError, OAuthLoginService } from './oauth-login.service';

// Browser-facing routes: these answer with redirects, not JSON.
@Controller('auth/google')
export class GoogleOAuthController {
  private readonly logger = new Logger(GoogleOAuthController.name);

  constructor(
    private readonly google: GoogleOAuthService,
    private readonly oauthLogin: OAuthLoginService,
  ) {}

  // Step 1: the app opens this in a browser tab; we send the user to Google.
  // `code_challenge` is the app's PKCE challenge; it rides along in `state`.
  @Get('start')
  @Redirect()
  start(@Query('redirect') redirect?: string, @Query('code_challenge') codeChallenge?: string) {
    return {
      url: this.google.buildAuthUrl({
        redirect: this.google.assertAllowedAppRedirect(redirect),
        codeChallenge: this.google.assertValidChallenge(codeChallenge),
      }),
    };
  }

  // Step 2: Google sends the browser back here with ?code&state. We identify
  // the user and send the browser back to the app with a single-use login
  // code — never tokens or profile data in the URL.
  @Get('callback')
  @Redirect()
  async callback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    const { redirect, codeChallenge } = this.google.readState(state);
    const back = (params: Record<string, string>) => ({
      url: `${redirect}?${new URLSearchParams(params).toString()}`,
    });

    // User pressed "Cancel" on Google's page, or Google refused.
    if (error || !code) return back({ error: error ?? 'missing_code' });

    try {
      const profile = await this.google.profileFromCode(code);
      const user = await this.oauthLogin.findOrCreateFromGoogle(profile);
      return back({ code: await this.oauthLogin.createLoginCode(user.id, codeChallenge) });
    } catch (err) {
      if (err instanceof AccountExistsError) return back({ error: 'account_exists' });
      this.logger.error('Google sign-in failed', err);
      return back({ error: 'google_signin_failed' });
    }
  }
}
