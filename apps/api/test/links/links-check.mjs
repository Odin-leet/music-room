#!/usr/bin/env node
// Account linking check, against a live API:
//   npm run test:links --workspace=apps/api
//
// A script can't sign in to Google, so it plays the provider callback's
// part: it signs link tickets itself with the API's JWT secret, read from
// the root .env (never printed). Everything else is the real API.
// Uses race.user5 / race.user6, plus a temporary password-less account
// (made with SQL through docker compose, then deleted).
import { execFileSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const require = createRequire(import.meta.url);
const jwt = require('jsonwebtoken');

const API = process.env.API_URL ?? 'http://localhost:3000';
const PASSWORD = 'race-test-password-1';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const SECRET = readFileSync(`${root}.env`, 'utf8').match(/^JWT_ACCESS_SECRET=(.*)$/m)?.[1]?.trim();
if (!SECRET) throw new Error('JWT_ACCESS_SECRET not found in .env');

async function call(method, path, { token, body, redirect } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const init = { method, headers, redirect: redirect ?? 'follow' };
  if (body !== undefined) {
    init.headers = { ...headers, 'Content-Type': 'application/json' };
    init.body = JSON.stringify(body);
  }
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data, location: res.headers.get('location') };
}

async function login(email, password = PASSWORD, displayName = 'Racer') {
  await call('POST', '/auth/register', { body: { email, password, displayName } });
  const r = await call('POST', '/auth/login', { body: { email, password } });
  if (r.status !== 200) throw new Error(`login ${email}: ${r.status}`);
  const me = await call('GET', '/users/me', { token: r.data.accessToken });
  return { token: r.data.accessToken, id: me.data.id };
}

const sql = (query) =>
  execFileSync(
    'docker',
    ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt'],
    { cwd: root, input: query },
  ).toString();

const pkce = () => {
  const verifier = randomBytes(32).toString('base64url');
  return { verifier, challenge: createHash('sha256').update(verifier).digest('base64url') };
};
// What the callback would hand the app in link mode.
const ticket = (userId, provider, providerUserId, challenge, extra = {}) =>
  jwt.sign({ purpose: 'oauth-link-ticket', userId, provider, providerUserId, codeChallenge: challenge, ...extra }, SECRET, {
    expiresIn: '60s',
  });
const confirm = (who, t, verifier) => call('POST', '/auth/link/confirm', { token: who.token, body: { ticket: t, codeVerifier: verifier } });

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
const methods = async (who) => {
  const m = (await call('GET', '/users/me/identities', { token: who.token })).data;
  return { password: m.password, google: m.google, facebook: m.facebook };
};

