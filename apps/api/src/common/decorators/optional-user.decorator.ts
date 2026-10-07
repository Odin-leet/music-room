import { createParamDecorator, ExecutionContext } from '@nestjs/common';
import type { Request } from 'express';
import type { AuthUser } from '../../auth/jwt.strategy';

// With OptionalJwtAuthGuard: the logged-in user, or null when no token was sent.
export const OptionalUser = createParamDecorator(
  (_data: unknown, ctx: ExecutionContext): AuthUser | null =>
    (ctx.switchToHttp().getRequest<Request>().user as AuthUser | undefined) ?? null,
);
