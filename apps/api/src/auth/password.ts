import { hash } from 'bcryptjs';

export const BCRYPT_ROUNDS = 12;

export function hashPassword(password: string) {
  return hash(password, BCRYPT_ROUNDS);
}
