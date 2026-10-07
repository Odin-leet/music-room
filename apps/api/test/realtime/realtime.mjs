#!/usr/bin/env node
// Track Vote realtime test, against a live API:
//   npm run test:realtime --workspace=apps/api
// Uses the race-test accounts (race.user1..10@example.com), created if missing.
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

async function userToken(i) {
  const email = `race.user${i}@example.com`;
  // Log in first; register only if needed (auth routes are rate-limited).
  let login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (login.status !== 200) {
    await call('POST', '/auth/register', { body: { email, password: PASSWORD, displayName: `Racer ${i}` } });
    login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  }
  if (login.status !== 200) throw new Error(`login ${email}: ${login.status}`);
  return login.data.accessToken;
}

// A connected socket that records every message it receives.
function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`${API}/events`, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.inbox = [];
    socket.onAny((type, payload) => socket.inbox.push({ type, payload }));
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}
const join = (socket, eventId) => socket.emitWithAck('event:join', { eventId });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const received = (socket, type) => socket.inbox.filter((m) => m.type === type);
const clear = (...sockets) => sockets.forEach((s) => (s.inbox.length = 0));

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

async function main() {
  console.log(`Track Vote realtime test against ${API}`);
  const tokens = await Promise.all(Array.from({ length: 10 }, (_, i) => userToken(i + 1)));
  const [owner, member, outsider] = tokens;

  console.log('\n1. Connecting');
  const noToken = await connect(undefined).then(() => 'connected', (e) => e.message);
  check('no token is refused', noToken, 'unauthorized');
  const badToken = await connect('not-a-jwt').then(() => 'connected', (e) => e.message);
  check('invalid token is refused', badToken, 'unauthorized');

  const ev = await call('POST', '/events', { token: owner, body: { name: `Realtime ${Date.now()}`, visibility: 'public' } });
  const eventId = ev.data.id;
  const t1 = (await call('POST', `/events/${eventId}/tracks`, { token: owner, body: { providerTrackId: '3135553' } })).data.id;
  const t2 = (await call('POST', `/events/${eventId}/tracks`, { token: owner, body: { providerTrackId: '3157685' } })).data.id;

  const [sOwner, sMember, sOutsider] = await Promise.all([connect(owner), connect(member), connect(outsider)]);
  try {
    check('everyone can join a public event room', await Promise.all([sOwner, sMember, sOutsider].map((s) => join(s, eventId))), [{ ok: true }, { ok: true }, { ok: true }]);
    check('joining an unknown event fails', await join(sOwner, '00000000-0000-0000-0000-000000000000'), { ok: false, error: 'Event not found' });

    console.log('\n2. One vote reaches every listener');
    clear(sOwner, sMember, sOutsider);
    await call('POST', `/events/${eventId}/tracks/${t1}/vote`, { token: member, body: {} });
    await sleep(400);
    for (const [name, s] of [['owner', sOwner], ['member', sMember], ['outsider (public)', sOutsider]]) {
      const msgs = received(s, 'queue:updated');
      check(`${name} got the update with score 1`, [msgs.length, msgs.at(-1)?.payload.upcoming.find((t) => t.id === t1)?.score], [1, 1]);
    }
    check('broadcast has no personal votedByMe', 'votedByMe' in received(sOwner, 'queue:updated')[0].payload.upcoming[0], false);

    console.log('\n3. A burst of 10 votes in the same instant is batched');
    clear(sOwner);
    await Promise.all(tokens.map((token) => call('POST', `/events/${eventId}/tracks/${t2}/vote`, { token, body: {} })));
    await sleep(500);
    const burst = received(sOwner, 'queue:updated');
    console.log(`        (${burst.length} queue:updated message(s) for 10 votes)`);
    check('far fewer messages than votes (<= 3)', burst.length <= 3, true);
    check('last message has the final score 10 and the new order', [burst.at(-1)?.payload.upcoming[0].id === t2, burst.at(-1)?.payload.upcoming[0].score], [true, 10]);

    console.log('\n4. Event becomes private: non-members are removed from the room');
    await call('POST', `/events/${eventId}/join`, { token: member }); // member joins (guest) while still public
    clear(sOwner, sMember, sOutsider);
    await call('PATCH', `/events/${eventId}`, { token: owner, body: { visibility: 'private' } });
    await sleep(400);
    check('outsider got event:access-lost', received(sOutsider, 'event:access-lost').length, 1);
    check('owner + member got event:updated', [received(sOwner, 'event:updated').length, received(sMember, 'event:updated').length], [1, 1]);
    clear(sOwner, sMember, sOutsider);
    await call('DELETE', `/events/${eventId}/tracks/${t1}/vote`, { token: member });
    await sleep(400);
    check('member still gets queue updates', received(sMember, 'queue:updated').length, 1);
    check('outsider no longer does', received(sOutsider, 'queue:updated').length, 0);
    check('outsider cannot re-join the private room', await join(sOutsider, eventId), { ok: false, error: 'Event not found' });

    console.log('\n5. Event deleted');
    clear(sOwner, sMember);
    await call('DELETE', `/events/${eventId}`, { token: owner });
    await sleep(400);
    check('owner + member got event:deleted', [received(sOwner, 'event:deleted').length, received(sMember, 'event:deleted').length], [1, 1]);
  } finally {
    [sOwner, sMember, sOutsider].forEach((s) => s.close());
    await call('DELETE', `/events/${eventId}`, { token: owner }); // in case a check threw first
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nERROR: ${err.stack ?? err.message}`);
  process.exit(1);
});
