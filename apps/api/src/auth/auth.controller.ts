import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiCreatedResponse,
  ApiNoContentResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
  ApiTooManyRequestsResponse,
  ApiUnauthorizedResponse,
} from '@nestjs/swagger';
import { TokenPairDto } from './dto/auth-responses.dto';
import { CurrentUserDto } from '../users/dto/user-responses.dto';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { ForgotPasswordDto } from './dto/forgot-password.dto';
import { LoginDto } from './dto/login.dto';
import { OAuthExchangeDto } from './dto/oauth-exchange.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from './jwt.strategy';
import { OAuthLoginService } from './oauth-login.service';
import { PasswordResetService } from './password-reset.service';

@ApiTags('Auth')
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
    private readonly oauthLogin: OAuthLoginService,
  ) {}

  @ApiOperation({ summary: 'Create an email + password account; a 6-digit verification code is emailed' })
  @ApiCreatedResponse({ type: CurrentUserDto })
  @ApiBadRequestResponse({ description: 'Validation failed (one message per field)' })
  @ApiConflictResponse({ description: 'Email is already registered' })
  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  // Login doesn't create a resource, so 200 rather than POST's default 201.
  @ApiOperation({ summary: 'Log in with email + password' })
  @ApiOkResponse({ type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'Invalid email or password (same message and timing for every failure)' })
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @ApiOperation({ summary: 'Swap a refresh token for a new pair (rotation). Reusing an old one revokes every session' })
  @ApiOkResponse({ type: TokenPairDto })
  @ApiUnauthorizedResponse({ description: 'Unknown, expired, revoked or reused refresh token' })
  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @ApiOperation({ summary: 'End this session (always 204)' })
  @ApiNoContentResponse()
  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: RefreshDto) {
    await this.authService.logout(body.refreshToken);
  }

  // Logged-in only: the code belongs to the account in the access token.
  @ApiOperation({ summary: 'Verify your email with the 6-digit code' })
  @ApiBearerAuth()
  @ApiNoContentResponse({ description: 'Verified (also if already verified)' })
  @ApiBadRequestResponse({ description: 'Invalid code, expired code, or too many attempts' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@CurrentUser() user: AuthUser, @Body() body: VerifyEmailDto) {
    await this.emailVerification.verify(user.userId, body.code);
  }

  @ApiOperation({ summary: 'Email a new verification code' })
  @ApiBearerAuth()
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Email is already verified' })
  @ApiTooManyRequestsResponse({ description: 'Wait before requesting another code (60 s)' })
  @ApiUnauthorizedResponse({ description: 'Missing, invalid or expired access token' })
  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendVerification(@CurrentUser() user: AuthUser) {
    await this.emailVerification.resend(user.userId);
  }

  // Always 204, whether or not the email has an account (no account discovery).
  @ApiOperation({ summary: 'Email a password-reset code if the account exists (always 204: never reveals whether it does)' })
  @ApiNoContentResponse()
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  forgotPassword(@Body() body: ForgotPasswordDto) {
    this.passwordReset.requestReset(body.email);
  }

  // Sets the new password and ends every existing session.
  @ApiOperation({ summary: 'Set a new password with the emailed code; ends every session' })
  @ApiNoContentResponse()
  @ApiBadRequestResponse({ description: 'Invalid or expired code (one message for every failure)' })
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.passwordReset.reset(body.email, body.code, body.newPassword);
  }

  // End of a social login: the app trades the single-use code from the
  // return link (+ its PKCE verifier) for our usual token pair.
  @ApiOperation({ summary: 'End of a social login: trade the single-use code from the return link + your PKCE verifier for tokens' })
  @ApiOkResponse({ type: TokenPairDto })
  @ApiBadRequestResponse({ description: 'Invalid, expired or already used code, or wrong verifier' })
  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  async oauthExchange(@Body() body: OAuthExchangeDto) {
    const user = await this.oauthLogin.exchange(body.code, body.codeVerifier);
    return this.authService.issueTokens(user);
  }
}
