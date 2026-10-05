import * as Crypto from 'expo-crypto';

// PKCE (RFC 7636): the app keeps a random `verifier` secret and sends only
// its SHA-256 `challenge` when starting a social login. At the end, only the
// app holding the verifier can exchange the login code for tokens.

// 64 URL-safe characters, all allowed in a PKCE verifier.
const CHARSET = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789-_';

export async function createPkcePair() {
  // 64 random chars: 256 % 64 === 0, so `byte & 63` is unbiased (384 bits).
  const verifier = Array.from(Crypto.getRandomBytes(64), (b) => CHARSET[b & 63]).join('');
  const base64 = await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256, verifier, {
    encoding: Crypto.CryptoEncoding.BASE64,
  });
  // S256 challenge = base64url(SHA-256(verifier)), without padding.
  const challenge = base64.replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
  return { verifier, challenge };
}
