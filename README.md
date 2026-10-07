# Music Room

Mobile, collaborative, real-time music app. People gather around an event's live queue, suggest tracks, vote on what plays next, and watch the order change on every phone in real time.

## Status against the brief

| Part | State |
|---|---|
| **V.1 User** — email/password with verification + reset, Google and Facebook login | ✅ Done |
| V.1 User — four profile visibility tiers, music preferences, linking providers from the profile | ⏳ To do |
| **V.2.1 Music Track Vote** — events, visibility, three voting licenses, ranked queue, live updates, playback | ✅ Done |
| V.2.2 Music Control Delegation | ✂️ Not built (scope decision: two services out of three) |
| **V.2.3 Music Playlist Editor** | ⏳ Next |
| V.4 API docs — Swagger UI with full request/response schemas, [`docs/openapi.json`](docs/openapi.json), [`docs/realtime.md`](docs/realtime.md) | ✅ Done |
| V.6 Security — token rotation, ownership checks, DB-level constraints | 🟡 Partial (action logging + rate limiting to do) |
| V.7 Ramp-up (load testing) | ⏳ To do |

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native + **Expo SDK 57** (expo-router) | One codebase, demoable on Android and iOS; runs in Expo Go during development. |
| Backend | **NestJS 12** (Node 22) | A module per area (`auth`, `users`, `music`, `events`); dependency injection keeps services testable; guards enforce access per request; `@nestjs/websockets` + Socket.IO for real-time. |
| Database | **PostgreSQL 16 + TypeORM** | Real transactions and constraints for the parts that must be right under concurrency (votes, playback). Schema only changes through migrations. |
| Music | **Deezer public API** | Search + 30-second previews without an API key or OAuth. Always called through our API. |

**Why not a backend-as-a-service (Firebase / Supabase)?** The brief says *"the SDK you choose must not do your work."* A managed backend would hide exactly what is graded — auth, access rules, real-time sync, concurrency. With NestJS + Postgres every line of that logic is ours to explain.

**The app is a remote control.** The server re-checks every rule (who can see, vote, suggest, play); the app only shows the result.

```
music-room/
├── Makefile                  # every day-to-day command (make help)
├── docker-compose.yml        # Postgres + Mailpit (dev email) — API and Expo run natively
├── .env.example              # API / database / mail / OAuth settings
├── .nvmrc                    # Node 22
├── docs/realtime.md          # Socket.IO reference (events, payloads, rules)
├── apps/
│   ├── api/                  # NestJS API
│   └── mobile/               # Expo app (.env.example for the API address)
└── packages/
    └── shared/               # TypeScript types shared by api and mobile
```

Only Postgres and Mailpit run in Docker. The API and Expo run on the host on purpose: Docker Desktop's file watching is unreliable for `nest start --watch`, and Expo's LAN discovery doesn't work well from inside a container.

---

## Getting started

Requirements: **Node 22** (`.nvmrc`), **Docker Desktop**, and for the app either **Android Studio** (emulator) or a phone with **Expo Go**. On Node ≤ 20.18 the TypeORM CLI crashes with `ERR_REQUIRE_ESM`.

```bash
git clone <your-repo-url> music-room && cd music-room
nvm use                       # Node 22 from .nvmrc

make env                      # creates .env from .env.example — fill it in (see Configuration)
cp apps/mobile/.env.example apps/mobile/.env
make install                  # installs every workspace
make db-up                    # Postgres (host port 5433) + Mailpit (http://localhost:8025)
make migrate                  # creates the schema

make dev-api                  # API on http://localhost:3000 (watch mode)
```

Then the app, on the Android emulator:

```bash
emulator -avd Pixel_8         # or start it from Android Studio → Virtual Device Manager
adb reverse tcp:3000 tcp:3000 # after every emulator start (needed for Google/Facebook login)
npm run start --workspace=apps/mobile   # press a to open on Android, r to reload
```

