# Music Room

Mobile, collaborative, real-time music app:
- **Track Vote:** people gather around an event's live queue, suggest tracks and vote on what plays next.
- **Playlist Editor:** people build a playlist together, adding, removing and reordering tracks at the same time.

Every phone sees every change instantly. Profiles, friends and Google / Facebook sign-in come with it.

## Status against the brief

| Part | State |
|---|---|
| **V.1 User**: email/password with verification + reset, Google and Facebook sign-in, **linking** them to an existing account, **four profile visibility tiers** (public / friends / private / music preferences), friends | ✅ Done |
| **V.2.1 Music Track Vote**: events, visibility, three voting licenses, ranked queue, live updates, playback | ✅ Done |
| V.2.2 Music Control Delegation | ✂️ Not built (scope decision: two services out of three) |
| **V.2.3 Music Playlist Editor**: shared playlists, visibility + edit license, add / remove / **reorder without locks**, live updates, playback | ✅ Done |
| **V.4 API docs**: Swagger UI with full schemas, [`docs/openapi.json`](docs/openapi.json), [`docs/realtime.md`](docs/realtime.md) | ✅ Done |
| **V.5 Mobile**: React Native (Expo); the **server address is a setting in the app** | ✅ Done |
| **V.6 Security**: action log (platform / device / app version), rate limits + lockout, ownership audit, see [`docs/security.md`](docs/security.md) | ✅ Done |
| V.7 Ramp-up (load testing) | ⏳ To do |
| V.8 CI (lint + tests on every push) | ⏳ To do |

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native + **Expo SDK 57** (expo-router) | One codebase, demoable on Android and iOS; runs in Expo Go during development |
| Backend | **NestJS 12** (Node ≥ 22.18) | A module per area; dependency injection keeps services testable; guards enforce access per request; Socket.IO for real-time |
| Database | **PostgreSQL 16 + TypeORM** | Real transactions and constraints for what must be right under concurrency (votes, playback, playlist order, friendships). The schema only changes through migrations |
| Music | **Deezer public API** | Search + 30-second previews without an API key or OAuth. Always called through our API |

**Why not a backend-as-a-service (Firebase / Supabase)?** The brief says *"the SDK you choose must not do your work."* A managed backend would hide exactly what is graded: auth, access rules, real-time sync, concurrency. With NestJS + Postgres every line of that logic is ours to explain.

**The app is a remote control.** The server re-checks every rule (who can see, vote, edit, play, what of a profile is visible); the app only shows the result.

```
music-room/
├── Makefile                  # every day-to-day command (make help)
├── docker-compose.yml        # Postgres + Mailpit (dev email), on 127.0.0.1 — API and Expo run natively
├── .env.example              # API / database / mail / OAuth settings
├── .nvmrc                    # Node 22
├── docs/
│   ├── openapi.json          # the REST API, generated (Swagger)
│   ├── realtime.md           # Socket.IO reference: /events, /playlists, /me
│   └── security.md           # threats -> protections -> tests, accepted risks
├── apps/
│   ├── api/                  # NestJS API
│   └── mobile/               # Expo app (.env.example for the default API address)
└── packages/
    └── shared/               # types (and a few constants) shared by api and mobile
```

Only Postgres and Mailpit run in Docker. The API and Expo run on the host on purpose: Docker Desktop's file watching is unreliable for `nest start --watch`, and Expo's LAN discovery doesn't work well from inside a container.

---

## Getting started

Requirements:
- **Node ≥ 22.18** (`.nvmrc`). The shared package is loaded through Node's built-in TypeScript type stripping; on Node ≤ 20.18 the TypeORM CLI also crashes with `ERR_REQUIRE_ESM`.
- **Docker Desktop**.
- For the app: **Android Studio** (emulator) or a phone with **Expo Go**.

```bash
git clone <your-repo-url> music-room && cd music-room
nvm use                       # Node 22 from .nvmrc

make env                      # creates .env from .env.example — fill it in (see Configuration)
cp apps/mobile/.env.example apps/mobile/.env
make install                  # installs every workspace
make db-up                    # Postgres (127.0.0.1:5433) + Mailpit (http://localhost:8025)
make migrate                  # creates the schema

make dev-api                  # API on http://localhost:3000 (watch mode)
```

Then the app, on the Android emulator:

```bash
emulator -avd Pixel_8         # or start it from Android Studio → Virtual Device Manager
adb reverse tcp:3000 tcp:3000 # after every emulator start (needed for Google/Facebook sign-in)
make dev-mobile               # Expo — press a to open on Android, r to reload
```

