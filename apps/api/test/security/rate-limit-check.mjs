#!/usr/bin/env node
// Rate limiting + login lockout check (brief V.6), against a live API:
//   npm run test:rate-limit --workspace=apps/api
// Uses throwaway accounts (deleted at the end with SQL through docker compose).
// Uses up a bit of this machine's per-IP auth budget: wait a minute before
// running it twice in a row.
import { execFileSync } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { fileURLToPath } from 'node:url';

const API = process.env.API_URL ?? 'http://localhost:3000';
const root = fileURLToPath(new URL('../../../../', import.meta.url));
const PASSWORD = 'right-password-123';

async function call(method, path, { token, body } = {}) {
  const headers = token ? { Authorization: `Bearer ${token}` } : {};
  const init =
    body === undefined
      ? { method, headers }
      : { method, headers: { ...headers, 'Content-Type': 'application/json' }, body: JSON.stringify(body) };
  const res = await fetch(`${API}${path}`, init);
  const text = await res.text();
  return { status: res.status, data: text ? JSON.parse(text) : null, retryAfter: res.headers.get('retry-after') };
}
const sql = (query) =>
  execFileSync('docker', ['compose', 'exec', '-T', 'postgres', 'sh', '-c', 'psql -U "$POSTGRES_USER" -d "$POSTGRES_DB" -qAt'], {
    cwd: root,
    input: query,
  })
    .toString()
    .trim();
const tag = randomBytes(3).toString('hex');
const login = (email, password) => call('POST', '/auth/login', { body: { email, password } });
async function account(name) {
  const email = `ratelimit.${name}.${tag}@example.com`;
  const r = await call('POST', '/auth/register', { body: { email, password: PASSWORD, displayName: `RL ${name}` } });
  if (r.status !== 201) throw new Error(`register ${email}: ${r.status}`);
  return email;
}
const lockState = (email) => sql(`SELECT "failedLoginCount", "lockedUntil" > now() FROM users WHERE email = '${email}';`);

let failures = 0;
function check(label, actual, expected) {
  const ok = JSON.stringify(actual) === JSON.stringify(expected);
  if (!ok) failures++;
  console.log(`  ${ok ? 'PASS' : 'FAIL'}  ${label}: got ${JSON.stringify(actual)}, expected ${JSON.stringify(expected)}`);
}

async function main() {
  console.log(`Rate limit + lockout check against ${API}`);

  console.log('\nA. 5 wrong passwords lock the account for 15 minutes');
  const a = await account('a');
  const first4 = [];
  for (let i = 0; i < 4; i++) first4.push((await login(a, 'wrong-password')).status);
  check('wrong passwords 1-4', first4, [401, 401, 401, 401]);
  check('…counted', lockState(a), '4|');
  const fifth = await login(a, 'wrong-password');
  check('wrong password 5 -> 429 locked', fifth.status, 429);
  console.log(`    message: ${fifth.data.message}`);
  check('…retryAfterSeconds about 15 min', fifth.data.retryAfterSeconds > 890 && fifth.data.retryAfterSeconds <= 900, true);
  check('the RIGHT password is refused while locked', (await login(a, PASSWORD)).status, 429);
  check('…locked in the database, count restarted', lockState(a), '0|t');
  sql(`UPDATE users SET "lockedUntil" = now() - interval '1 second' WHERE email = '${a}';`); // "15 minutes later"
  check('after the lock: right password works', (await login(a, PASSWORD)).status, 200);
  check('…and resets the lock', lockState(a), '0|');
  check('a wrong password after that counts from 1 again', [(await login(a, 'x')).status, lockState(a)], [401, '1|']);

  console.log('\nB. 10 wrong passwords at the same instant');
  const b = await account('b');
  const burst = await Promise.all(Array.from({ length: 10 }, () => login(b, 'wrong-password')));
  const statuses = burst.map((r) => r.status);
  console.log(`    statuses: ${statuses.join(' ')}`);
  check('some were refused as locked', statuses.includes(429), true);
  check('the account is locked afterwards', lockState(b).endsWith('|t'), true);
  check('the right password is refused', (await login(b, PASSWORD)).status, 429);

  console.log('\nC. Per account + IP: 10 login attempts a minute');
  const nobody = `ratelimit.nobody.${tag}@example.com`; // unknown email: no lockout, only the rate limit
  const tries = [];
  for (let i = 0; i < 11; i++) tries.push(await login(nobody, 'whatever'));
  check('attempts 1-10 -> 401', tries.slice(0, 10).map((r) => r.status), Array(10).fill(401));
  check('attempt 11 -> 429', tries[10].status, 429);
  check('…with Retry-After (seconds)', Number(tries[10].retryAfter) > 0, true);
  console.log(`    Retry-After: ${tries[10].retryAfter} s · message: ${tries[10].data.message}`);
  check('another email from the same machine still works', (await login(a, PASSWORD)).status, 200);

  console.log('\nD. General limit: 300 requests a minute per user');
  const d = await account('d');
  const tokenD = (await login(d, PASSWORD)).data.accessToken;
  const tokenA = (await login(a, PASSWORD)).data.accessToken;
  const many = await Promise.all(Array.from({ length: 301 }, () => call('GET', '/users/me', { token: tokenD })));
  const counts = many.reduce((m, r) => ((m[r.status] = (m[r.status] ?? 0) + 1), m), {});
  check('301 calls -> 300 OK and 1 refused', counts, { 200: 300, 429: 1 });
  check('another user is not affected', (await call('GET', '/users/me', { token: tokenA })).status, 200);

  sql(`DELETE FROM users WHERE email LIKE 'ratelimit.%.${tag}@example.com';`);
  console.log(failures ? `\n${failures} check(s) FAILED` : '\nAll checks passed');
  process.exit(failures ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
