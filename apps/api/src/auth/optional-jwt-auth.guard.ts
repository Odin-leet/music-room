import { ExecutionContext, Injectable } from '@nestjs/common';
import type { Request } from 'express';
import { JwtAuthGuard } from './jwt-auth.guard';

// For routes that also answer without logging in (public profiles: the
// brief wants them readable even by API integrators with no account).
// - No Authorization header -> allowed, request.user stays undefined.
// - A token is sent -> it must be valid: an expired one is still a 401, so
//   the app refreshes instead of silently getting the anonymous view.
@Injectable()
export class OptionalJwtAuthGuard extends JwtAuthGuard {
  canActivate(context: ExecutionContext) {
    const req = context.switchToHttp().getRequest<Request>();
    if (!req.headers.authorization) return true;
    return super.canActivate(context);
  }
}