Run every command **from the repo root**. Starting Expo from the root with `npx expo start` gives "Unable to resolve ../../App"; use `make dev-mobile`, or `npm run start --workspace=apps/mobile -- -c` to also clear its cache.

- **API docs:** Swagger UI at <http://localhost:3000/api-docs> (click **Authorize** and paste an `accessToken` to call protected routes). The same spec is in [`docs/openapi.json`](docs/openapi.json), and the real-time events in [`docs/realtime.md`](docs/realtime.md).
- **Emails** (verification and reset codes) arrive in Mailpit: <http://localhost:8025>.
- `make help` lists every target.

### Configuration (`.env` at the repo root)

| Variable | What |
|---|---|
| `DB_HOST`, `DB_PORT` (5433), `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Postgres. `DB_PORT` is also the port Compose publishes (5433 avoids a native Postgres on 5432) |
| `API_PORT` (`3000`) | The API's port. A value set on the command line wins over `.env` (e.g. a second instance for load tests) |
| `JWT_ACCESS_SECRET` | Signs access tokens. **Use a long random value**: `openssl rand -base64 64`. Changing it signs everyone out |
| `JWT_ACCESS_EXPIRES` (`15m`), `JWT_REFRESH_EXPIRES` (`7d`) | Token lifetimes |
| `MAIL_HOST` (`localhost`), `MAIL_PORT` (`1025`), `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | SMTP. Defaults point at Mailpit; use a real provider in production |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in (see below) |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Facebook login (see below) |
| `RATE_LIMIT_PER_MINUTE` (300), `AUTH_ATTEMPTS_PER_ACCOUNT_PER_MINUTE` (10), `AUTH_ATTEMPTS_PER_IP_PER_MINUTE` (100) | Optional: rate limits (see [docs/security.md](docs/security.md)) |

