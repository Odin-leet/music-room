import { randomInt } from 'crypto';

// Invite codes for events and playlists: 8 characters, no 0/O or 1/I/L
// (people read them aloud and type them on phones). 31^8 ≈ 850 billion.
const CODE_ALPHABET = 'ABCDEFGHJKMNPQRSTUVWXYZ23456789';
export const INVITE_CODE_LENGTH = 8;

export function generateInviteCode() {
  return Array.from({ length: INVITE_CODE_LENGTH }, () => CODE_ALPHABET[randomInt(CODE_ALPHABET.length)]).join(
    '',
  );
}
