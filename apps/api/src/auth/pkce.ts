import { createHash, timingSafeEqual } from 'crypto';

// PKCE S256 (RFC 7636): the app keeps a random `verifier` and sends only
// challenge = base64url(SHA-256(verifier)) when it starts a browser flow.
// Proving you hold the verifier later proves you are the app that started.
// Constant-time comparison. No Nest imports, so it unit-tests under Jest.
export function pkceMatches(challenge: string, verifier: string): boolean {
  const expected = Buffer.from(challenge, 'base64url');
  const actual = createHash('sha256').update(verifier).digest();
  return expected.length === actual.length && timingSafeEqual(expected, actual);
}
