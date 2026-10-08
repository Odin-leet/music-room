// The three load profiles (brief V.7), shared by the k6 test (load.js) and
// the runner (run.mjs), so step boundaries are defined in one place.
// Thresholds are fixed BEFORE measuring: a step passes when all three hold.

export const THRESHOLDS = {
  httpP95Ms: 300, // REST: 95% of requests faster than this
  broadcastP95Ms: 500, // a vote reaching the other phones (includes the 100 ms batching)
  errorRate: 0.01, // fewer than 1% failed requests
};

// Share of virtual users per role: party guests voting, playlist editors.
export const MIX = { voters: 0.8, editors: 0.2 };

const RAMP = 15; // seconds to move between two steps
const hold = (users, seconds) => [
  { users, seconds: RAMP, step: null }, // moving to `users` (not measured as a step)
  { users, seconds, step: String(users) }, // holding: measured as step "<users>"
];

export const PROFILES = {
  // 10 users for 20 s: checks the whole pipeline before a real run.
  smoke: [...hold(10, 20), { users: 0, seconds: 5, step: null }],
  // Steady load, for a clean latency number.
  baseline: [...hold(50, 120), { users: 0, seconds: 10, step: null }],
  // Steps up until it breaks: the answer to "how many users at once".
  ramp: [...[50, 100, 200, 400, 800].flatMap((n) => hold(n, 60)), { users: 0, seconds: 15, step: null }],
  // Finer steps between the last passing (200) and first failing (400) ramp step.
  knee: [...[200, 250, 300, 350].flatMap((n) => hold(n, 60)), { users: 0, seconds: 15, step: null }],
  // "Voting just opened": 0 -> 500 in 10 s, then back down, then a quiet
  // phase to see whether latency recovers.
  spike: [
    { users: 500, seconds: 10, step: null },
    { users: 500, seconds: 60, step: 'spike-500' },
    { users: 20, seconds: 10, step: null },
    { users: 20, seconds: 30, step: 'after-20' },
    { users: 0, seconds: 5, step: null },
  ],
};

// Which step a moment of the run (ms since start) belongs to, or 'between'.
export function stepAt(profile, elapsedMs) {
  let t = 0;
  for (const s of PROFILES[profile]) {
    t += s.seconds * 1000;
    if (elapsedMs < t) return s.step ?? 'between';
  }
  return 'between';
}

export const maxUsers = (profile) => Math.max(...PROFILES[profile].map((s) => s.users));
export const measuredSteps = (profile) => PROFILES[profile].map((s) => s.step).filter(Boolean);
export const durationSeconds = (profile) => PROFILES[profile].reduce((sum, s) => sum + s.seconds, 0);
