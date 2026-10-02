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
import { JwtStrategy } from './jwt.strategy';
import { RefreshToken } from './refresh-token.entity';

@Module({
  imports: [
    ConfigModule,
    PassportModule,
    TypeOrmModule.forFeature([RefreshToken, EmailVerificationCode, User]),
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
  controllers: [AuthController],
  providers: [AuthService, EmailVerificationService, JwtStrategy],
})
export class AuthModule {}