- **API docs:** Swagger UI at <http://localhost:3000/api-docs> (click **Authorize** and paste an `accessToken` to call protected routes); the same spec as a file in [`docs/openapi.json`](docs/openapi.json); real-time events in [`docs/realtime.md`](docs/realtime.md).
- **Emails** (verification and reset codes) arrive in Mailpit: <http://localhost:8025>.
- `make help` lists every target.

### Configuration (`.env` at the repo root)

| Variable | What |
|---|---|
| `DB_HOST`, `DB_PORT` (5433), `DB_USER`, `DB_PASSWORD`, `DB_NAME` | Postgres. `DB_PORT` is also the port Compose publishes (5433 avoids a native Postgres on 5432). |
| `API_PORT` (`3000`) | The API's port. Set on the command line it wins over `.env` (e.g. a second instance for load tests). |
| `JWT_ACCESS_SECRET` | Signs access tokens. **Use a long random value**: `openssl rand -base64 64`. Changing it signs everyone out. |
| `JWT_ACCESS_EXPIRES` (`15m`), `JWT_REFRESH_EXPIRES` (`7d`) | Token lifetimes. |
| `MAIL_HOST` (`localhost`), `MAIL_PORT` (`1025`), `MAIL_USER`, `MAIL_PASSWORD`, `MAIL_FROM` | SMTP. Defaults point at Mailpit; use a real provider in production. |
| `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google sign-in (see below). |
| `FACEBOOK_APP_ID`, `FACEBOOK_APP_SECRET` | Facebook login (see below). |
| `RATE_LIMIT_PER_MINUTE` (300), `AUTH_ATTEMPTS_PER_ACCOUNT_PER_MINUTE` (10), `AUTH_ATTEMPTS_PER_IP_PER_MINUTE` (100) | Optional: rate limits (see [docs/security.md](docs/security.md)). |

**The app's API address** lives in `apps/mobile/.env` (Expo doesn't read the root `.env`): `EXPO_PUBLIC_API_URL=http://10.0.2.2:3000` for the Android emulator, `http://localhost:3000` for the iOS simulator, or `http://<your Mac's LAN IP>:3000` for a phone on the same Wi-Fi. It's built into the app, so never put secrets there.

### Google and Facebook setup (one time)

- **Google Cloud Console** → APIs & Services: OAuth consent screen (External, testing mode, add your accounts as test users) → Credentials → **OAuth client ID, Web application**, Authorized redirect URI **`http://localhost:3000/auth/google/callback`** → put the ID and secret in `.env`.
- **developers.facebook.com** → Create App with the Facebook Login use case, add the **`email`** permission, keep it in **Development mode** (localhost redirects are allowed automatically; only people with a role on the app can log in) → App ID and App Secret in `.env`.
- Both redirect to `http://localhost:3000`, which reaches the API from the emulator thanks to `adb reverse` — no tunnel needed.

---

## Features

### Accounts (V.1)

- **Email + password:** register → a **6-digit code** is emailed → enter it in the app ("Check your email"). Unverified accounts can only reach that screen.
- **Forgot password:** code by email → new password → every session is ended.
- **Continue with Google / Facebook** on Log in and Register (browser route, see Security). A Google account is linked to an existing account only if Google confirms the email is verified; Facebook never auto-links.
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
- **Playback:** the owner's phone is the speaker — "Start the music", Pause, Next; it plays the top track's 30-second preview and moves on by itself. Everyone else sees "Now playing".

---

## API overview

All routes need `Authorization: Bearer <accessToken>` unless marked public. Every route, body, response and error code is in Swagger UI and [`docs/openapi.json`](docs/openapi.json).

**How the docs are generated:** routes come from the controllers' decorators; request schemas from the DTO classes through the Nest Swagger compiler plugin (`apps/api/nest-cli.json`, which also turns `class-validator` rules into limits like `maxLength`); response schemas from classes in `*/dto/*-responses.dto.ts` that `implements` the shared types in `packages/shared`, so they can't drift. After changing routes or DTOs, restart the API and run `npm run docs:openapi --workspace=apps/api` to refresh `docs/openapi.json`.

