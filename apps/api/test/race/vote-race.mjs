#!/usr/bin/env node
// Track Vote concurrency test, run against a live API (no test framework,
// on purpose: it exercises the real HTTP + DB path end to end).
//
//   npm run test:race --workspace=apps/api            (API on http://localhost:3000)
//   API_URL=http://host:3000 npm run test:race --workspace=apps/api
//
// It checks the two races the brief calls out:
//   A. 10 different users vote on the same track in the same instant -> score 10
//   B. 1 user fires the same vote 10 times in the same instant        -> score 1
//   C. that user fires 10 un-votes at once                             -> score back to 9
// and that the queue never shows a score different from the vote count.

const API = process.env.API_URL ?? 'http://localhost:3000';
const PASSWORD = 'race-test-password-1';
const USERS = 10;
const TRACK_ID = '3135553'; // Deezer: Daft Punk — One More Time

async function call(method, path, { token, body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const init =
    body === undefined
      ? { method, headers }
      : { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  let data = null;
  try {
    data = text ? JSON.parse(text) : null;
  } catch {
    data = text;
  }
  return { status: res.status, data };
}

// Register once (409 afterwards is fine), then log in.
async function userToken(i) {
  const email = `race.user${i}@example.com`;
  // Log in first; register only if needed (auth routes are rate-limited).
  let login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (login.status !== 200) {
    await call('POST', '/auth/register', { body: { email, password: PASSWORD, displayName: `Racer ${i}` } });
    login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  }
  if (login.status !== 200) throw new Error(`login failed for ${email}: ${login.status} ${JSON.stringify(login.data)}`);
  return login.data.accessToken;
}

let failures = 0;
function check(label, actual, expected) {
  const ok = actual === expected;
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${actual}, expected ${expected}`);
}

const scoreOf = async (token, eventId, trackId) => {
  const q = await call('GET', `/events/${eventId}/queue`, { token });
  if (q.status !== 200) throw new Error(`queue: ${q.status} ${JSON.stringify(q.data)}`);
  return q.data.upcoming.find((t) => t.id === trackId)?.score;
};

async function main() {
  console.log(`Track Vote race test against ${API}`);
  const tokens = await Promise.all(Array.from({ length: USERS }, (_, i) => userToken(i + 1)));
  const owner = tokens[0];

  const event = await call('POST', '/events', {
    token: owner,
    body: { name: `Race test ${new Date().toISOString()}`, visibility: 'public' },
  });
  if (event.status !== 201) throw new Error(`create event: ${event.status} ${JSON.stringify(event.data)}`);
  const eventId = event.data.id;

  const added = await call('POST', `/events/${eventId}/tracks`, { token: owner, body: { providerTrackId: TRACK_ID } });
  if (added.status !== 201) throw new Error(`add track: ${added.status} ${JSON.stringify(added.data)}`);
  const trackId = added.data.id;
  const votePath = `/events/${eventId}/tracks/${trackId}/vote`;

  try {
    console.log(`\nA. ${USERS} users vote at the same instant`);
    const a = await Promise.all(tokens.map((token) => call('POST', votePath, { token, body: {} })));
    check('all requests succeeded', a.filter((r) => r.status === 200).length, USERS);
    check('score', await scoreOf(owner, eventId, trackId), USERS);

    console.log('\nB. one user sends the same vote 10 times at once (already voted in A)');
    const b = await Promise.all(Array.from({ length: 10 }, () => call('POST', votePath, { token: tokens[1], body: {} })));
    check('all requests answered 200 (idempotent)', b.filter((r) => r.status === 200).length, 10);
    check('score unchanged', await scoreOf(owner, eventId, trackId), USERS);

    console.log('\nC. that user removes the vote 10 times at once');
    const c = await Promise.all(Array.from({ length: 10 }, () => call('DELETE', votePath, { token: tokens[1] })));
    check('all requests answered 200 (idempotent)', c.filter((r) => r.status === 200).length, 10);
    check('score went down by exactly 1', await scoreOf(owner, eventId, trackId), USERS - 1);

    console.log('\nD. a brand-new vote race from scratch on a second track');
    const second = await call('POST', `/events/${eventId}/tracks`, { token: owner, body: { providerTrackId: '3157685' } });
    const path2 = `/events/${eventId}/tracks/${second.data.id}/vote`;
    // Every user fires twice, all 20 requests in the same instant.
    await Promise.all(tokens.flatMap((token) => [call('POST', path2, { token, body: {} }), call('POST', path2, { token, body: {} })]));
    check('score = number of distinct voters', await scoreOf(owner, eventId, second.data.id), USERS);
  } finally {
    await call('DELETE', `/events/${eventId}`, { token: owner }); // clean up
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
