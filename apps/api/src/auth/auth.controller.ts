import { Body, Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/current-user.decorator';
import { AuthService } from './auth.service';
import { LoginDto } from './dto/login.dto';
import { RefreshDto } from './dto/refresh.dto';
import { RegisterDto } from './dto/register.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { EmailVerificationService } from './email-verification.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import type { AuthUser } from './jwt.strategy';

@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly emailVerification: EmailVerificationService,
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
}
