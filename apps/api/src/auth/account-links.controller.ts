import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  ParseEnumPipe,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiOkResponse,
  ApiOperation,
  ApiParam,
  ApiTags,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AccountLinksService } from './account-links.service';
import { ConfirmLinkDto, SignInMethodsDto, StartLinkDto, StartLinkResultDto } from './dto/account-links.dto';
import { FacebookOAuthService } from './facebook-oauth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from './jwt.strategy';
import { OAuthStateService, type OAuthProvider } from './oauth-state.service';

const PROVIDERS = { google: 'google', facebook: 'facebook' } as const;
const provider = new ParseEnumPipe(PROVIDERS);

// The ways you can sign in, and linking / unlinking Google and Facebook.
// Flow to link: POST /auth/:provider/link -> open the url in a browser ->
// the provider sends it back to the app with ?link=<ticket> ->
// POST /auth/link/confirm { ticket, codeVerifier }.
@ApiTags('Sign-in methods (linking)')
@ApiBearerAuth()
@ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
@Controller()
@UseGuards(JwtAuthGuard)
export class AccountLinksController {
  constructor(
    private readonly links: AccountLinksService,
    private readonly state: OAuthStateService,
    private readonly google: GoogleOAuthService,
    private readonly facebook: FacebookOAuthService,
  ) {}

  @ApiOperation({ summary: 'Your sign-in methods: password, Google, Facebook' })
  @ApiOkResponse({ type: SignInMethodsDto })
  @Get('users/me/identities')
  methods(@CurrentUser() me: AuthUser) {
    return this.links.methods(me.userId);
  }

  @ApiOperation({ summary: 'Start linking Google or Facebook to your account: returns the URL to open in a browser' })
  @ApiParam({ name: 'provider', enum: ['google', 'facebook'] })
  @ApiOkResponse({ type: StartLinkResultDto })
  @ApiBadRequestResponse({ description: 'Unknown provider, redirect not an app deep link, or bad codeChallenge' })
  @Post('auth/:provider/link')
  @HttpCode(HttpStatus.OK)
  start(
    @CurrentUser() me: AuthUser,
    @Param('provider', provider) p: OAuthProvider,
    @Body() body: StartLinkDto,
  ): StartLinkResultDto {
    const state = this.state.create(p, body.redirect, body.codeChallenge, me.userId);
    return { url: p === 'google' ? this.google.buildAuthUrl(state) : this.facebook.buildAuthUrl(state) };
  }

  @ApiOperation({ summary: 'Finish linking with the ticket the browser brought back (and your PKCE verifier)' })
  @ApiOkResponse({ type: SignInMethodsDto })
  @ApiBadRequestResponse({ description: 'Invalid / expired ticket, or not started by you (other user or wrong verifier)' })
  @ApiConflictResponse({ description: 'That provider account belongs to another user, or you already linked a different one' })
  @Post('auth/link/confirm')
  @HttpCode(HttpStatus.OK)
  confirm(@CurrentUser() me: AuthUser, @Body() body: ConfirmLinkDto) {
    return this.links.confirm(me.userId, body.ticket, body.codeVerifier);
  }

  @ApiOperation({ summary: 'Unlink Google or Facebook (refused if it is your last way to sign in)' })
  @ApiParam({ name: 'provider', enum: ['google', 'facebook'] })
  @ApiOkResponse({ type: SignInMethodsDto })
  @ApiConflictResponse({ description: 'It is your only sign-in method' })
  @Delete('users/me/identities/:provider')
  unlink(@CurrentUser() me: AuthUser, @Param('provider', provider) p: OAuthProvider) {
    return this.links.unlink(me.userId, p);
  }
}
