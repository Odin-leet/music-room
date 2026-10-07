import { ExecutionContext, Injectable } from '@nestjs/common';
import { ThrottlerGuard, type ThrottlerLimitDetail } from '@nestjs/throttler';
import type { Response } from 'express';

// The library names the header after the limit that was hit
// (Retry-After-account, Retry-After-ip…). Clients and the HTTP standard
// look for plain Retry-After, so send that too.
@Injectable()
export class AppThrottlerGuard extends ThrottlerGuard {
  protected async throwThrottlingException(context: ExecutionContext, detail: ThrottlerLimitDetail): Promise<void> {
    context.switchToHttp().getResponse<Response>().setHeader('Retry-After', Math.max(1, Math.ceil(detail.timeToBlockExpire)));
    return super.throwThrottlingException(context, detail);
  }
}
