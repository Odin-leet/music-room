import { Module } from '@nestjs/common';
import { ConfigModule, ConfigService } from '@nestjs/config';
import { JwtModule, JwtSignOptions } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { TypeOrmModule } from '@nestjs/typeorm';
import { MailModule } from '../mail/mail.module';
import { User } from '../users/user.entity';
import { UsersModule } from '../users/users.module';
import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';
import { EmailVerificationCode } from './email-verification-code.entity';
import { EmailVerificationService } from './email-verification.service';
import { FacebookOAuthService } from './facebook-oauth.service';
import { GoogleOAuthService } from './google-oauth.service';
import { JwtStrategy } from './jwt.strategy';
import { OAuthLoginCode } from './oauth-login-code.entity';
import { OAuthLoginService } from './oauth-login.service';
import { OAuthStateService } from './oauth-state.service';
import { PasswordResetCode } from './password-reset-code.entity';
import { PasswordResetService } from './password-reset.service';
import { RefreshToken } from './refresh-token.entity';
import { SocialAuthController } from './social-auth.controller';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([
      RefreshToken,
      EmailVerificationCode,
      PasswordResetCode,
      OAuthLoginCode,
      User,
    ]),
    MailModule,
    UsersModule,
    JwtModule.registerAsync({
      imports: [ConfigModule],
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_ACCESS_SECRET'),
        signOptions: {
          expiresIn: config.getOrThrow<string>(
            'JWT_ACCESS_EXPIRES',
          ) as JwtSignOptions['expiresIn'],
        },
      }),
    }),
  ],
  controllers: [AuthController, SocialAuthController],
  // JwtModule: the realtime gateway verifies access tokens with the same secret.
  exports: [JwtModule],
  providers: [
    AuthService,
    EmailVerificationService,
    PasswordResetService,
    OAuthStateService,
    GoogleOAuthService,
    FacebookOAuthService,
    OAuthLoginService,
    JwtStrategy,
  ],
})
export class AuthModule {}
