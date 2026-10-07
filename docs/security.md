# Security (brief V.6)

What Music Room protects against, how, and how each protection is tested. The last section lists **what we decided not to protect**, and why.

The rule everything follows: **the server decides**. The app is a remote control. It shows what the API returns and never checks rights by itself. Every route assumes it will be called directly, by anyone, with someone else's valid token.

---

## 1. Threats → protections → tests

| Threat | Protection | Tested by |
|---|---|---|
| **Guessing a password** (brute force) | Rate limit per **IP + email**: 10 auth attempts a minute ([§3](#3-rate-limiting)). **Lockout**: 5 wrong passwords in a row lock the account for 15 min, even against the right password; a password reset unlocks it | `test:rate-limit` |
| **Trying many accounts** from one machine | Rate limit per **IP** on the auth routes: 100 a minute | `test:rate-limit` (config) |
| **Flooding the API** | General limit: 300 requests a minute **per logged-in user** (per IP without a token). 429 + `Retry-After` | `test:rate-limit` |
| **Stolen access token** | Lives **15 minutes**, kept in memory only (never on disk) in the app | — |
| **Stolen refresh token** | Random (not a JWT), stored **hashed** (SHA-256), in the phone's secure store. **Rotated** on every use; reusing an old one **revokes every session** of that user (theft detection) | (auth tests, earlier logs) |
| **Leaked password database** | bcrypt, cost 12. Login takes the same time for unknown emails (dummy hash), so it doesn't reveal which emails exist | — |
| **Guessing an email code** (verification, reset) | Codes hashed with a purpose + the user id, valid 15 min, **5 attempts** counted atomically, 60 s between resends. A password reset ends every session | (auth tests) |
| **Social login abuse** | Signed 10-min `state` bound to its provider. Return links allowed to the app only. Google **ID token verified**; Facebook calls carry `appsecret_proof`. The app gets a single-use 60 s code protected by **PKCE**, used up atomically. No automatic linking through Facebook (it doesn't say whether the email is verified) | `test:links` (state) |
| **Login CSRF on account linking**: getting a victim to attach their Google to *your* account | The browser only brings back a 60-second ticket; linking needs the **same logged-in user** + the PKCE verifier of the app that started it | `test:links` |
| **Locking yourself out** | You can't unlink your last way to sign in: one atomic `UPDATE … WHERE another method remains` (two simultaneous unlinks can't both pass) | `test:links` |
| **Someone else's ids** (IDOR) | Access rules as pure functions (`canView`, `canParticipate`, `canEdit`, `profileFor`), used by **every** REST route and socket join. Private things answer **404** (existence hidden), owner-only and invited-only answer **403**, and a track id is always looked up **inside** the event or playlist in the URL | **`test:idor`**: 57 attacks with another user's token, then a full snapshot of the victim's data is compared |
| **Mass assignment** (`ownerId`, `email`, `passwordHash`… in a body) | Global validation: `whitelist` + **`forbidNonWhitelisted`**, so any field a route doesn't declare is a 400 | `test:idor` |
| **Double votes / double edits** under concurrency | Database constraints, not app checks: one vote per (user, track), a song queued once, one playing track per event, one position per playlist slot, one friendship row per pair. Counters change with atomic `score ± 1` | `test:race`, `test:playlist-race`, `test:friends-race` |
| **Realtime eavesdropping** | Token checked **before** a socket connects. Event / playlist rooms use the same access rules as REST. On `/me` the room is chosen from the token. When access changes, sockets that lost it are removed | `test:realtime`, `test:playlist-realtime`, `test:me-realtime` |
| **Secrets in the repo** | `.env` is git-ignored; `.env.example` has placeholders only. See [§4](#4-secrets) for what happened in the very first commit | history scan, [§4](#4-secrets) |
| **Local services reachable from the network** | Postgres and Mailpit listen on **127.0.0.1 only** (`docker-compose.yml`) | `docker compose ps` |

## 2. Action log

Every action from the app produces one JSON line in the API's output (the brief asks for platform, device model and app version):

```json
{"level":"log","context":"Action","message":{"action":"PATCH /playlists/:id/tracks/:trackId","status":200,"ms":12,
 "userId":"…","ip":"…","client":{"platform":"android","device":"Google Pixel 8","version":"1.0.0"}}}
```

- **Covered:**
  - **every HTTP request**, logged when its response is finished, so refusals (401, 403, 404, 429) are logged too;
  - socket connections (and refused ones);
  - joins of event and playlist rooms.
- **Where the info comes from:** the app sends `X-Client-Platform`, `X-Client-Device` and `X-Client-Version` on every request (`expo-device`, `expo-constants`), and the same in each socket's handshake. Without them (curl, an integrator), the fields read `unknown`.
- **Never logged:** request bodies, passwords, tokens, query strings. Routes are logged as patterns (`/playlists/:id`), not raw URLs.
- **The client info is untrusted:** used for logging only, never for a decision. It's cut to 80 characters and control characters are removed, so a crafted value can't start a fake log line (tested with a newline inside `device`).

## 3. Rate limiting

| Limit | Counted per | Default (per minute) | Env |
|---|---|---|---|
| general | logged-in user (verified token), otherwise IP | 300 | `RATE_LIMIT_PER_MINUTE` |
| auth attempts | IP + email | 10 | `AUTH_ATTEMPTS_PER_ACCOUNT_PER_MINUTE` |
| auth attempts | IP | 100 | `AUTH_ATTEMPTS_PER_IP_PER_MINUTE` |

- **Auth attempts** = login, register, verify email, resend code, forgot / reset password, social login exchange.
- **The general limit is per user, not per IP:** people sharing a Wi-Fi share an IP, and one busy person shouldn't block everyone else. The user comes from a **verified** token; an unverified one could be forged with a new id each time to get a fresh budget.
- **Over a limit:** 429 with the standard `Retry-After` header. The library only sent `Retry-After-<limit name>`; we add the standard one.
- **Lockout:** 5 wrong passwords in a row → 429 "locked for 15 minutes" (`retryAfterSeconds` in the body).
  - One atomic `UPDATE`, so wrong attempts sent at the same moment all count.
  - The counter restarts when a lock starts.
  - A successful login or a password reset clears it.

## 4. Secrets

- **Today:** `.env` holds every secret and is git-ignored. `JWT_ACCESS_SECRET` is **86 random characters** (64 bytes), set on 7 Oct 2026. The unused `JWT_REFRESH_SECRET` was removed.
- **What the history scan found.** The **first commit** (`9049139e`, 22 Sep 2026) included a `.env`; it was untracked in the next commit (`a7c7cba4`). Both are on GitHub. It contained:
  - **Google, Facebook and mail secrets: empty.** They were set up later, so they **never reached the repo**.
  - **`JWT_ACCESS_SECRET`: the placeholder `change-me`**, which was still in use until 7 Oct 2026. Anyone could have signed tokens. **Replaced.**
  - **The local dev database password**, still in use. Postgres now listens on 127.0.0.1 only, so the password alone doesn't give access from another machine.
- **Why the history wasn't rewritten:** no real third-party secret leaked, and rewriting published history would break every clone and branch. A real deployment must use **its own** database password and secret anyway.
- **What the app contains:** the app's `.env` only holds the API address (`EXPO_PUBLIC_*` values are built into the app, so never secrets).

## 5. Accepted risks (known, not fixed)

| Risk | Why it's accepted |
|---|---|
| **Fake GPS** for "on site" voting | The phone reports its own location, and a rooted phone can lie. Detecting it reliably isn't possible solo; it's decided server-side, logged and rate-limited |
| **Locking someone out on purpose** (5 wrong passwords on their email) | Only 15 minutes, and a password reset unlocks it immediately. It's the usual trade-off of a lockout |
| **The lock message reveals an account exists** | Only after 5 failed attempts on that email, and those are rate-limited. Otherwise login answers the same for unknown emails |
| **Limits and socket rooms live in memory** | Fine for one server. Several servers would need a shared store (Redis for the throttler and the Socket.IO adapter) |
| **No HTTPS in development** | Production must run behind TLS. Over plain HTTP on a shared Wi-Fi, tokens could be read |
| **No CORS for REST** | Browsers on other origins can't call the API; the mobile app doesn't use CORS. Enable it for specific origins if a web client is added |
| **Invite codes can be guessed** | 8 characters from 31 → 8.5 × 10¹¹ codes; at 300 requests/min that's thousands of years |
| **People search is public** | It only returns public info (name, bio), by design of V.1, and is rate-limited |

## 6. Running the checks

```bash
npm run test:idor --workspace=apps/api         # someone else's token, 57 checks
npm run test:rate-limit --workspace=apps/api   # limits + lockout (wait a minute between two runs)
npm run test:links --workspace=apps/api        # linking, PKCE, never locked out
# concurrency + realtime:
npm run test:race / test:playlist-race / test:friends-race --workspace=apps/api
npm run test:realtime / test:playlist-realtime / test:me-realtime --workspace=apps/api
```
