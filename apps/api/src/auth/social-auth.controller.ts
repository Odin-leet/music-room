import { Controller, Get, Logger, Query, Redirect } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiFoundResponse,
  ApiOperation,
  ApiQuery,
  ApiTags,
} from '@nestjs/swagger';
import type { User } from '../users/user.entity';
import { AccountLinksService } from './account-links.service';
import { FacebookOAuthService, type FacebookProfile } from './facebook-oauth.service';
import { GoogleOAuthService, type GoogleProfile } from './google-oauth.service';
import { AccountExistsError, EmailRequiredError, OAuthLoginService } from './oauth-login.service';
import { OAuthStateService, type OAuthProvider } from './oauth-state.service';

// Browser-facing routes for social login: they answer with redirects, not JSON.
//   /auth/<provider>/start    the app opens it in a browser tab -> provider's login page
//   /auth/<provider>/callback the provider sends the browser back here with ?code&state;
//                             we identify the user and send the browser back to the app
//                             with a single-use login code (never tokens or profile data).
//                             In link mode (state.linkUserId, started by POST
//                             /auth/<provider>/link) it sends back ?link=<ticket> instead.
@ApiTags('Social login (browser redirects)')
@Controller('auth')
export class SocialAuthController {
  private readonly logger = new Logger(SocialAuthController.name);

  constructor(
    private readonly state: OAuthStateService,
    private readonly google: GoogleOAuthService,
    private readonly facebook: FacebookOAuthService,
    private readonly oauthLogin: OAuthLoginService,
    private readonly links: AccountLinksService,
  ) {}

  @ApiOperation({ summary: 'Open in a browser tab: redirects to Google sign-in (OpenID Connect)' })
  @ApiQuery({ name: 'redirect', description: 'App deep link to return to (exp://… or musicroom://…)' })
  @ApiQuery({ name: 'code_challenge', description: 'PKCE S256 challenge: base64url(SHA-256(verifier)), 43 chars' })
  @ApiFoundResponse({ description: 'Redirect to Google' })
  @ApiBadRequestResponse({ description: 'redirect is not an app deep link, or bad code_challenge' })
  @Get('google/start')
  @Redirect()
  googleStart(@Query('redirect') redirect?: string, @Query('code_challenge') challenge?: string) {
    return { url: this.google.buildAuthUrl(this.state.create('google', redirect, challenge)) };
  }

  @ApiOperation({ summary: 'Google sends the browser here (not for direct calls)' })
  @ApiFoundResponse({ description: 'Redirects the browser back to the app with ?code= (single-use, 60 s), ?link= (link mode: a 60 s ticket for POST /auth/link/confirm) or ?error=account_exists|email_required|access_denied|…' })
  @ApiBadRequestResponse({ description: 'Forged or expired state' })
  @Get('google/callback')
  @Redirect()
  googleCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    return this.finish('google', state, code, error, {
      profile: (c) => this.google.profileFromCode(c),
      providerUserId: (p: GoogleProfile) => p.googleId,
      signIn: (p: GoogleProfile) => this.oauthLogin.findOrCreateFromGoogle(p),
    });
  }

  @ApiOperation({ summary: 'Open in a browser tab: redirects to Facebook login (OAuth 2.0)' })
  @ApiQuery({ name: 'redirect', description: 'App deep link to return to (exp://… or musicroom://…)' })
  @ApiQuery({ name: 'code_challenge', description: 'PKCE S256 challenge: base64url(SHA-256(verifier)), 43 chars' })
  @ApiFoundResponse({ description: 'Redirect to Facebook' })
  @ApiBadRequestResponse({ description: 'redirect is not an app deep link, or bad code_challenge' })
  @Get('facebook/start')
  @Redirect()
  facebookStart(@Query('redirect') redirect?: string, @Query('code_challenge') challenge?: string) {
    return { url: this.facebook.buildAuthUrl(this.state.create('facebook', redirect, challenge)) };
  }

  @ApiOperation({ summary: 'Facebook sends the browser here (not for direct calls)' })
  @ApiFoundResponse({ description: 'Redirects the browser back to the app with ?code= (single-use, 60 s), ?link= (link mode: a 60 s ticket for POST /auth/link/confirm) or ?error=account_exists|email_required|access_denied|…' })
  @ApiBadRequestResponse({ description: 'Forged or expired state' })
  @Get('facebook/callback')
  @Redirect()
  facebookCallback(
    @Query('code') code?: string,
    @Query('state') state?: string,
    @Query('error') error?: string,
  ) {
    return this.finish('facebook', state, code, error, {
      profile: (c) => this.facebook.profileFromCode(c),
      providerUserId: (p: FacebookProfile) => p.facebookId,
      signIn: (p: FacebookProfile) => this.oauthLogin.findOrCreateFromFacebook(p),
    });
  }

  // Shared end of every provider's callback.
  private async finish<P>(
    provider: OAuthProvider,
    state: string | undefined,
    code: string | undefined,
    error: string | undefined,
    flow: {
      profile: (code: string) => Promise<P>;
      providerUserId: (profile: P) => string;
      signIn: (profile: P) => Promise<User>;
    },
  ) {
    // Throws (400) on a forged/expired state: we don't even know where to redirect.
    const { redirect, codeChallenge, linkUserId } = this.state.read(provider, state);
    const back = (params: Record<string, string>) => ({
      url: `${redirect}?${new URLSearchParams(params).toString()}`,
    });

    // User pressed "Cancel" on the provider's page, or the provider refused.
    if (error || !code) return back({ error: error ?? 'missing_code' });

    try {
      const profile = await flow.profile(code);
      // Link mode: nothing is linked here, the app confirms with the ticket.
      if (linkUserId) {
        return back({ link: this.links.createTicket(linkUserId, provider, flow.providerUserId(profile), codeChallenge) });
      }
      const user = await flow.signIn(profile);
      return back({ code: await this.oauthLogin.createLoginCode(user.id, codeChallenge) });
    } catch (err) {
      if (err instanceof AccountExistsError) return back({ error: 'account_exists' });
      if (err instanceof EmailRequiredError) return back({ error: 'email_required' });
      this.logger.error(`${provider} sign-in failed`, err);
      return back({ error: `${provider}_signin_failed` });
    }
  }
}
