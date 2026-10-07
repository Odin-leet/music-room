#!/usr/bin/env node
// Friends concurrency test, run against a live API:
//   npm run test:friends-race --workspace=apps/api
// Uses the race-test accounts (race.user1..10@example.com), created if missing.
// Starts by removing every friendship between them, so it can be re-run.
//
// A. 5 pairs: both people send each other a request at the same instant
//    -> each pair ends up friends (one row), never two pending requests
// B. one person sends the same request 10 times at once -> one request
// C. accept and cancel at the same instant -> one consistent outcome
// D. edge cases: to yourself 400, unknown user 404, accept nothing 404,
//    idempotent decline / unfriend, request to a friend = no-op

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
  const me = await call('GET', '/users/me', { token });
  return { token, id: me.data.id };
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
const statuses = (results) => [...new Set(results.map((r) => r.status))].sort((a, b) => a - b);
// What `a` sees of `b`: the friendship field of b's profile.
const stateOf = async (a, b) => (await call('GET', `/users/${b.id}`, { token: a.token })).data.friendship;
const send = (from, to) => call('POST', '/friends/requests', { token: from.token, body: { userId: to.id } });

async function main() {
  console.log(`Friends race test against ${API}`);
  const users = await Promise.all(Array.from({ length: 10 }, (_, i) => user(i + 1)));

  // Clean slate: unfriend / cancel / decline everything between the race users.
  await Promise.all(
    users.flatMap((a) =>
      users
        .filter((b) => b !== a)
        .flatMap((b) => [
          call('DELETE', `/friends/${b.id}`, { token: a.token }),
          call('DELETE', `/friends/requests/${b.id}`, { token: a.token }),
        ]),
    ),
  );

  console.log('\nA. 5 pairs send each other a request at the same instant');
  const pairs = [0, 2, 4, 6, 8].map((i) => [users[i], users[i + 1]]);
  const resultsA = await Promise.all(pairs.flatMap(([a, b]) => [send(a, b), send(b, a)]));
  check('every request answered 200', statuses(resultsA), [200]);
  const statesA = await Promise.all(pairs.flatMap(([a, b]) => [stateOf(a, b), stateOf(b, a)]));
  check('every pair is now friends, from both sides', [...new Set(statesA)], ['friends']);
  const lists = await Promise.all(pairs.map(([a]) => call('GET', '/friends', { token: a.token })));
  check('each first person has exactly 1 friend', lists.map((l) => l.data.length), [1, 1, 1, 1, 1]);
  const reqs = await Promise.all(pairs.map(([, b]) => call('GET', '/friends/requests', { token: b.token })));
  check('no pending request left', reqs.map((r) => r.data.incoming.length + r.data.sent.length), [0, 0, 0, 0, 0]);

  console.log('\nB. the same request sent 10 times at once');
  const [p, q] = [users[0], users[2]];
  const resultsB = await Promise.all(Array.from({ length: 10 }, () => send(p, q)));
  check('all 200', statuses(resultsB), [200]);
  check('all say request_sent', [...new Set(resultsB.map((r) => r.data.friendship))], ['request_sent']);
  const incoming = (await call('GET', '/friends/requests', { token: q.token })).data.incoming;
  check('the other person sees exactly 1 incoming request', incoming.map((r) => r.user.id), [p.id]);
  check('…and p sees it as sent', await stateOf(p, q), 'request_sent');
  check('…and q as received', await stateOf(q, p), 'request_received');

  console.log('\nC. accept and cancel at the same instant');
  const [accept, cancel] = await Promise.all([
    call('POST', `/friends/requests/${p.id}/accept`, { token: q.token }),
    call('DELETE', `/friends/requests/${q.id}`, { token: p.token }),
  ]);
  const final = await stateOf(p, q);
  check('final state is friends or none', ['friends', 'none'].includes(final), true);
  check(
    'the responses agree with it',
    final === 'friends' ? accept.status === 200 : accept.status === 404,
    true,
  );
  check('cancel is always 204', cancel.status, 204);
  console.log(`    (this run: ${final === 'friends' ? 'accept' : 'cancel'} won)`);
  await call('DELETE', `/friends/${q.id}`, { token: p.token });

  console.log('\nD. edge cases');
  const [r, s] = [users[3], users[5]];
  check('request to yourself', (await send(r, r)).status, 400);
  check('request to an unknown user', (await call('POST', '/friends/requests', { token: r.token, body: { userId: '00000000-0000-0000-0000-000000000000' } })).status, 404);
  check('bad userId', (await call('POST', '/friends/requests', { token: r.token, body: { userId: 'nope' } })).status, 400);
  check('accept a request that does not exist', (await call('POST', `/friends/requests/${s.id}/accept`, { token: r.token })).status, 404);
  check('decline nothing (idempotent)', (await call('DELETE', `/friends/requests/${s.id}`, { token: r.token })).status, 204);
  await send(r, s);
  check('the SENDER cannot accept their own request', (await call('POST', `/friends/requests/${s.id}/accept`, { token: r.token })).status, 404);
  check('cancel by the sender', (await call('DELETE', `/friends/requests/${s.id}`, { token: r.token })).status, 204);
  check('…then accepting it is a 404', (await call('POST', `/friends/requests/${r.id}/accept`, { token: s.token })).status, 404);
  await send(r, s);
  check('decline by the receiver', (await call('DELETE', `/friends/requests/${r.id}`, { token: s.token })).status, 204);
  check('…request gone', await stateOf(r, s), 'none');
  const [a, b] = pairs[0];
  check('request to an existing friend is a no-op', (await send(a, b)).data.friendship, 'friends');
  check('accept when already friends is fine', (await call('POST', `/friends/requests/${a.id}/accept`, { token: b.token })).status, 200);
  check('unfriend', (await call('DELETE', `/friends/${b.id}`, { token: a.token })).status, 204);
  check('…both sides see none', [await stateOf(a, b), await stateOf(b, a)], ['none', 'none']);
  check('unfriend again (idempotent)', (await call('DELETE', `/friends/${b.id}`, { token: a.token })).status, 204);
  check('no token', (await call('GET', '/friends')).status, 401);

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