| Area | Routes |
|---|---|
| Health | `GET /health` (public) |
| Auth (public) | `POST /auth/register` · `/auth/login` · `/auth/refresh` · `/auth/logout` · `/auth/forgot-password` · `/auth/reset-password` · `/auth/oauth/exchange` |
| Auth (logged in) | `POST /auth/verify-email` · `/auth/resend-verification` |
| Social login (browser redirects) | `GET /auth/{google,facebook}/start?redirect=&code_challenge=` · `GET /auth/{google,facebook}/callback` |
| Users | `GET /users/me` |
| Music | `GET /music/search?q=` · `GET /music/tracks/:providerTrackId/preview` |
| Events | `POST /events` · `GET /events` · `GET /events/:id[?lat&lng]` · `PATCH` / `DELETE /events/:id` (owner) · `POST /events/:id/join` · `POST /events/join` `{inviteCode}` · `POST /events/:id/invites` `{email}` (owner) |
| Queue | `GET /events/:id/queue` · `POST /events/:id/tracks` `{providerTrackId}` · `POST` / `DELETE /events/:id/tracks/:trackId/vote` · `POST /events/:id/next` (owner) |
| Real-time | Socket.IO namespace `/events` — see [`docs/realtime.md`](docs/realtime.md) |

Refusals for voting/suggesting are `403` with a machine-readable `reason`: `not_invited`, `not_started`, `ended`, `location_required`, `outside_area`.

---

## Security and correctness choices

