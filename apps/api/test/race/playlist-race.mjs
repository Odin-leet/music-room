#!/usr/bin/env node
// Playlist Editor concurrency test ("reordering without locks"), run against
// a live API:  npm run test:playlist-race --workspace=apps/api
// Uses the race-test accounts (race.user1..10@example.com), created if missing.
//
// A. 10 people move 10 different tracks to the top at the same instant
// B. 10 people insert 10 different songs right after the same track at once
// C. 2 people move the same track to two different places at once
// D. edge cases: anchor just removed -> 409, move after itself -> 400

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
  await call('POST', '/auth/register', { body: { email, password: PASSWORD, displayName: `Racer ${i}` } });
  const login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (login.status !== 200) throw new Error(`login ${email}: ${login.status}`);
  return login.data.accessToken;
}

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}
const statuses = (results) => [...new Set(results.map((r) => r.status))].sort((a, b) => a - b);

async function main() {
  console.log(`Playlist Editor race test against ${API}`);
  const tokens = await Promise.all(Array.from({ length: 10 }, (_, i) => userToken(i + 1)));
  const owner = tokens[0];

  // 30 distinct Deezer tracks to work with.
  const songs = [];
  for (const q of ['daft punk', 'queen', 'beatles']) {
    const r = await call('GET', `/music/search?q=${encodeURIComponent(q)}`, { token: owner });
    for (const t of r.data) if (!songs.includes(t.providerTrackId)) songs.push(t.providerTrackId);
  }
  if (songs.length < 26) throw new Error(`only ${songs.length} distinct songs found`);

  const pl = await call('POST', '/playlists', { token: owner, body: { name: `Race ${Date.now()}`, visibility: 'public' } });
  if (pl.status !== 201) throw new Error(`create playlist: ${pl.status} ${JSON.stringify(pl.data)}`);
  const id = pl.data.id;
  const list = async () => (await call('GET', `/playlists/${id}/tracks`, { token: owner })).data.tracks;
  const distinctPositions = (tracks) => new Set(tracks.map((t) => t.position)).size === tracks.length;

  try {
    // 15 tracks, appended one after the other.
    for (const s of songs.slice(0, 15)) {
      const r = await call('POST', `/playlists/${id}/tracks`, { token: owner, body: { providerTrackId: s } });
      if (r.status !== 201) throw new Error(`add: ${r.status} ${JSON.stringify(r.data)}`);
    }
    let tracks = await list();
    check('setup: 15 tracks in insertion order', tracks.map((t) => t.providerTrackId), songs.slice(0, 15));

    console.log('\nA. 10 people move 10 different tracks to the top at the same instant');
    const moved = tracks.slice(5).map((t) => t.id); // the last 10
    const a = await Promise.all(
      moved.map((trackId, i) =>
        call('PATCH', `/playlists/${id}/tracks/${trackId}`, { token: tokens[i], body: { afterId: null } }),
      ),
    );
    check('every move answered 200', statuses(a), [200]);
    tracks = await list();
    check('still 15 tracks', tracks.length, 15);
    check('positions all distinct', distinctPositions(tracks), true);
    check('the 10 moved tracks are now the first 10', new Set(tracks.slice(0, 10).map((t) => t.id)).size === 10 && tracks.slice(0, 10).every((t) => moved.includes(t.id)), true);

    console.log('\nB. 10 people insert 10 different songs right after the same track at once');
    const anchor = tracks[3];
    const fresh = songs.slice(15, 25);
    const b = await Promise.all(
      fresh.map((s, i) =>
        call('POST', `/playlists/${id}/tracks`, { token: tokens[i], body: { providerTrackId: s, afterId: anchor.id } }),
      ),
    );
    check('every insert answered 201', statuses(b), [201]);
    tracks = await list();
    check('25 tracks', tracks.length, 25);
    check('positions all distinct', distinctPositions(tracks), true);
    const at = tracks.findIndex((t) => t.id === anchor.id);
    check('the 10 new songs sit directly after the anchor', tracks.slice(at + 1, at + 11).every((t) => fresh.includes(t.providerTrackId)), true);

    console.log('\nC. 2 people move the same track to two different places at once');
    const target = tracks[12];
    const first = tracks[0];
    const last = tracks.at(-1);
    const c = await Promise.all([
      call('PATCH', `/playlists/${id}/tracks/${target.id}`, { token: tokens[1], body: { afterId: null } }),
      call('PATCH', `/playlists/${id}/tracks/${target.id}`, { token: tokens[2], body: { afterId: last.id } }),
    ]);
    check('both answered 200', statuses(c), [200]);
    tracks = await list();
    check('still 25 tracks, the track appears once', [tracks.length, tracks.filter((t) => t.id === target.id).length], [25, 1]);
    const where = tracks.findIndex((t) => t.id === target.id);
    check('it ended at one of the two places (top or end)', where === 0 || where === 24, true);
    check('positions all distinct', distinctPositions(tracks), true);
    void first;

    console.log('\nD. edge cases');
    const gone = tracks[5];
    await call('DELETE', `/playlists/${id}/tracks/${gone.id}`, { token: owner });
    const afterGone = await call('PATCH', `/playlists/${id}/tracks/${tracks[6].id}`, { token: owner, body: { afterId: gone.id } });
    check('move after a track that was just removed -> 409', afterGone.status, 409);
    const self = await call('PATCH', `/playlists/${id}/tracks/${tracks[6].id}`, { token: owner, body: { afterId: tracks[6].id } });
    check('move after itself -> 400', self.status, 400);
    const dup = await call('POST', `/playlists/${id}/tracks`, { token: owner, body: { providerTrackId: tracks[0].providerTrackId } });
    check('same song twice -> 409', dup.status, 409);
    const del2 = await call('DELETE', `/playlists/${id}/tracks/${gone.id}`, { token: owner });
    check('removing it again is harmless -> 204', del2.status, 204);
  } finally {
    await call('DELETE', `/playlists/${id}`, { token: owner });
  }

  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(`\nERROR: ${err.message}`);
  process.exit(1);
});
