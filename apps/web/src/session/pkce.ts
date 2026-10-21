import { sha256 } from './sha256';

// PKCE (RFC 7636): the app keeps a random `verifier` secret and sends only
// its SHA-256 `challenge` when starting a social login. At the end, only the
// app holding the verifier can exchange the login code for tokens.

// 64 URL-safe characters, all allowed in a PKCE verifier.
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export const base64url = (bytes: Uint8Array) =>
  btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');

export async function challengeFor(verifier: string): Promise<string> {
  const data = new TextEncoder().encode(verifier);
  const digest = globalThis.crypto?.subtle
    ? new Uint8Array(await crypto.subtle.digest('SHA-256', data))
    : sha256(data); // http://<LAN IP>: no WebCrypto digest outside secure origins
  return base64url(digest);
}

export async function createPkcePair() {
  // 64 random chars: 256 % 64 === 0, so `byte & 63` is unbiased (384 bits).
  const verifier = Array.from(crypto.getRandomValues(new Uint8Array(64)), (b) => CHARSET[b & 63]).join('');
  return { verifier, challenge: await challengeFor(verifier) };
}
