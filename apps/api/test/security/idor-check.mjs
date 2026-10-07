#!/usr/bin/env node
// "Someone else's token" audit (brief V.6: assume every endpoint is hit
// directly with another user's valid token), against a live API:
//   npm run test:idor --workspace=apps/api
//
// Alice (race.user1) owns things; Bob (race.user2) attacks every route that
// changes them with HIS valid token. Three kinds of attack:
//   1. private resource           -> 404 (he can't even learn it exists)
//   2. visible but not his        -> 403 (owner-only / invited-only)
//   3. his own resource in the URL, Alice's track id in it -> no effect
// plus mass assignment (ownerId, email, id in a body). Then Alice's data
// must be exactly what it was before.

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
  let login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (login.status !== 200) {
    await call('POST', '/auth/register', { body: { email, password: PASSWORD, displayName: `Racer ${i}` } });
    login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  }
  if (login.status !== 200) throw new Error(`login ${email}: ${login.status}`);
  const token = login.data.accessToken;
  return { token, id: (await call('GET', '/users/me', { token })).data.id };
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
// Each attack: [label, method, path, body, expected status]
async function attack(by, rows) {
  for (const [label, method, path, body, expected] of rows) {
    const r = await call(method, path, { token: by.token, body });
    check(label, r.status, expected);
  }
}