**The app's server address.** In the app: **Server settings**, from the login screen ("Server: … · change") or from Home. It's saved on the phone, so an evaluator can point the app at their own server without rebuilding it. Its **default** comes from `apps/mobile/.env` (Expo doesn't read the root `.env`):
- `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` for the Android emulator;
- `http://localhost:3000` for the iOS simulator;
- `http://<your Mac's LAN IP>:3000` for a phone on the same Wi-Fi.

`EXPO_PUBLIC_*` values are built into the app, so never put secrets there.

### Google and Facebook setup (one time)

- **Google Cloud Console** → APIs & Services:
  1. OAuth consent screen: External, testing mode, add your accounts as test users;
  2. Credentials → **OAuth client ID, Web application**, Authorized redirect URI **`http://localhost:3000/auth/google/callback`**;
  3. put the ID and secret in `.env`.
- **developers.facebook.com** → Create App with the Facebook Login use case, add the **`email`** permission, and keep it in **Development mode** (localhost redirects are allowed automatically; only people with a role on the app can log in) → App ID and App Secret in `.env`.
- Both redirect to `http://localhost:3000`, which reaches the API from the emulator thanks to `adb reverse`. No tunnel needed.

---

## Features

### Accounts and profile (V.1)

- **Email + password:** register → a **6-digit code** is emailed → enter it in the app ("Check your email"). Unverified accounts can only reach that screen.
- **Forgot password:** code by email → new password → every session is ended (it also lifts a login lockout).
- **Continue with Google / Facebook** on Log in and Register (browser route, see Security).
- **Linking:** in My profile → *Ways to sign in*, **Link / Unlink** Google and Facebook on an existing account. Afterwards each way opens the same account. You can't unlink your last way to sign in.
- **Profile in four tiers**, each labelled with who sees it:

  | Tier | Fields | Who sees it |
  |---|---|---|
  | Public | name, bio | everyone, **even without an account** (`GET /users/:id` works without a token) |
  | Friends only | real name, city | your friends |
  | Private | phone, birth date | only you |
  | Music preferences | genres (21 fixed tags), up to 10 artists | **you choose**: everyone / friends / only you |

- **Friends:** search people by name → their profile shows only what you may see → **Add friend**. Requests are accepted or declined; when two people ask each other, they become friends. **Live**: a request appears on the other phone at once ("People & friends · 1 new request").
- **Sessions:** 15-minute access token + 7-day refresh token. The app refreshes silently and stays logged in; logout ends that device's session.

### Track Vote (V.2.1)

An **event** is a party with one live queue.

| Setting | Options |
|---|---|
| **Visibility** | **Public** (listed for everyone) or **Private** (hidden; join with the 8-character invite code) |
| **Who can vote and suggest** | **Everyone** who can see it · **Invited only** (accounts the owner invites by email; the invite code only lets people watch) · **On site, on time** (within a radius of the owner's position, during a time window) |

- **Ranking:** most votes first; at equal votes, the earliest suggestion plays first.
- **Voting:** one vote per person per track; tap again to remove it.
- **Suggesting:** search Deezer in the app; the server looks the track up itself.
- **Live:** every phone in the event sees new tracks, votes and reordering instantly.
- **Playback:** the owner's phone is the speaker ("Start the music", Pause, Next). It plays the top track's 30-second preview and moves on by itself; everyone else sees "Now playing".

### Playlist Editor (V.2.3)

A **playlist** is built together, by several people at once.

| Setting | Options |
|---|---|
| **Visibility** | **Public** or **Private** (join with the invite code) |
| **Who can edit** | **Anyone** who can see it · **Invited only** (everyone else can listen) |

- **Add** from a Deezer search (a song only once per playlist), **remove**, and **reorder** by dragging a row's **≡** handle or with ▲ / ▼.
- **Reordering without locks:** each track has a string position, and a move gives it a key *between* its new neighbours (`a0` < `a0V` < `a1`). Only that one row changes, so simultaneous moves never fight over the same rows. Two people creating the same key at the same instant: the database's unique index refuses one, which retries at a random spot in the gap.
- **Live:** small change messages (`track:added` / `moved` / `removed`); every phone's list matches the server's.
- **Listen:** previews play on *your* phone, in the live order, and move on by themselves.

---

## API overview

All routes need `Authorization: Bearer <accessToken>` unless marked public or optional. Every route, body, response and error code is in Swagger UI and [`docs/openapi.json`](docs/openapi.json).

**How the docs are generated:**
- routes come from the controllers' decorators;
- request schemas from the DTO classes, through the Nest Swagger compiler plugin (`apps/api/nest-cli.json`, which also turns `class-validator` rules into limits like `maxLength`);
- response schemas from classes in `*/dto/*-responses.dto.ts` that `implements` the shared types in `packages/shared`, so they can't drift.

After changing routes or DTOs, restart the API and run `npm run docs:openapi --workspace=apps/api`. It refuses to export if a schema came out empty, which happens when the plugin didn't run.

| Area | Routes |
|---|---|
| Health | `GET /health` (public) |
| Auth (public) | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `/auth/forgot-password` · `/auth/reset-password` · `/auth/oauth/exchange` |
| Auth (logged in) | `POST /auth/verify-email` · `/auth/resend-verification` |
| Social login (browser redirects) | `GET /auth/{google,facebook}/start?redirect=&code_challenge=` · `GET /auth/{google,facebook}/callback` |
| Sign-in methods | `GET /users/me/identities` · `POST /auth/{google,facebook}/link` · `POST /auth/link/confirm` · `DELETE /users/me/identities/{provider}` |
| Users | `GET /users/me` · `GET` / `PATCH /users/me/profile` · `GET /users/:id` (token optional) · `GET /users?q=` (token optional) |
| Friends | `GET /friends` · `GET /friends/requests` · `POST /friends/requests` `{userId}` · `POST /friends/requests/:userId/accept` · `DELETE /friends/requests/:userId` · `DELETE /friends/:userId` |
| Music | `GET /music/search?q=` · `GET /music/tracks/:providerTrackId/preview` |
| Events | `POST /events` · `GET /events` · `GET /events/:id[?lat&lng]` · `PATCH` / `DELETE /events/:id` (owner) · `POST /events/:id/join` · `POST /events/join` `{inviteCode}` · `POST /events/:id/invites` `{email}` (owner) |
| Queue | `GET /events/:id/queue` · `POST /events/:id/tracks` `{providerTrackId}` · `POST` / `DELETE /events/:id/tracks/:trackId/vote` · `POST /events/:id/next` (owner) |
| Playlists | `POST /playlists` · `GET /playlists` · `GET` / `PATCH` / `DELETE /playlists/:id` · `POST /playlists/:id/join` · `POST /playlists/join` `{inviteCode}` · `POST /playlists/:id/invites` |
| Playlist tracks | `GET /playlists/:id/tracks` · `POST /playlists/:id/tracks` `{providerTrackId, afterId?}` · `PATCH /playlists/:id/tracks/:trackId` `{afterId}` · `DELETE /playlists/:id/tracks/:trackId` |
| Real-time | Socket.IO namespaces `/events`, `/playlists`, `/me`; see [`docs/realtime.md`](docs/realtime.md) |

Refusals come with a machine-readable `reason`:
- voting / suggesting: `not_invited`, `not_started`, `ended`, `location_required`, `outside_area`;
- editing a playlist: `not_member`, `not_invited`.

Too many requests → `429` + `Retry-After`.

---

## Security and correctness

The full write-up is [`docs/security.md`](docs/security.md): every threat from the brief, the protection, the test that proves it, and the risks we accept. In short:

| Topic | What we do |
|---|---|
| Passwords | bcrypt (cost 12); login answers the same message in the same time for unknown emails, wrong passwords and password-less social accounts |
| Brute force | Rate limits per **IP + email** and per IP on auth routes; **5 wrong passwords → account locked 15 min** (atomic counter) |
| Sessions | 15-min JWT access tokens (in memory); refresh tokens random, stored as SHA-256 hashes, **rotated on every use**; a reused one revokes **every** session |
| Social login + linking | **Browser route**: the API runs the provider flow, keeps the secrets, signs a 10-min `state`, hands the app a **60-second single-use code protected by PKCE**. Linking needs a ticket confirmed by the same logged-in user and the same app (against login CSRF) |
| Ownership (IDOR) | Access rules as pure functions used by every REST route and socket; private things answer **404**; unknown body fields are a 400. **Audited** by `test:idor` (57 attacks with someone else's token) |
| Concurrency | Database constraints, not app checks: one vote per (user, track), one playing track, one position per playlist slot, one friendship row per pair; atomic counters. **Proven** by the race tests |
| Action log | One JSON line per request / socket action with **platform, device model, app version** (sent by the app), never bodies or tokens |
| Secrets | `.env` git-ignored; strong JWT secret; Postgres and Mailpit only on 127.0.0.1 |

---

## Database and migrations

`synchronize` is off: the schema only changes through migrations in `apps/api/src/migrations`, so every machine ends up identical.

| Migration | Adds |
|---|---|
| `InitialUsers` | `users`, `uuid-ossp` |
| `NormalizedEmailCheck` | CHECK: emails trimmed and lower-case (with `UNIQUE`, case-insensitive uniqueness) |
| `RefreshTokens` | `refresh_tokens` (hashed, per session) |
| `EmailVerification` | `users.emailVerifiedAt`, `email_verification_codes` |
| `PasswordReset` | `password_reset_codes` |
| `GoogleSignIn` | `users.googleId`, nullable `passwordHash`, `oauth_login_codes` |
| `FacebookSignIn` | `users.facebookId` |
| `TrackVote` | `events`, `event_members`, `event_tracks`, `votes` |
| `OnePlayingTrack` | at most one playing track per event |
| `PlaylistEditor` | `playlists`, `playlist_members`, `playlist_tracks` (position `COLLATE "C"`, unique per slot, a song once) |
| `UserProfile` | profile tiers + music preferences on `users`, `friendships` (one row per pair) |
| `LoginLockout` | `users.failedLoginCount`, `users.lockedUntil` |

**Changing the schema:**
1. Edit an entity. Register new ones in `app.module.ts` **and** `data-source.ts`.
2. `make migration-generate name=WhatChanged`, then **read the generated SQL**.
3. `make migrate` (`make migration-revert` undoes the last one).

`make migration-generate name=Check` with no changes should say "No changes in database schema were found". It exits with an error code; that's expected.

## Tests

```bash
make test                                            # 51 unit tests (access rules, positions, PKCE…)

# against the running API:
npm run test:race --workspace=apps/api               # 10 simultaneous votes -> score exactly 10
npm run test:realtime --workspace=apps/api           # /events: auth, rooms, batching
npm run test:playlist-race --workspace=apps/api      # simultaneous moves / inserts into one gap
npm run test:playlist-realtime --workspace=apps/api  # 30 concurrent edits: every phone's list == the server's
npm run test:friends-race --workspace=apps/api       # two people asking each other at once -> friends
npm run test:me-realtime --workspace=apps/api        # /me friend notifications
npm run test:links --workspace=apps/api              # account linking, PKCE, never locked out
npm run test:idor --workspace=apps/api               # someone else's token on every changing route
npm run test:rate-limit --workspace=apps/api         # limits + lockout (wait a minute between two runs)
```

The concurrency tests were written **before** the code they test, as the brief's test plan asks: each first failed, then passed once the feature existed.

---

## Code layout

```
apps/api/src/
├── main.ts                  # validation pipe (whitelist), serializer, Swagger, API_PORT
├── app.module.ts            # config + DB connection + modules + action-log middleware
├── data-source.ts           # DataSource for the TypeORM CLI (reads the root .env)
├── migrations/
├── auth/                    # register/login/refresh/logout, lockout, email codes, password reset,
│                            # Google/Facebook (browser route + PKCE), linking, JWT, socket auth
├── users/                   # User entity, profile-policy.ts (who sees which tier), profile + search
├── friends/                 # friendships (one row per pair), requests, FriendsBus
├── me/                      # /me Socket.IO gateway (your own notifications)
├── events/                  # Track Vote: event-policy.ts, events + queue, EventsBus, /events gateway
├── playlists/               # Playlist Editor: playlist-policy.ts, positions.ts, tracks, /playlists gateway
├── music/                   # Deezer: search, track lookup, fresh previews
├── security/                # rate limits (throttler options, guard with Retry-After)
├── mail/                    # SMTP (nodemailer → Mailpit in dev)
└── common/                  # action log, client info, decorators, invite codes

apps/mobile/src/
├── app/                     # expo-router screens
│   ├── _layout.tsx          # session restore, splash, (auth) vs (app) guard, gestures root
│   ├── oauth.tsx            # landing route for social-login return links
│   ├── settings.tsx         # Server settings (reachable signed in or not)
│   ├── (auth)/              # login, register, forgot/reset password
│   └── (app)/               # verify-email gate, home, events/, playlists/, profile/, people/
├── session/                 # SessionProvider (tokens, refresh, social login), current user, PKCE
├── api/                     # fetch wrapper (+ client-info headers), form error mapping
├── events/                  # Track Vote realtime hook, owner player, location, labels
├── playlists/               # realtime hook, DragList, player, ordering, labels
├── profile/                 # /me socket provider, linking hook, labels
├── components/  ui/         # shared components (Screen, Button, TextField, chips…)
├── config.ts                # the server address (saved setting or built-in default)
└── theme.ts                 # design tokens (colours, spacing, fonts)

packages/shared/src/index.ts # API/app contract: types for every route and realtime message
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| The app can't reach the API, and `curl localhost:3000/health` fails too | Docker Desktop isn't running, so the API crashed at startup (no database) → start Docker, `make db-up`, then restart the API (Ctrl+C, `make dev-api`) |
| `ECONNREFUSED 127.0.0.1:5433` | Same: Docker Desktop isn't running → start it, `make db-up` |
| Swagger shows schemas with no fields | The watch process started before `nest-cli.json` changed (the plugin is read at start). Ctrl+C, `make dev-api` |
| New routes answer `404 Cannot GET …` after a change | The API's watch mode rebuilt but didn't restart. Ctrl+C, check `lsof -nP -iTCP:3000 -sTCP:LISTEN` (kill a leftover PID), `make dev-api` |
| Test script: "fetch failed: other side closed" | The API restarted (e.g. after a `package.json` change). Wait for `/health`, run again |
| `429 Too many requests` while testing | Rate limits: wait the `Retry-After` seconds, or raise them in `.env` for local tests |
| `ERR_REQUIRE_ESM`, or errors importing `@music-room/shared` | Node too old → `nvm use` (needs ≥ 22.18) |
| Red screen "Unable to resolve ../../App" | Expo was started from the repo root with `npx expo start` → use `make dev-mobile` |
| App stuck on the logo / "Unmatched Route" after adding a screen | New route files need a full reload: press `r` in Metro, or force-stop Expo Go |
| "Something went wrong" right after booting the emulator | Its network wasn't up yet; reload |
| Google: `redirect_uri_mismatch` | The URI in Google Cloud must be exactly `http://localhost:3000/auth/google/callback` (Save, wait a few minutes) |
| Google/Facebook can't reach `localhost:3000` | Run `adb reverse tcp:3000 tcp:3000` again (needed after every emulator start) |
| No location on the emulator | Set one: emulator ⋯ → Location, or `adb emu geo fix <lng> <lat>` |
| No sound | Check the Mac's sound output, then restart the emulator (it keeps the output device it started with) |

## Roadmap

1. **V.7:** load testing with k6 (baseline + spike) on a stated server spec, giving "how many users at once".
2. **V.8:** GitHub Actions running lint + tests on every push.
3. Housekeeping: a periodic cleanup of expired tokens and codes.

## Full specification

The cahier des charges, with the service specs, security plan, ramp-up plan and 20-day schedule: https://claude.ai/code/artifact/d975b604-7777-47c6-ad1a-a0160bfe446b
