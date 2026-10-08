#!/usr/bin/env node
// Runs a load test end to end, without touching your data or your dev API:
//   node loadtests/run.mjs baseline|ramp|spike|all [--keep]
//
// 1. builds the API into apps/api/dist-load (not dist: the dev watcher uses it)
// 2. creates a separate database, music_room_load, and migrates it
// 3. starts a second API on port 3100 (production build, rate limits raised:
//    hundreds of virtual users share one IP), logs to results/api-<profile>.log
// 4. seeds: 1000 users (SQL), their access tokens (signed with the API's
//    secret: no bcrypt logins in the measured part), one public "open" event
//    with 30 tracks, one public "open" playlist with 50 tracks
// 5. runs k6 (load.js) while sampling the API's and Postgres's CPU / memory
// 6. stops the API and drops the database (--keep to keep it)
import { execFileSync, execSync, spawn } from 'node:child_process';
import { mkdirSync, openSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';
import { durationSeconds, maxUsers, PROFILES, stepAt } from './lib/profiles.js';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const HERE = fileURLToPath(new URL('.', import.meta.url));
const API_DIR = `${ROOT}apps/api`;
const require = createRequire(`${API_DIR}/package.json`);
const jwt = require('jsonwebtoken');

const PORT = 3100;
const BASE = `http://localhost:${PORT}`;
const DB = 'music_room_load';
const USERS = 1000;
const args = process.argv.slice(2);
const keep = args.includes('--keep');
const which = args.find((a) => !a.startsWith('--')) ?? 'baseline';
const profiles = which === 'all' ? Object.keys(PROFILES) : [which];
if (!profiles.every((p) => PROFILES[p])) throw new Error(`unknown profile ${which} (baseline | ramp | spike | all)`);

const env = Object.fromEntries(
  readFileSync(`${ROOT}.env`, 'utf8')
    .split('\n')
    .filter((l) => /^[A-Z_]+=/.test(l))
    .map((l) => [l.slice(0, l.indexOf('=')), l.slice(l.indexOf('=') + 1).trim()]),
);
const psql = (sql, db = 'postgres') =>
  execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'psql', '-U', env.DB_USER, '-d', db, '-qAt', '-v', 'ON_ERROR_STOP=1'], {
    cwd: ROOT,
    input: `SET client_min_messages = warning;\n${sql}`,
  }).toString();
const log = (...m) => console.log(`[run ${new Date().toLocaleTimeString()}]`, ...m);
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const call = async (method, path, token, body) => {
  const res = await fetch(`${BASE}${path}`, {
    method,
    headers: { Authorization: `Bearer ${token}`, ...(body && { 'Content-Type': 'application/json' }) },
    body: body && JSON.stringify(body),
  });
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null };
};

async function main() {
  // A sleeping Mac freezes k6, the API and Docker together: one spike run
  // "lasted" 19 minutes. caffeinate keeps it awake until this script exits.
  if (process.platform === 'darwin') spawn('caffeinate', ['-dims', '-w', String(process.pid)], { stdio: 'ignore' }).unref();
  mkdirSync(`${HERE}results`, { recursive: true });
  mkdirSync(`${HERE}.data`, { recursive: true });

  log('building the API into apps/api/dist-load');
  execSync('npx tsc -p tsconfig.build.json --outDir dist-load --incremental false', { cwd: API_DIR, stdio: 'inherit' });

  log(`creating database ${DB}`);
  psql(`DROP DATABASE IF EXISTS ${DB};`);
  psql(`CREATE DATABASE ${DB};`);
  execSync('npm run migration:run --silent', { cwd: API_DIR, env: { ...process.env, DB_NAME: DB }, stdio: 'ignore' });

  for (const profile of profiles) await runProfile(profile);

  if (!keep) {
    psql(`DROP DATABASE IF EXISTS ${DB} WITH (FORCE);`);
    log(`dropped ${DB}`);
  }
}

