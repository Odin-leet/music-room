// k6 load test for Music Room (brief V.7). Run through run.mjs, which
// prepares a separate database + API instance and the seed data:
//   node loadtests/run.mjs ramp
//
// Each virtual user is one phone:
//   voters (80%)  a guest at a party: /events socket, reads the queue,
//                 votes / un-votes; measures how long its vote takes to
//                 reach the phones (time until the next queue:updated)
//   editors (20%) co-editing a playlist: /playlists socket, reads the
//                 tracks, moves one (many land in the same gaps)
import exec from 'k6/execution';
import http from 'k6/http';
import { Counter, Trend } from 'k6/metrics';
import { setTimeout } from 'k6/timers';
import { connect } from './lib/socketio.js';
import { measuredSteps, MIX, PROFILES, stepAt, THRESHOLDS } from './lib/profiles.js';

const PROFILE = __ENV.PROFILE ?? 'baseline';
const seed = JSON.parse(open(__ENV.SEED ?? './.data/seed.json'));
const BASE = seed.baseUrl;
// A phone stays connected for a random 45–75 s, then reconnects. Random on
// purpose: a fixed length made every phone that started together reconnect
// together (a storm real users don't produce), which skewed the p95.
const sessionMs = () => 45_000 + Math.random() * 30_000;

const broadcast = new Trend('vote_broadcast_ms', true);
const socketErrors = new Counter('socket_errors');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const between = (a, b) => a + Math.random() * (b - a);
const pick = (list) => list[Math.floor(Math.random() * list.length)];
const step = () => stepAt(PROFILE, exec.instance.currentTestRunDuration);

// ramping-vus stages for one role, scaled by its share of the users.
const stages = (share) =>
  PROFILES[PROFILE].map((s) => ({ target: Math.round(s.users * share), duration: `${s.seconds}s` }));

// The pass / fail rules, per measured step ("did step 400 hold?").
const thresholds = {};
for (const s of measuredSteps(PROFILE)) {
  thresholds[`http_req_duration{step:${s}}`] = [`p(95)<${THRESHOLDS.httpP95Ms}`];
  thresholds[`http_req_failed{step:${s}}`] = [`rate<${THRESHOLDS.errorRate}`];
  thresholds[`vote_broadcast_ms{step:${s}}`] = [`p(95)<${THRESHOLDS.broadcastP95Ms}`];
}

export const options = {
  scenarios: {
    voters: { executor: 'ramping-vus', exec: 'voter', startVUs: 0, stages: stages(MIX.voters), gracefulRampDown: '5s' },
    editors: { executor: 'ramping-vus', exec: 'editor', startVUs: 0, stages: stages(MIX.editors), gracefulRampDown: '5s' },
  },
  thresholds,
  summaryTrendStats: ['avg', 'med', 'p(95)', 'p(99)', 'max'],
};

// Distinct users: VU n uses seed user n (more seed users than VUs).
const user = () => seed.users[(exec.vu.idInTest - 1) % seed.users.length];
const params = (token, name) => ({ headers: { Authorization: `Bearer ${token}` }, tags: { name, step: step() } });

export async function voter() {
  const { token } = user();
  let socket;
  try {
    socket = await connect(BASE, '/events', token);
    const ack = await socket.emitWithAck('event:join', { eventId: seed.eventId });
    if (!ack?.ok) throw new Error('join refused');
  } catch {
    socketErrors.add(1, { step: step() });
    await sleep(1000);
    return;
  }

  // Vote -> the next queue:updated after the API answered = it reached the phones.
  let waitingSince = null;
  socket.on('queue:updated', () => {
    if (waitingSince !== null) {
      broadcast.add(Date.now() - waitingSince, { step: step() });
      waitingSince = null;
    }
  });

  const myVotes = new Set();
  const end = Date.now() + sessionMs();
  await sleep(between(0, 10_000)); // spread the first requests
  while (Date.now() < end) {
    await http.asyncRequest('GET', `${BASE}/events/${seed.eventId}/queue`, null, params(token, 'GET queue'));
    await sleep(between(1000, 3000));

    const trackId = pick(seed.eventTrackIds);
    const voted = myVotes.has(trackId);
    const started = Date.now();
    const res = await http.asyncRequest(
      voted ? 'DELETE' : 'POST',
      `${BASE}/events/${seed.eventId}/tracks/${trackId}/vote`,
      null,
      params(token, voted ? 'DELETE vote' : 'POST vote'),
    );
    if (res.status < 300) {
      if (voted) myVotes.delete(trackId);
      else myVotes.add(trackId);
      waitingSince = started;
    }
    await sleep(between(1000, 3000));
  }
  socket.close();
}

