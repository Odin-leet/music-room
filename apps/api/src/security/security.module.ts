import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import { ThrottlerModule } from '@nestjs/throttler';
import { AuthModule } from '../auth/auth.module';
import { rateLimitOptions } from './rate-limit';
import { AppThrottlerGuard } from './throttler.guard';

@Module({
  imports: [
    ThrottlerModule.forRootAsync({
      imports: [AuthModule], // its JwtModule: the general limit counts per verified user
      inject: [JwtService],
      useFactory: (jwt: JwtService) => rateLimitOptions(jwt),
    }),
  ],
  // Global: every route is rate-limited unless it opts out.
  providers: [{ provide: APP_GUARD, useClass: AppThrottlerGuard }],
})
export class SecurityModule {}