async function runProfile(profile) {
  log(`--- ${profile}: ${durationSeconds(profile)} s, up to ${maxUsers(profile)} users`);
  // Fresh data for each profile, so one run can't slow the next.
  psql('TRUNCATE users CASCADE;', DB);

  const apiLog = openSync(`${HERE}results/api-${profile}.log`, 'w');
  const api = spawn('node', ['dist-load/main.js'], {
    cwd: API_DIR,
    env: {
      ...process.env,
      NODE_ENV: 'production',
      API_PORT: String(PORT),
      DB_NAME: DB,
      // One machine plays every phone: per-IP limits would only measure the limiter.
      RATE_LIMIT_PER_MINUTE: '1000000',
      AUTH_ATTEMPTS_PER_ACCOUNT_PER_MINUTE: '1000000',
      AUTH_ATTEMPTS_PER_IP_PER_MINUTE: '1000000',
    },
    stdio: ['ignore', apiLog, apiLog],
  });
  try {
    for (let i = 0; ; i++) {
      if ((await fetch(`${BASE}/health`).catch(() => null))?.ok) break;
      if (i > 60) throw new Error(`API on ${PORT} did not start: see results/api-${profile}.log`);
      await sleep(500);
    }

    log(`seeding ${USERS} users, an event and a playlist`);
    const rows = psql(
      `INSERT INTO users (email, "displayName", "emailVerifiedAt")
         SELECT 'load.user' || n || '@example.com', 'Load ' || n, now() FROM generate_series(1, ${USERS}) n
       RETURNING id, email;`,
      DB,
    )
      .trim()
      .split('\n')
      .map((l) => l.split('|'));
    const users = rows.map(([id, email]) => ({ id, token: jwt.sign({ sub: id, email }, env.JWT_ACCESS_SECRET, { expiresIn: '2h' }) }));
    const owner = users[0].token;

    // Real tracks from Deezer, once, here — never during the measured part.
    const ids = new Set();
    for (const q of ['daft punk', 'queen', 'beatles', 'abba', 'michael jackson', 'coldplay']) {
      const r = await call('GET', `/music/search?q=${encodeURIComponent(q)}`, owner);
      for (const t of r.data ?? []) ids.add(t.providerTrackId);
      if (ids.size >= 80) break;
    }
    const trackIds = [...ids];
    if (trackIds.length < 80) throw new Error(`only ${trackIds.length} Deezer tracks found`);

    const event = (await call('POST', '/events', owner, { name: 'Load test party', visibility: 'public', license: 'open' })).data;
    const eventTrackIds = [];
    for (const id of trackIds.slice(0, 30)) {
      const r = await call('POST', `/events/${event.id}/tracks`, owner, { providerTrackId: id });
      if (r.status === 201) eventTrackIds.push(r.data.id);
    }
    const playlist = (await call('POST', '/playlists', owner, { name: 'Load test playlist', visibility: 'public', license: 'open' })).data;
    for (const id of trackIds.slice(30, 80)) await call('POST', `/playlists/${playlist.id}/tracks`, owner, { providerTrackId: id });
    writeFileSync(
      `${HERE}.data/seed.json`,
      JSON.stringify({ baseUrl: BASE, eventId: event.id, eventTrackIds, playlistId: playlist.id, users }),
    );
    log(`seeded: ${users.length} users, ${eventTrackIds.length} queued tracks, 50 playlist tracks`);

    // Sample the server side while k6 runs.
    const samples = [];
    const started = Date.now();
    const sampler = setInterval(() => {
      try {
        const [cpu, rss] = execFileSync('ps', ['-o', '%cpu=,rss=', '-p', String(api.pid)]).toString().trim().split(/\s+/);
        const pg = execFileSync('docker', ['stats', '--no-stream', '--format', '{{.CPUPerc}}', 'music-room-postgres']).toString().trim();
        // k6 itself runs on this machine too: how much CPU does it take?
        const k6Cpu = execFileSync('ps', ['-A', '-o', '%cpu=,comm=']).toString().split('\n')
          .filter((l) => /\/k6$|\sk6$/.test(l.trim())).reduce((a, l) => a + Number(l.trim().split(/\s+/)[0]), 0);
        const at = Date.now() - started;
        samples.push({ at, step: stepAt(profile, at), apiCpu: Number(cpu), apiRssMb: Math.round(Number(rss) / 1024), pgCpu: Number(pg.replace('%', '')), k6Cpu });
      } catch {
        // a sample can fail while things stop
      }
    }, 2000);

    log('running k6');
    await new Promise((resolve) => {
      const k6 = spawn('k6', ['run', '-q', `--log-output=file=./results/k6-${profile}.log`, '-e', `PROFILE=${profile}`, '-e', 'SEED=./.data/seed.json', 'load.js'], {
        cwd: HERE,
        stdio: 'inherit',
      });
      k6.on('exit', resolve);
    });
    clearInterval(sampler);

    // Server-side numbers per step: what was the bottleneck?
    const bySteps = {};
    for (const s of samples) (bySteps[s.step] ??= []).push(s);
    const server = Object.fromEntries(
      Object.entries(bySteps)
        .filter(([step]) => step !== 'between')
        .map(([step, list]) => {
          const avg = (k) => Math.round(list.reduce((a, s) => a + s[k], 0) / list.length);
          const max = (k) => Math.round(Math.max(...list.map((s) => s[k])));
          return [step, { apiCpuAvg: avg('apiCpu'), apiCpuMax: max('apiCpu'), apiRssMbMax: max('apiRssMb'), pgCpuAvg: avg('pgCpu'), pgCpuMax: max('pgCpu'), k6CpuAvg: avg('k6Cpu') }];
        }),
    );
    // Correct under load, not only fast: the invariants still hold.
    const [scores, votes] = psql(`SELECT coalesce(sum(score), 0), (SELECT count(*) FROM votes) FROM event_tracks;`, DB).trim().split('|');
    const [tracks, positions] = psql(`SELECT count(*), count(DISTINCT position) FROM playlist_tracks;`, DB).trim().split('|');
    const integrity = {
      votesEqualScores: scores === votes,
      sumOfScores: Number(scores),
      voteRows: Number(votes),
      playlistTracks: Number(tracks),
      distinctPositions: Number(positions),
      positionsUnique: tracks === positions,
    };
    console.log(`integrity: sum of scores ${scores} = vote rows ${votes}: ${integrity.votesEqualScores ? 'OK' : 'MISMATCH'} · playlist ${tracks} tracks, ${positions} distinct positions: ${integrity.positionsUnique ? 'OK' : 'MISMATCH'}`);
    writeFileSync(`${HERE}results/${profile}-server.json`, JSON.stringify({ server, integrity, samples }, null, 2));
    console.log('server side per step (CPU % of one core — the API is one Node process):');
    console.table(server);
  } finally {
    api.kill('SIGTERM');
    // The seed holds tokens signed with the real secret: don't leave it around.
    rmSync(`${HERE}.data/seed.json`, { force: true });
    await sleep(1000);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