async function main() {
  console.log(`IDOR audit against ${API}`);
  const [alice, bob, carol] = await Promise.all([1, 2, 3].map(user));
  const songs = await call('GET', '/music/search?q=daft%20punk', { token: alice.token });
  const ids = (songs.data.tracks ?? songs.data).map((t) => t.providerTrackId);
  // Clean slate between Alice / Bob / Carol.
  for (const [x, y] of [[alice, bob], [alice, carol], [bob, carol]]) {
    await call('DELETE', `/friends/${y.id}`, { token: x.token });
    await call('DELETE', `/friends/requests/${y.id}`, { token: x.token });
  }

  // ---------- Alice's things ----------
  const mk = async (path, body) => (await call('POST', path, { token: alice.token, body })).data;
  const ePriv = await mk('/events', { name: 'IDOR private event', visibility: 'private', license: 'open' });
  const ePub = await mk('/events', { name: 'IDOR public event', visibility: 'public', license: 'invited' });
  const tPriv = await mk(`/events/${ePriv.id}/tracks`, { providerTrackId: ids[0] });
  const tPub = await mk(`/events/${ePub.id}/tracks`, { providerTrackId: ids[1] });
  await call('POST', `/events/${ePub.id}/tracks/${tPub.id}/vote`, { token: alice.token });
  const pPriv = await mk('/playlists', { name: 'IDOR private playlist', visibility: 'private' });
  const pPub = await mk('/playlists', { name: 'IDOR public playlist', visibility: 'public', license: 'invited' });
  const ptPriv = await mk(`/playlists/${pPriv.id}/tracks`, { providerTrackId: ids[2] });
  const ptPub = await mk(`/playlists/${pPub.id}/tracks`, { providerTrackId: ids[3] });
  await mk(`/playlists/${pPub.id}/tracks`, { providerTrackId: ids[4] });
  await call('PATCH', '/users/me/profile', { token: alice.token, body: { realName: 'Alice Martin', phone: '+33 6 00 00 00 00' } });
  await call('POST', '/friends/requests', { token: alice.token, body: { userId: carol.id } }); // pending Alice -> Carol

  // Bob's own things, used for the "mixed ids" attacks.
  const eBob = (await call('POST', '/events', { token: bob.token, body: { name: 'Bob event', visibility: 'public' } })).data;
  const pBob = (await call('POST', '/playlists', { token: bob.token, body: { name: 'Bob playlist', visibility: 'public' } })).data;
  const ptBob = (await call('POST', `/playlists/${pBob.id}/tracks`, { token: bob.token, body: { providerTrackId: ids[5] } })).data;

  // Everything Alice can see of her own data, to compare afterwards.
  const snapshot = async () => {
    const g = async (p) => (await call('GET', p, { token: alice.token })).data;
    const strip = (o) => JSON.parse(JSON.stringify(o, (k, v) => (k === 'updatedAt' ? undefined : v)));
    return strip({
      ePriv: await g(`/events/${ePriv.id}`),
      ePub: await g(`/events/${ePub.id}`),
      qPriv: await g(`/events/${ePriv.id}/queue`),
      qPub: await g(`/events/${ePub.id}/queue`),
      pPriv: await g(`/playlists/${pPriv.id}`),
      pPub: await g(`/playlists/${pPub.id}`),
      ptPriv: await g(`/playlists/${pPriv.id}/tracks`),
      ptPub: await g(`/playlists/${pPub.id}/tracks`),
      profile: await g('/users/me/profile'),
      me: await g('/users/me'),
      requests: await g('/friends/requests'),
      friends: await g('/friends'),
      identities: await g('/users/me/identities'),
    });
  };
  const before = await snapshot();

  console.log('\n1. Alice’s PRIVATE event and playlist -> 404 (existence not revealed)');
  await attack(bob, [
    ['read event', 'GET', `/events/${ePriv.id}`, undefined, 404],
    ['read queue', 'GET', `/events/${ePriv.id}/queue`, undefined, 404],
    ['edit event', 'PATCH', `/events/${ePriv.id}`, { name: 'hacked' }, 404],
    ['delete event', 'DELETE', `/events/${ePriv.id}`, undefined, 404],
    ['join without code', 'POST', `/events/${ePriv.id}/join`, undefined, 404],
    ['invite himself', 'POST', `/events/${ePriv.id}/invites`, { email: 'race.user2@example.com' }, 404],
    ['suggest a track', 'POST', `/events/${ePriv.id}/tracks`, { providerTrackId: ids[6] }, 404],
    ['vote', 'POST', `/events/${ePriv.id}/tracks/${tPriv.id}/vote`, undefined, 404],
    ['unvote', 'DELETE', `/events/${ePriv.id}/tracks/${tPriv.id}/vote`, undefined, 404],
    ['next track', 'POST', `/events/${ePriv.id}/next`, {}, 404],
    ['read playlist', 'GET', `/playlists/${pPriv.id}`, undefined, 404],
    ['read playlist tracks', 'GET', `/playlists/${pPriv.id}/tracks`, undefined, 404],
    ['edit playlist', 'PATCH', `/playlists/${pPriv.id}`, { name: 'hacked' }, 404],
    ['delete playlist', 'DELETE', `/playlists/${pPriv.id}`, undefined, 404],
    ['join playlist without code', 'POST', `/playlists/${pPriv.id}/join`, undefined, 404],
    ['invite himself to playlist', 'POST', `/playlists/${pPriv.id}/invites`, { email: 'race.user2@example.com' }, 404],
    ['add a track', 'POST', `/playlists/${pPriv.id}/tracks`, { providerTrackId: ids[6] }, 404],
    ['move a track', 'PATCH', `/playlists/${pPriv.id}/tracks/${ptPriv.id}`, { afterId: null }, 404],
    ['remove a track', 'DELETE', `/playlists/${pPriv.id}/tracks/${ptPriv.id}`, undefined, 404],
  ]);

  console.log('\n2. Alice’s PUBLIC event / playlist, "invited only" -> 403');
  await attack(bob, [
    ['edit event (owner only)', 'PATCH', `/events/${ePub.id}`, { name: 'hacked' }, 403],
    ['delete event (owner only)', 'DELETE', `/events/${ePub.id}`, undefined, 403],
    ['invite himself (owner only)', 'POST', `/events/${ePub.id}/invites`, { email: 'race.user2@example.com' }, 403],
    ['next track (owner only)', 'POST', `/events/${ePub.id}/next`, {}, 403],
    ['suggest (not invited)', 'POST', `/events/${ePub.id}/tracks`, { providerTrackId: ids[6] }, 403],
    ['vote (not invited)', 'POST', `/events/${ePub.id}/tracks/${tPub.id}/vote`, undefined, 403],
    ['unvote Alice’s vote (not invited)', 'DELETE', `/events/${ePub.id}/tracks/${tPub.id}/vote`, undefined, 403],
    ['edit playlist (owner only)', 'PATCH', `/playlists/${pPub.id}`, { name: 'hacked' }, 403],
    ['delete playlist (owner only)', 'DELETE', `/playlists/${pPub.id}`, undefined, 403],
    ['invite himself (owner only)', 'POST', `/playlists/${pPub.id}/invites`, { email: 'race.user2@example.com' }, 403],
    ['add a track (not invited)', 'POST', `/playlists/${pPub.id}/tracks`, { providerTrackId: ids[6] }, 403],
    ['move a track (not invited)', 'PATCH', `/playlists/${pPub.id}/tracks/${ptPub.id}`, { afterId: null }, 403],
    ['remove a track (not invited)', 'DELETE', `/playlists/${pPub.id}/tracks/${ptPub.id}`, undefined, 403],
  ]);
  // Joining a PUBLIC event / playlist as a guest is allowed — but must not
  // let him do what "invited only" forbids.
  check('joining the public event is allowed', (await call('POST', `/events/${ePub.id}/join`, { token: bob.token })).status, 200);
  check('…as guest he still cannot vote', (await call('POST', `/events/${ePub.id}/tracks/${tPub.id}/vote`, { token: bob.token })).status, 403);
  check('joining the public playlist is allowed', (await call('POST', `/playlists/${pPub.id}/join`, { token: bob.token })).status, 200);
  check('…as guest he still cannot remove a track', (await call('DELETE', `/playlists/${pPub.id}/tracks/${ptPub.id}`, { token: bob.token })).status, 403);

  console.log('\n3. Mixed ids: HIS event / playlist in the URL, ALICE’s track id');
  await attack(bob, [
    ['vote for Alice’s track through his event', 'POST', `/events/${eBob.id}/tracks/${tPub.id}/vote`, undefined, 404],
    ['unvote through his event', 'DELETE', `/events/${eBob.id}/tracks/${tPub.id}/vote`, undefined, 404],
    ['move Alice’s track through his playlist', 'PATCH', `/playlists/${pBob.id}/tracks/${ptPub.id}`, { afterId: null }, 404],
    ['place his track after Alice’s', 'PATCH', `/playlists/${pBob.id}/tracks/${ptBob.id}`, { afterId: ptPub.id }, 409],
    ['add after Alice’s track', 'POST', `/playlists/${pBob.id}/tracks`, { providerTrackId: ids[7], afterId: ptPub.id }, 409],
    // Idempotent delete: 204 by design — the snapshot below proves nothing was removed.
    ['remove Alice’s track through his playlist (204, no effect)', 'DELETE', `/playlists/${pBob.id}/tracks/${ptPub.id}`, undefined, 204],
    ['next with Alice’s track as "current"', 'POST', `/events/${eBob.id}/next`, { currentTrackId: tPub.id }, 200],
  ]);

  console.log('\n4. Mass assignment: fields that are not his to set');
  await attack(bob, [
    ['profile: change his email', 'PATCH', '/users/me/profile', { email: 'alice-new@example.com' }, 400],
    ['profile: write to Alice’s id', 'PATCH', '/users/me/profile', { id: alice.id, bio: 'hacked' }, 400],
    ['profile: set a password hash', 'PATCH', '/users/me/profile', { passwordHash: 'x' }, 400],
    ['profile: link a Google id', 'PATCH', '/users/me/profile', { googleId: 'x' }, 400],
    ['event: take ownership', 'PATCH', `/events/${eBob.id}`, { ownerId: alice.id }, 400],
    ['playlist: take ownership', 'PATCH', `/playlists/${pBob.id}`, { ownerId: alice.id }, 400],
    ['create event owned by Alice', 'POST', '/events', { name: 'x', visibility: 'public', ownerId: alice.id }, 400],
  ]);

  console.log('\n5. Friends: only pairs that include yourself');
  await attack(bob, [
    ['accept a request Alice sent to Carol', 'POST', `/friends/requests/${alice.id}/accept`, undefined, 404],
    // Path = the OTHER person; these only ever touch the Bob–X pair (204, no effect).
    ['cancel "Alice’s" request (Bob–Alice pair only)', 'DELETE', `/friends/requests/${alice.id}`, undefined, 204],
    ['cancel "Carol’s" request (Bob–Carol pair only)', 'DELETE', `/friends/requests/${carol.id}`, undefined, 204],
  ]);
  const seen = (await call('GET', `/users/${alice.id}`, { token: bob.token })).data;
  check('Bob sees Alice’s public tier only', [!!seen.public, seen.friendsOnly, seen.private], [true, null, null]);

  console.log('\n6. Alice’s data after all of that');
  // Bob joined her public event / playlist as a guest (allowed): leave him out of the comparison.
  const after = await snapshot();
  // Compare part by part, so the output names what changed (not two huge JSON dumps).
  const changed = Object.keys(before).filter((k) => JSON.stringify(before[k]) !== JSON.stringify(after[k]));
  check(`unchanged: ${Object.keys(before).join(', ')}`, changed, []);
  check('the pending Alice -> Carol request survived', (await call('GET', '/friends/requests', { token: carol.token })).data.incoming.map((r) => r.user.id), [alice.id]);

  // Clean up.
  for (const e of [ePriv, ePub]) await call('DELETE', `/events/${e.id}`, { token: alice.token });
  for (const p of [pPriv, pPub]) await call('DELETE', `/playlists/${p.id}`, { token: alice.token });
  await call('DELETE', `/events/${eBob.id}`, { token: bob.token });
  await call('DELETE', `/playlists/${pBob.id}`, { token: bob.token });
  await call('DELETE', `/friends/requests/${carol.id}`, { token: alice.token });

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
