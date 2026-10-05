import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
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

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
    private readonly passwordReset: PasswordResetService,
    private readonly oauthLogin: OAuthLoginService,
  ) {}

  @Post('register')
  register(@Body() body: RegisterDto) {
    return this.authService.register(body);
  }

  // Login doesn't create a resource, so 200 rather than POST's default 201.
  @Post('login')
  @HttpCode(HttpStatus.OK)
  login(@Body() body: LoginDto) {
    return this.authService.login(body);
  }

  @Post('refresh')
  @HttpCode(HttpStatus.OK)
  refresh(@Body() body: RefreshDto) {
    return this.authService.refresh(body.refreshToken);
  }

  @Post('logout')
  @HttpCode(HttpStatus.NO_CONTENT)
  async logout(@Body() body: RefreshDto) {
    await this.authService.logout(body.refreshToken);
  }

  // Logged-in only: the code belongs to the account in the access token.
  @Post('verify-email')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async verifyEmail(@CurrentUser() user: AuthUser, @Body() body: VerifyEmailDto) {
    await this.emailVerification.verify(user.userId, body.code);
  }

  @Post('resend-verification')
  @UseGuards(JwtAuthGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  async resendVerification(@CurrentUser() user: AuthUser) {
    await this.emailVerification.resend(user.userId);
  }

  // Always 204, whether or not the email has an account (no account discovery).
  @Post('forgot-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  forgotPassword(@Body() body: ForgotPasswordDto) {
    this.passwordReset.requestReset(body.email);
  }

  // Sets the new password and ends every existing session.
  @Post('reset-password')
  @HttpCode(HttpStatus.NO_CONTENT)
  async resetPassword(@Body() body: ResetPasswordDto) {
    await this.passwordReset.reset(body.email, body.code, body.newPassword);
  }

  // End of a social login: the app trades the single-use code from the
  // return link (+ its PKCE verifier) for our usual token pair.
  @Post('oauth/exchange')
  @HttpCode(HttpStatus.OK)
  async oauthExchange(@Body() body: OAuthExchangeDto) {
    const user = await this.oauthLogin.exchange(body.code, body.codeVerifier);
    return this.authService.issueTokens(user);
  }
}
