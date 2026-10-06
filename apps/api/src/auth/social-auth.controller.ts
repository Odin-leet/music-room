import { Controller, Get, Logger, Query, Redirect } from '@nestjs/common';
import type { User } from '../users/user.entity';
import { FacebookOAuthService } from './facebook-oauth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { AccountExistsError, EmailRequiredError, OAuthLoginService } from './oauth-login.service';
import { OAuthStateService, type OAuthProvider } from './oauth-state.service';

// Browser-facing routes for social login: they answer with redirects, not JSON.
//   /auth/<provider>/start    the app opens it in a browser tab -> provider's login page
//   /auth/<provider>/callback the provider sends the browser back here with ?code&state;
//                             we identify the user and send the browser back to the app
//                             with a single-use login code (never tokens or profile data)
@Controller('auth')
export class SocialAuthController {
  private readonly logger = new Logger(SocialAuthController.name);

  constructor(
    private readonly state: OAuthStateService,
    private readonly google: GoogleOAuthService,
    private readonly facebook: FacebookOAuthService,
    private readonly oauthLogin: OAuthLoginService,
  ) {}

  @Get('google/start')
  @Redirect()
  googleStart(@Query('redirect') redirect?: string, @Query('code_challenge') challenge?: string) {
    return { url: this.google.buildAuthUrl(this.state.create('google', redirect, challenge)) };
  }

  @Get('google/callback')
  @Redirect()
  googleCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    return this.finish('google', state, code, error, async (c) =>
      this.oauthLogin.findOrCreateFromGoogle(await this.google.profileFromCode(c)),
    );
  }

  @Get('facebook/start')
  @Redirect()
  facebookStart(@Query('redirect') redirect?: string, @Query('code_challenge') challenge?: string) {
    return { url: this.facebook.buildAuthUrl(this.state.create('facebook', redirect, challenge)) };
  }

  @Get('facebook/callback')
  @Redirect()
  facebookCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    return this.finish('facebook', state, code, error, async (c) =>
      this.oauthLogin.findOrCreateFromFacebook(await this.facebook.profileFromCode(c)),
    );
  }

  // Shared end of every provider's callback.
  private async finish(
    provider: OAuthProvider,
    state: string | undefined,
    code: string | undefined,
    error: string | undefined,
    identify: (code: string) => Promise<User>,
  ) {
    // Throws (400) on a forged/expired state: we don't even know where to redirect.
    const { redirect, codeChallenge } = this.state.read(provider, state);
    const back = (params: Record<string, string>) => ({
      url: `${redirect}?${new URLSearchParams(params).toString()}`,
    });

    // User pressed "Cancel" on the provider's page, or the provider refused.
    if (error || !code) return back({ error: error ?? 'missing_code' });

    try {
      const user = await identify(code);
      return back({ code: await this.oauthLogin.createLoginCode(user.id, codeChallenge) });
    } catch (err) {
      if (err instanceof AccountExistsError) return back({ error: 'account_exists' });
      if (err instanceof EmailRequiredError) return back({ error: 'email_required' });
      this.logger.error(`${provider} sign-in failed`, err);
      return back({ error: `${provider}_signin_failed` });
    }
  }
}
