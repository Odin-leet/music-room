import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { TypeOrmModule } from '@nestjs/typeorm';
import { User } from './users/user.entity';
import { AuthModule } from './auth/auth.module';
import { EmailVerificationCode } from './auth/email-verification-code.entity';
import { OAuthLoginCode } from './auth/oauth-login-code.entity';
import { EventMember } from './events/event-member.entity';
import { EventTrack } from './events/event-track.entity';
import { Event } from './events/event.entity';
import { Vote } from './events/vote.entity';
import { PasswordResetCode } from './auth/password-reset-code.entity';
import { RefreshToken } from './auth/refresh-token.entity';
import { HealthController } from './health/health.controller';
import { MusicModule } from './music/music.module';
import { UsersModule } from './users/users.module';

@Module({
  imports: [
    ConfigModule.forRoot({
      envFilePath: ['../../.env', '.env'],
    }),
    TypeOrmModule.forRoot({
      type: 'postgres',
      host: process.env.DB_HOST,
      port: parseInt(process.env.DB_PORT ?? '5432', 10),
      username: process.env.DB_USER,
      password: process.env.DB_PASSWORD,
      database: process.env.DB_NAME,
      entities: [
        User,
        RefreshToken,
        EmailVerificationCode,
        PasswordResetCode,
        OAuthLoginCode,
        Event,
        EventMember,
        EventTrack,
        Vote,
      ],
      synchronize: false,
    }),
    UsersModule,
    AuthModule,
    MusicModule,
  ],
  controllers: [HealthController],
})
export class AppModule {}
