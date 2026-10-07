import { SetMetadata, type ExecutionContext } from '@nestjs/common';
import type { JwtService } from '@nestjs/jwt';
import type { ThrottlerModuleOptions } from '@nestjs/throttler';
import type { Request } from 'express';
import type { JwtPayload } from '../auth/jwt.strategy';

// Rate limiting (brief V.6: "rate-limit login per account + IP").
// Three limits, each counted per minute in the API's memory (one server;
// several servers would need a shared store such as Redis — see
// docs/security.md):
//
//   general   every route        per logged-in user (else per IP)
//   account   auth attempts      per IP + email: guessing ONE account's password
//   ip        auth attempts      per IP: spraying MANY accounts from one machine
//
// Per user rather than per IP for the general limit: everyone behind the
// same Wi-Fi shares an IP, and one busy person shouldn't block the others.
// Over a limit: 429 with Retry-After.

const AUTH_ATTEMPT = 'rate-limit:auth-attempt';
// Marks the routes where someone could guess a password or a code.
export const AuthAttempt = () => SetMetadata(AUTH_ATTEMPT, true);
const isAuthAttempt = (ctx: ExecutionContext) =>
  Reflect.getMetadata(AUTH_ATTEMPT, ctx.getHandler()) === true;

const MINUTE = 60_000;
const num = (value: string | undefined, fallback: number) => {
  const n = Number(value);
  return Number.isFinite(n) && n > 0 ? n : fallback;
};

const ipOf = (req: Request) => req.ip ?? 'unknown-ip';
const emailOf = (req: Request) => {
  const email = (req.body as { email?: unknown } | undefined)?.email;
  return typeof email === 'string' ? email.trim().toLowerCase().slice(0, 254) : '';
};

export function rateLimitOptions(jwt: JwtService, env: NodeJS.ProcessEnv = process.env): ThrottlerModuleOptions {
  return {
    // Only HTTP: socket messages have no request to count (and are behind
    // the socket token check anyway).
    skipIf: (ctx) => ctx.getType() !== 'http',
    errorMessage: 'Too many requests. Please wait a moment and try again.',
    throttlers: [
      {
        name: 'general',
        ttl: MINUTE,
        limit: num(env.RATE_LIMIT_PER_MINUTE, 300),
        // A VERIFIED token's user: an unverified one could be forged with a
        // fresh random id each time to get a fresh budget.
        getTracker: (req) => {
          const header = (req as Request).headers.authorization;
          if (header?.startsWith('Bearer ')) {
            try {
              return `user:${jwt.verify<JwtPayload>(header.slice(7)).sub}`;
            } catch {
              // invalid / expired: counted by IP (the route will answer 401)
            }
          }
          return `ip:${ipOf(req as Request)}`;
        },
      },
      {
        name: 'account',
        ttl: MINUTE,
        limit: num(env.AUTH_ATTEMPTS_PER_ACCOUNT_PER_MINUTE, 10),
        skipIf: (ctx) => !isAuthAttempt(ctx),
        getTracker: (req) => `ip:${ipOf(req as Request)}|email:${emailOf(req as Request)}`,
      },
      {
        name: 'ip',
        ttl: MINUTE,
        limit: num(env.AUTH_ATTEMPTS_PER_IP_PER_MINUTE, 100),
        skipIf: (ctx) => !isAuthAttempt(ctx),
        getTracker: (req) => `ip:${ipOf(req as Request)}`,
      },
    ],
  };
}