export async function editor() {
  const { token } = user();
  let socket;
  try {
    socket = await connect(BASE, '/playlists', token);
    const ack = await socket.emitWithAck('playlist:join', { playlistId: seed.playlistId });
    if (!ack?.ok) throw new Error('join refused');
  } catch {
    socketErrors.add(1, { step: step() });
    await sleep(1000);
    return;
  }

  const end = Date.now() + sessionMs();
  await sleep(between(0, 10_000));
  while (Date.now() < end) {
    const res = await http.asyncRequest('GET', `${BASE}/playlists/${seed.playlistId}/tracks`, null, params(token, 'GET playlist tracks'));
    const tracks = res.status === 200 ? JSON.parse(res.body).tracks : [];
    if (tracks.length > 1) {
      const moving = pick(tracks);
      // After a random other track, or to the top 1 time in 10.
      const others = tracks.filter((t) => t.id !== moving.id);
      const afterId = Math.random() < 0.1 ? null : pick(others).id;
      await http.asyncRequest(
        'PATCH',
        `${BASE}/playlists/${seed.playlistId}/tracks/${moving.id}`,
        JSON.stringify({ afterId }),
        { ...params(token, 'PATCH move track'), headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' } },
      );
    }
    await sleep(between(4000, 6000));
  }
  socket.close();
}

// A compact per-step table in the terminal + the full data as JSON.
export function handleSummary(data) {
  const v = (name, stat) => data.metrics[name]?.values?.[stat];
  const fmt = (x) => (x === undefined ? '—' : `${Math.round(x)}`);
  const lines = [`\nProfile: ${PROFILE}   (thresholds: HTTP p95 < ${THRESHOLDS.httpP95Ms} ms, vote broadcast p95 < ${THRESHOLDS.broadcastP95Ms} ms, errors < ${THRESHOLDS.errorRate * 100}%)\n`];
  lines.push('step       | requests | HTTP p50 | HTTP p95 | HTTP p99 | errors  | broadcast p50 | broadcast p95 | pass');
  for (const s of measuredSteps(PROFILE)) {
    const d = `http_req_duration{step:${s}}`;
    const f = `http_req_failed{step:${s}}`;
    const b = `vote_broadcast_ms{step:${s}}`;
    const ok = [d, f, b].every((m) => Object.values(data.metrics[m]?.thresholds ?? {}).every((t) => t.ok));
    lines.push(
      `${s.padEnd(10)} | ${fmt(data.metrics[d]?.values?.count ?? v(f, 'passes') + v(f, 'fails')).padStart(8)} | ${fmt(v(d, 'med')).padStart(8)} | ${fmt(v(d, 'p(95)')).padStart(8)} | ${fmt(v(d, 'p(99)')).padStart(8)} | ${((v(f, 'rate') ?? 0) * 100).toFixed(2).padStart(6)}% | ${fmt(v(b, 'med')).padStart(13)} | ${fmt(v(b, 'p(95)')).padStart(13)} | ${ok ? 'PASS' : 'FAIL'}`,
    );
  }
  lines.push(`\nsocket errors: ${v('socket_errors', 'count') ?? 0}   total requests: ${v('http_reqs', 'count')}   max VUs: ${v('vus_max', 'max')}\n`);
  return {
    stdout: lines.join('\n'),
    [`./results/${PROFILE}-k6.json`]: JSON.stringify(data, null, 2),
  };
}
