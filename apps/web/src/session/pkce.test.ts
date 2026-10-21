import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { base64url, challengeFor, createPkcePair } from './pkce';
import { sha256 } from './sha256';

const nodeSha = (s: string) => new Uint8Array(createHash('sha256').update(s).digest());

describe('sha256 fallback (no WebCrypto on http://<LAN IP>)', () => {
  it('matches the standard test vectors', () => {
    const hex = (b: Uint8Array) => Buffer.from(b).toString('hex');
    expect(hex(sha256(new TextEncoder().encode('')))).toBe('e3b0c44298fc1c149afbf4c8996fb92427ae41e4649b934ca495991b7852b855');
    expect(hex(sha256(new TextEncoder().encode('abc')))).toBe('ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  });

  it('agrees with Node for every length around the 64-byte block edges', () => {
    for (let n = 0; n < 200; n++) {
      const s = 'x'.repeat(n);
      expect(sha256(new TextEncoder().encode(s))).toEqual(nodeSha(s));
    }
  });
});

describe('PKCE', () => {
  it('computes the RFC 7636 example challenge', async () => {
    // RFC 7636, appendix B.
    expect(await challengeFor('dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk')).toBe('E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM');
  });

  it('makes a 64-char verifier and a 43-char S256 challenge (what the API accepts)', async () => {
    const { verifier, challenge } = await createPkcePair();
    expect(verifier).toMatch(/^[A-Za-z0-9_-]{64}$/);
    expect(challenge).toMatch(/^[A-Za-z0-9_-]{43}$/);
    expect(challenge).toBe(base64url(nodeSha(verifier)));
  });
});
