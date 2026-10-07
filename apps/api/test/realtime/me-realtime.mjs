#!/usr/bin/env node
// /me realtime test (friend notifications), against a live API:
//   npm run test:me-realtime --workspace=apps/api
// Uses race.user7 / user8 / user9, created if missing.
import { io } from 'socket.io-client';

const API = process.env.API_URL ?? 'http://localhost:3000';
const PASSWORD = 'race-test-password-1';

async function call(method, path, { token, body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const init =
    body === undefined
      ? { method, headers }
      : { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
}

async function user(i) {
  const email = `race.user${i}@example.com`;
  await call('POST', '/auth/register', { body: { email, password: PASSWORD, displayName: `Racer ${i}` } });
  const login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (login.status !== 200) throw new Error(`login ${email}: ${login.status}`);
  const token = login.data.accessToken;
  return { token, id: (await call('GET', '/users/me', { token })).data.id };
}

function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`${API}/me`, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.inbox = [];
    socket.onAny((type, payload) => socket.inbox.push({ type, payload }));
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const clear = (...sockets) => sockets.forEach((s) => (s.inbox.length = 0));
const got = (socket) => socket.inbox.map((m) => `${m.type}:${m.payload.userId}`);

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

async function main() {
  console.log(`/me realtime test against ${API}`);
  const [a, b, c] = await Promise.all([7, 8, 9].map(user));
  await call('DELETE', `/friends/${b.id}`, { token: a.token });
  await call('DELETE', `/friends/requests/${b.id}`, { token: a.token });

  console.log('\n1. Connecting');
  check('no token is refused', await connect(undefined).then(() => 'connected', (e) => e.message), 'unauthorized');
  check('invalid token is refused', await connect('not-a-jwt').then(() => 'connected', (e) => e.message), 'unauthorized');
  const sa = await connect(a.token);
  const sa2 = await connect(a.token); // the same user on a second device
  const sb = await connect(b.token);
  const sc = await connect(c.token);
  const AB = `friends:changed:${b.id}`; // what A receives
  const BA = `friends:changed:${a.id}`; // what B receives

  console.log('\n2. Every change reaches both people, and only them');
  const steps = [
    { label: 'A sends a request', action: () => call('POST', '/friends/requests', { token: a.token, body: { userId: b.id } }) },
    { label: 'B accepts', action: () => call('POST', `/friends/requests/${a.id}/accept`, { token: b.token }) },
    { label: 'A unfriends', action: () => call('DELETE', `/friends/${b.id}`, { token: a.token }) },
    { label: 'B sends a request', action: () => call('POST', '/friends/requests', { token: b.token, body: { userId: a.id } }) },
    { label: 'B cancels it', action: () => call('DELETE', `/friends/requests/${a.id}`, { token: b.token }) },
  ];
  for (const { label, action } of steps) {
    clear(sa, sa2, sb, sc);
    await action();
    await sleep(150);
    check(`${label}: A, A's 2nd device, B / C`, [got(sa), got(sa2), got(sb), got(sc)], [[AB], [AB], [BA], []]);
  }

  console.log('\n3. Nothing changed -> nobody is told');
  await call('POST', '/friends/requests', { token: a.token, body: { userId: b.id } });
  await sleep(100);
  clear(sa, sa2, sb, sc);
  await call('POST', '/friends/requests', { token: a.token, body: { userId: b.id } }); // again
  await call('DELETE', `/friends/${b.id}`, { token: a.token }); // not friends: nothing to unfriend
  await sleep(150);
  check('repeat request + unfriend of a non-friend: no message', [got(sa), got(sb)], [[], []]);
  await call('DELETE', `/friends/requests/${b.id}`, { token: a.token });
  await sleep(100);
  clear(sa, sa2, sb, sc);
  await call('DELETE', `/friends/requests/${b.id}`, { token: a.token }); // already gone
  await sleep(150);
  check('cancelling an already-gone request: no message', [got(sa), got(sb)], [[], []]);

  for (const s of [sa, sa2, sb, sc]) s.disconnect();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
