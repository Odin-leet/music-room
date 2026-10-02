import { createHash, randomInt, timingSafeEqual } from 'crypto';

// Shared by email verification and password reset: 6-digit codes, emailed,
// stored hashed, short-lived, with a small number of attempts.
export const CODE_TTL_MS = 15 * 60_000;
export const RESEND_COOLDOWN_MS = 60_000;
export const MAX_ATTEMPTS = 5;

export type CodePurpose = 'verify-email' | 'reset-password';

export function generateCode() {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}

// Salted with the purpose and user id, so the same code hashes differently
// per user and a verification code can never pass as a reset code.
// A 6-digit code is weak on its own; what protects it is the 15-minute
// expiry and the attempt limit, not the hash.
export function hashCode(purpose: CodePurpose, userId: string, code: string) {
  return createHash('sha256').update(`${purpose}:${userId}:${code}`).digest('hex');
}

// Constant-time comparison, so response time doesn't reveal how close a guess was.
export function codeMatches(purpose: CodePurpose, userId: string, code: string, storedHash: string) {
  return timingSafeEqual(
    Buffer.from(hashCode(purpose, userId, code), 'hex'),
    Buffer.from(storedHash, 'hex'),
  );
}
