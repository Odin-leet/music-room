import { createHash } from 'crypto';
import { pkceMatches } from './pkce';

const verifier = 'v'.repeat(43);
const challenge = createHash('sha256').update(verifier).digest('base64url');

describe('PKCE check (sign-in exchange and account linking)', () => {
  it('accepts the verifier the challenge was made from', () => {
    expect(pkceMatches(challenge, verifier)).toBe(true);
  });

  it('refuses any other verifier', () => {
    expect(pkceMatches(challenge, 'w'.repeat(43))).toBe(false);
    expect(pkceMatches(challenge, `${verifier}x`)).toBe(false);
  });

  it('refuses a malformed challenge without throwing', () => {
    expect(pkceMatches('short', verifier)).toBe(false);
    expect(pkceMatches('', verifier)).toBe(false);
  });
});