async function main() {
  console.log(`Account linking check against ${API}`);
  const alice = await login('race.user5@example.com');
  const bob = await login('race.user6@example.com');
  // Clean slate for re-runs.
  sql(`UPDATE users SET "googleId" = NULL, "facebookId" = NULL WHERE id IN ('${alice.id}', '${bob.id}');`);
  const redirect = 'exp://192.168.1.10:8081/--/oauth';
  const sub = `test-google-${randomBytes(4).toString('hex')}`;

  console.log('\n1. Starting a link');
  check('identities before', await methods(alice), { password: true, google: false, facebook: false });
  const { verifier, challenge } = pkce();
  const start = await call('POST', '/auth/google/link', { token: alice.token, body: { redirect, codeChallenge: challenge } });
  check('POST /auth/google/link -> 200', start.status, 200);
  const url = new URL(start.data.url);
  check('…a Google sign-in URL', url.host, 'accounts.google.com');
  const state = jwt.decode(url.searchParams.get('state'));
  check('…whose signed state is in link mode for Alice', [state.purpose, state.linkUserId], ['google-oauth-state', alice.id]);
  check('unknown provider', (await call('POST', '/auth/github/link', { token: alice.token, body: { redirect, codeChallenge: challenge } })).status, 400);
  check('redirect not an app link', (await call('POST', '/auth/google/link', { token: alice.token, body: { redirect: 'https://evil.example', codeChallenge: challenge } })).status, 400);
  check('no token', (await call('POST', '/auth/google/link', { body: { redirect, codeChallenge: challenge } })).status, 401);

  console.log('\n2. The callback refuses a tampered state');
  const [h, , sig] = url.searchParams.get('state').split('.');
  const forged = Buffer.from(JSON.stringify({ ...state, linkUserId: bob.id })).toString('base64url');
  check('state with the user id changed', (await call('GET', `/auth/google/callback?code=x&state=${h}.${forged}.${sig}`, { redirect: 'manual' })).status, 400);
  check('Google state sent to the Facebook callback', (await call('GET', `/auth/facebook/callback?code=x&state=${url.searchParams.get('state')}`, { redirect: 'manual' })).status, 400);

  console.log('\n3. Confirming');
  const t = ticket(alice.id, 'google', sub, challenge);
  check('another user confirms Alice’s ticket', (await confirm(bob, t, verifier)).status, 400);
  check('Alice with the wrong verifier', (await confirm(alice, t, pkce().verifier)).status, 400);
  const expired = jwt.sign({ purpose: 'oauth-link-ticket', userId: alice.id, provider: 'google', providerUserId: sub, codeChallenge: challenge, exp: Math.floor(Date.now() / 1000) - 5 }, SECRET);
  check('expired ticket', (await confirm(alice, expired, verifier)).status, 400);
  check('a sign-in state used as a ticket', (await confirm(alice, url.searchParams.get('state'), verifier)).status, 400);
  const ok = await confirm(alice, t, verifier);
  check('Alice confirms -> 200', ok.status, 200);
  check('…Google is linked', await methods(alice), { password: true, google: true, facebook: false });
  check('confirming again is fine (idempotent)', (await confirm(alice, t, verifier)).status, 200);

  console.log('\n4. One Google account, one Music Room account');
  const pb = pkce();
  const stolen = await confirm(bob, ticket(bob.id, 'google', sub, pb.challenge), pb.verifier);
  check('Bob links the Google account Alice already has -> 409', stolen.status, 409);
  const pa = pkce();
  check('Alice links a SECOND Google account -> 409 (unlink first)', (await confirm(alice, ticket(alice.id, 'google', `${sub}-2`, pa.challenge), pa.verifier)).status, 409);

  console.log('\n5. Unlinking');
  check('Alice unlinks Google (she still has a password)', (await call('DELETE', '/users/me/identities/google', { token: alice.token })).status, 200);
  check('…gone', await methods(alice), { password: true, google: false, facebook: false });
  check('unlinking again is fine', (await call('DELETE', '/users/me/identities/google', { token: alice.token })).status, 200);

  console.log('\n6. Never lock yourself out');
  const email = `links.temp.${randomBytes(3).toString('hex')}@example.com`;
  const temp = await login(email, 'temp-password-123', 'Temp');
  for (const [provider, id] of [['google', `${sub}-t`], ['facebook', `fb-${sub}`]]) {
    const p = pkce();
    await confirm(temp, ticket(temp.id, provider, id, p.challenge), p.verifier);
  }
  sql(`UPDATE users SET "passwordHash" = NULL WHERE id = '${temp.id}';`); // like an account created with Google
  check('temp account: Google + Facebook, no password', await methods(temp), { password: false, google: true, facebook: true });
  const both = await Promise.all([
    call('DELETE', '/users/me/identities/google', { token: temp.token }),
    call('DELETE', '/users/me/identities/facebook', { token: temp.token }),
  ]);
  check('unlink Google AND Facebook at the same instant -> one 200, one 409', both.map((r) => r.status).sort((x, y) => x - y), [200, 409]);
  const left = await methods(temp);
  check('…exactly one way to sign in remains', [left.google, left.facebook].filter(Boolean).length, 1);
  const last = left.google ? 'google' : 'facebook';
  const refused = await call('DELETE', `/users/me/identities/${last}`, { token: temp.token });
  check('removing the last one -> 409', refused.status, 409);
  console.log(`    message: ${refused.data.message}`);
  sql(`DELETE FROM users WHERE id = '${temp.id}';`);

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