| Topic | What we do |
|---|---|
| Passwords | bcrypt (12 rounds); login answers the same message in the same time for unknown emails, wrong passwords and password-less social accounts |
| Sessions | Short-lived JWT access tokens; refresh tokens are random, stored only as SHA-256 hashes, **rotated on every use**; a reused refresh token revokes **every** session of that user. The app never sends two refreshes at once |
| Codes by email | 6 digits, hashed (salted with purpose + user), 15 min, 5 attempts counted atomically, 60 s resend cooldown; reset requests never reveal whether an email exists |
| Social login | **Browser route**: our API runs the provider flow (Google = OpenID Connect with a verified ID token; Facebook = OAuth 2.0 + Graph API with `appsecret_proof`), keeps the client secrets, signs a 10-minute `state`, only redirects to app deep links, and hands the app a **60-second single-use code protected by PKCE** — never tokens in a URL |
| Access to events | One policy module shared by REST and real-time; private events answer **404** to outsiders (their existence isn't revealed); invite codes only shown to members |
| Votes under concurrency | Primary key (track, user) + `INSERT … ON CONFLICT DO NOTHING` + atomic `score = score ± 1` in one transaction; proven by the race test |
| Playback | `next` locks the event row and accepts the track the phone thinks is playing (stale = no-op); a partial unique index allows one playing track per event |
| Database rules | CHECK constraints (lower-case emails, geo fields all-or-nothing, score ≥ 0), partial unique indexes (a song queued once), cascades |
| Location | Checked against the radius and logged; **faked GPS is an accepted, documented risk** |
| Secrets | `.env` is git-ignored; `.env.example` has placeholders |

Still to do (V.6): action logging with platform / device / app version, rate limiting (login, codes, geo votes).

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

Changing the schema: edit an entity (and register new ones in `app.module.ts` **and** `data-source.ts`) → `make migration-generate name=WhatChanged` → **read the generated SQL** → `make migrate` (`make migration-revert` undoes the last one). `make migration-generate name=Check` with no changes should say "No changes in database schema were found" (it exits with an error code — expected).

## Tests

```bash
make test                                      # unit tests (event access rules)
npm run test:race --workspace=apps/api         # concurrency: simultaneous votes (API running)
npm run test:realtime --workspace=apps/api     # Socket.IO: auth, rooms, broadcasts (API running)
```

The race test checks the brief's scenario: 10 users voting on the same track in the same instant → score exactly 10; one user firing the same vote 10 times → 1.

---

## Code layout

```
apps/api/src/
├── main.ts                  # validation pipe, serializer (hides passwordHash…), Swagger
├── app.module.ts            # config + DB connection + modules
├── data-source.ts           # DataSource for the TypeORM CLI (reads the root .env)
├── migrations/
├── auth/                    # register/login/refresh/logout, email codes, password reset,
│                            # Google/Facebook (browser route + PKCE), JWT strategy/guard
├── users/                   # User entity, /users/me
├── mail/                    # SMTP (nodemailer → Mailpit in dev)
├── music/                   # Deezer: search, track lookup, fresh previews
├── events/                  # Track Vote: entities, event-policy.ts (access rules),
│                            # events + queue services/controllers, EventsBus, Socket.IO gateway
└── common/                  # @CurrentUser, @NormalizeEmail, duration parsing

apps/mobile/src/
├── app/                     # expo-router screens
│   ├── _layout.tsx          # session restore, splash, (auth) vs (app) guard
│   ├── oauth.tsx            # landing route for social-login return links
│   ├── (auth)/              # login, register, forgot/reset password
│   └── (app)/               # verify-email gate, home, events/ (list, new, join, [id] queue/info/add)
├── session/                 # SessionProvider (tokens, refresh, social login), current user, PKCE
├── api/                     # fetch wrapper + error shape, form error mapping
├── events/                  # realtime hook, owner player, location, labels
├── components/              # SocialSignInButton
├── ui/                      # Screen, Text, Button, TextField, Card, ChoiceChips, OrDivider
└── theme.ts                 # design tokens (colours, spacing, fonts)

packages/shared/src/index.ts # API/app contract types (users, auth, tracks, events, queue, realtime)
```

---

## Troubleshooting

| Symptom | Fix |
|---|---|
| Swagger shows schemas with no fields | The watch process started before `nest-cli.json` changed (the plugin is read at start). Ctrl+C, `make dev-api`. |
| New routes answer `404 Cannot GET …` after a change | The API's watch mode rebuilt but didn't restart. Ctrl+C, check `lsof -nP -iTCP:3000 -sTCP:LISTEN` (kill a leftover PID), `make dev-api`. |
| `ECONNREFUSED 127.0.0.1:5433` | Docker Desktop isn't running → start it, `make db-up`. |
| `ERR_REQUIRE_ESM` from the TypeORM CLI | Wrong Node version → `nvm use` (22). |
| App stuck on the logo / "Unmatched Route" after adding a screen | New route files need a full reload: press `r` in Metro, or force-stop Expo Go. |
| "Something went wrong" right after booting the emulator | Its network wasn't up yet — reload. |
| Google: `redirect_uri_mismatch` | The URI in Google Cloud must be exactly `http://localhost:3000/auth/google/callback` (Save, wait a few minutes). |
| Google/Facebook login can't reach `localhost:3000` | Run `adb reverse tcp:3000 tcp:3000` again (needed after every emulator start). |
| No location on the emulator | Set one: emulator ⋯ → Location, or `adb emu geo fix <lng> <lat>`. |
| No sound | Check the Mac's sound output, then restart the emulator (it keeps the output device it started with). |

## Roadmap

Done: Playlist Editor (V.2.3), Profile and friends (V.1), Security (V.6, see [docs/security.md](docs/security.md)).

1. **V.7** — load testing with k6 (baseline + spike) and a stated server spec.
2. Housekeeping — a periodic cleanup of expired tokens and codes.

## Full specification

The cahier des charges — service specs, security plan, ramp-up plan and the 20-day schedule: https://claude.ai/code/artifact/d975b604-7777-47c6-ad1a-a0160bfe446b
