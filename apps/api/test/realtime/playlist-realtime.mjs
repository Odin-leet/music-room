#!/usr/bin/env node
// Playlist Editor realtime test, against a live API:
//   npm run test:playlist-realtime --workspace=apps/api
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
  await call('POST', '/auth/register', { body: { email, password: PASSWORD, displayName: `Racer ${i}` } });
  const login = await call('POST', '/auth/login', { body: { email, password: PASSWORD } });
  if (login.status !== 200) throw new Error(`login ${email}: ${login.status}`);
  return login.data.accessToken;
}

// A connected socket that records every message, and keeps its own copy of
// the playlist built ONLY from the change messages (what the app will do).
function connect(token) {
  return new Promise((resolve, reject) => {
    const socket = io(`${API}/playlists`, { auth: { token }, transports: ['websocket'], reconnection: false });
    socket.inbox = [];
    socket.local = new Map();
    socket.onAny((type, payload) => socket.inbox.push({ type, payload }));
    socket.on('track:added', ({ track }) => socket.local.set(track.id, { ...track }));
    socket.on('track:moved', ({ trackId, position }) => {
      const t = socket.local.get(trackId);
      if (t) t.position = position;
    });
    socket.on('track:removed', ({ trackId }) => socket.local.delete(trackId));
    socket.once('connect', () => resolve(socket));
    socket.once('connect_error', (err) => reject(err));
  });
}
const join = (socket, playlistId) => socket.emitWithAck('playlist:join', { playlistId });
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const received = (socket, type) => socket.inbox.filter((m) => m.type === type);
const clear = (...sockets) => sockets.forEach((s) => (s.inbox.length = 0));
const byPosition = (a, b) => (a.position < b.position ? -1 : a.position > b.position ? 1 : 0);
const localOrder = (socket) => [...socket.local.values()].sort(byPosition).map((t) => t.id);

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  const show = (v) => (JSON.stringify(v).length > 120 ? `${JSON.stringify(v).slice(0, 117)}...` : JSON.stringify(v));
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${show(actual)}, expected ${show(expected)}`);
}

async function songs(token, n) {
  const ids = new Set();
  for (const q of ['daft punk', 'queen', 'beatles', 'abba']) {
    const r = await call('GET', `/music/search?q=${encodeURIComponent(q)}`, { token });
    for (const t of r.data.tracks ?? r.data) ids.add(t.providerTrackId);
    if (ids.size >= n) break;
  }
  return [...ids].slice(0, n);
}

async function main() {
  console.log(`Playlist Editor realtime test against ${API}`);
  const tokens = await Promise.all(Array.from({ length: 10 }, (_, i) => userToken(i + 1)));
  const [owner, editor, watcher, outsider] = tokens;
  const ids = await songs(owner, 20);

  console.log('\n1. Connecting');
  check('no token is refused', await connect(undefined).then(() => 'connected', (e) => e.message), 'unauthorized');
  check('invalid token is refused', await connect('not-a-jwt').then(() => 'connected', (e) => e.message), 'unauthorized');
  const sOwner = await connect(owner);
  const sEditor = await connect(editor);
  const sWatcher = await connect(watcher); // never becomes a member
  const sOutsider = await connect(outsider);

  console.log('\n2. Joining');
  const pub = (await call('POST', '/playlists', { token: owner, body: { name: 'RT public', visibility: 'public' } })).data;
  const priv = (await call('POST', '/playlists', { token: owner, body: { name: 'RT private', visibility: 'private' } })).data;
  check('owner joins', await join(sOwner, pub.id), { ok: true });
  check('editor joins a public playlist', await join(sEditor, pub.id), { ok: true });
  check('watcher joins a public playlist', await join(sWatcher, pub.id), { ok: true });
  check('outsider cannot join a private one', await join(sOutsider, priv.id), { ok: false, error: 'Playlist not found' });
  check('garbage id', await join(sOutsider, 'nope'), { ok: false, error: 'Playlist not found' });

  console.log('\n3. Add / move / remove arrive as small messages');
  const a = await call('POST', `/playlists/${pub.id}/tracks`, { token: owner, body: { providerTrackId: ids[0] } });
  await sleep(150);
  const added = received(sWatcher, 'track:added');
  check('watcher got 1 track:added', added.length, 1);
  check('…carrying the whole track', added[0]?.payload.track, a.data);
  check('outsider (not in the room) got nothing', sOutsider.inbox.length, 0);
  const b = await call('POST', `/playlists/${pub.id}/tracks`, { token: editor, body: { providerTrackId: ids[1] } });
  clear(sOwner, sEditor, sWatcher);
  const m = await call('PATCH', `/playlists/${pub.id}/tracks/${b.data.id}`, { token: owner, body: { afterId: null } });
  await sleep(150);
  check('track:moved = id + new position only', received(sWatcher, 'track:moved').map((x) => x.payload), [
    { playlistId: pub.id, trackId: b.data.id, position: m.data.position },
  ]);
  clear(sOwner, sEditor, sWatcher);
  await Promise.all([
    call('DELETE', `/playlists/${pub.id}/tracks/${a.data.id}`, { token: editor }),
    call('DELETE', `/playlists/${pub.id}/tracks/${a.data.id}`, { token: owner }),
  ]);
  await sleep(150);
  check('2 simultaneous deletes -> 1 track:removed', received(sWatcher, 'track:removed').length, 1);

  console.log('\n4. A burst of concurrent edits: every copy converges');
  // 3 people, 30 operations fired at once: adds (end / top / after), moves, removes.
  const base = (await call('GET', `/playlists/${pub.id}/tracks`, { token: owner })).data.tracks;
  const extra = await Promise.all(
    ids.slice(2, 8).map((id, i) =>
      call('POST', `/playlists/${pub.id}/tracks`, { token: tokens[i % 2], body: { providerTrackId: id } }),
    ),
  );
  const existing = [...base, ...extra.map((r) => r.data)];
  const ops = [];
  for (let i = 8; i < 20; i++) {
    const afterId = i % 3 === 0 ? undefined : i % 3 === 1 ? null : existing[i % existing.length].id;
    ops.push(() => call('POST', `/playlists/${pub.id}/tracks`, { token: tokens[i % 2], body: { providerTrackId: ids[i], afterId } }));
  }
  for (let i = 0; i < 14; i++) {
    const t = existing[i % existing.length];
    const afterId = i % 2 ? null : existing[(i + 3) % existing.length].id;
    ops.push(() => call('PATCH', `/playlists/${pub.id}/tracks/${t.id}`, { token: tokens[i % 2], body: { afterId } }));
  }
  ops.push(() => call('DELETE', `/playlists/${pub.id}/tracks/${existing[1].id}`, { token: owner }));
  ops.push(() => call('DELETE', `/playlists/${pub.id}/tracks/${existing[4].id}`, { token: editor }));
  const results = await Promise.all(ops.map((op) => op()));
  const unexpected = results.filter((r) => ![200, 201, 204, 404, 409].includes(r.status)).map((r) => r.status);
  check('no unexpected status', unexpected, []);
  await sleep(400);
  const truth = (await call('GET', `/playlists/${pub.id}/tracks`, { token: owner })).data.tracks.map((t) => t.id);
  for (const [name, s] of [['owner', sOwner], ['editor', sEditor], ['watcher', sWatcher]]) {
    check(`${name}'s copy from messages == GET /tracks (${truth.length} tracks)`, localOrder(s), truth);
  }

  console.log('\n5. Settings, access, deletion');
  clear(sOwner, sEditor, sWatcher);
  await call('POST', `/playlists/${pub.id}/invites`, { token: owner, body: { email: 'race.user2@example.com' } });
  await sleep(150);
  check('invite -> playlist:updated to the room', received(sEditor, 'playlist:updated').length, 1);
  clear(sOwner, sEditor, sWatcher);
  await call('PATCH', `/playlists/${pub.id}`, { token: owner, body: { visibility: 'private' } });
  await sleep(200);
  check('made private: watcher (not a member) gets access-lost', received(sWatcher, 'playlist:access-lost').length, 1);
  check('…and no playlist:updated', received(sWatcher, 'playlist:updated').length, 0);
  check('invited editor stays and gets playlist:updated', received(sEditor, 'playlist:updated').length, 1);
  clear(sOwner, sEditor, sWatcher);
  await call('POST', `/playlists/${pub.id}/tracks`, { token: owner, body: { providerTrackId: ids[0] } });
  await sleep(150);
  check('watcher is out of the room: no more track messages', sWatcher.inbox.length, 0);
  await call('DELETE', `/playlists/${pub.id}`, { token: owner });
  await sleep(150);
  check('delete -> playlist:deleted', received(sEditor, 'playlist:deleted').map((x) => x.payload), [{ playlistId: pub.id }]);

  await call('DELETE', `/playlists/${priv.id}`, { token: owner });
  for (const s of [sOwner, sEditor, sWatcher, sOutsider]) s.disconnect();
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
