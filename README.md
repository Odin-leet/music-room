# Music Room

Mobile, collaborative, real-time music app — live track voting and a shared playlist editor (the V.2.1 and V.2.3 services of the brief).

**Status:** backend foundation and core auth are built and tested. The two music services, social login, email verification and the mobile app are not started yet — see [Roadmap](#roadmap).

## Architecture

| Layer | Choice | Why |
|---|---|---|
| Mobile | React Native (Expo) | One codebase, one language, demoable on Android and iOS from day one. |
| Backend | NestJS (Node.js) | A module per service (`auth`, `users`, `track-vote`, `playlist-editor`) instead of one tangled `index.js`; dependency injection keeps services testable in isolation; guards give a single, auditable place to enforce ownership per request; `@nestjs/websockets` sits on Socket.IO for the real-time layer both services need. |
| Database | PostgreSQL + TypeORM | Relational integrity for users, events and votes; real transactions for atomic vote counts and playlist reordering. Schema is managed by migrations, never `synchronize`. |

**Why not a backend-as-a-service (Firebase/Supabase)?** The brief says explicitly: *"the SDK you choose must not do your work."* A managed backend would hand-wave exactly the parts that are graded — auth, ownership rules, real-time sync, concurrency handling. NestJS + Postgres means every line of that logic is ours to explain at defense.

npm workspaces monorepo:

```
music-room/
├── Makefile                 # every day-to-day command (make help)
├── docker-compose.yml       # Postgres only — API and Expo run natively
├── .env.example
├── .nvmrc                   # Node 22
├── apps/
│   ├── api/                 # NestJS
│   └── mobile/              # Expo — not scaffolded yet (make scaffold-mobile)
└── packages/
    └── shared/              # TypeScript types shared by api <-> mobile
```

Only Postgres runs in Docker. The API and Expo run on the host on purpose: Docker Desktop's file watching is flaky for `nest start --watch`, and Expo's LAN discovery doesn't work well from inside a container.

## Setup

Requires **Node 22** (`.nvmrc`) and Docker. On Node 20.18 and earlier, the TypeORM CLI and Nest schematics crash with `ERR_REQUIRE_ESM` because they `require()` ESM-only dependencies.

```bash
git clone <your-repo-url> music-room && cd music-room
nvm use                 # reads .nvmrc; or: nvm install 22

make env                # creates .env from .env.example — then set real secrets
make install            # installs every workspace
make db-up              # Postgres in Docker, on host port 5433
make migrate            # creates the schema from apps/api/src/migrations

make dev-api            # NestJS in watch mode, http://localhost:3000
```

Swagger UI is served at <http://localhost:3000/api-docs>. `make help` lists every target.

In `.env`, replace `JWT_ACCESS_SECRET` with a real random value before anything but local dev:

```bash
openssl rand -base64 48
```

**Why port 5433:** `DB_PORT` sets both the port Compose publishes and the port the API connects to. It defaults to 5433 so it doesn't collide with a natively installed Postgres on 5432.

## Database and migrations

`synchronize` is off. The schema only changes through migrations in `apps/api/src/migrations`, so every machine (and the grading machine) ends up with an identical database.

| Migration | Does |
|---|---|
| `InitialUsers` | `users` table (uuid PK, unique email) and the `uuid-ossp` extension |
| `NormalizedEmailCheck` | `CHECK (email = lower(btrim(email)))` — with `UNIQUE(email)`, makes emails case-insensitively unique at the DB level |
| `RefreshTokens` | `refresh_tokens` table: FK to `users` with `ON DELETE CASCADE`, index on `userId`, unique index on `tokenHash` |

Changing the schema:

1. Edit or add an entity (and register it in both `app.module.ts` and `data-source.ts`).
2. `make migration-generate name=WhatChanged`
3. Read the generated SQL in `apps/api/src/migrations/` — it's a first draft, not gospel.
4. `make migrate` (undo the last one with `make migration-revert`).

Running `make migration-generate name=Check` with no entity changes should print *"No changes in database schema were found"* — a quick way to prove entities and DB agree. (TypeORM exits non-zero in that case, so `make` reports an error; that's expected.)

`make db-shell` opens `psql` in the container; `\dt` should list `migrations`, `users` and `refresh_tokens`.

## API — built so far

| Method & path | Auth | Does |
|---|---|---|
| `POST /auth/register` | — | `{ email, password, displayName }` → 201 user. Password 8–72 chars, hashed with bcrypt (12 rounds). 409 if the email is taken. |
| `POST /auth/login` | — | `{ email, password }` → 200 `{ accessToken, refreshToken }`. 401 with the same message and similar timing for unknown email and wrong password. |
| `POST /auth/refresh` | — | `{ refreshToken }` → 200 new pair; the old refresh token is revoked. 401 if unknown, expired or revoked. |
| `POST /auth/logout` | — | `{ refreshToken }` → 204 always; revokes that one session only. |
| `GET /users/me` | Bearer | 200 own profile. |

Across all routes:

- **Validation** — a global `ValidationPipe` (`whitelist`, `forbidNonWhitelisted`, `transform`) rejects missing, malformed or unexpected fields with 400.
- **Emails** are trimmed and lowercased by `@NormalizeEmail()` before validation, and the DB constraint above enforces the same rule.
- **`passwordHash` never leaves the API** — it's marked `@Exclude()` and stripped by the global `ClassSerializerInterceptor`. This only works when a route returns an entity instance, not a hand-built object literal.

### Tokens

- **Access token:** JWT, HS256, 15 minutes (`JWT_ACCESS_EXPIRES`), payload `{ sub, email }`. Sent as `Authorization: Bearer …`. It is stateless, so it stays valid until it expires even after logout.
- **Refresh token:** 32 random bytes (base64url), not a JWT. Only its SHA-256 hash is stored, one `refresh_tokens` row per login session, valid 7 days (`JWT_REFRESH_EXPIRES`).
- **Rotation:** every refresh revokes the presented token and issues a new pair.
- **Reuse detection:** presenting an already-revoked token means it was copied, so every session of that user is revoked. The revoke is a conditional `UPDATE … WHERE revokedAt IS NULL`, so two concurrent refreshes with the same token can't both succeed.

**Client rule (for the mobile app):** never run two refreshes in parallel. If several requests see an expired access token at once, they must share one in-flight refresh — otherwise the second refresh looks like reuse and logs the user out everywhere.

## Code layout

```
apps/api/src/
├── main.ts                  # global ValidationPipe, ClassSerializerInterceptor, Swagger
├── app.module.ts            # config + TypeORM connection
├── data-source.ts           # standalone DataSource for the TypeORM CLI (loads the root .env)
├── migrations/
├── auth/
│   ├── auth.controller.ts   # /auth/*
│   ├── auth.service.ts      # hashing, token issuing, rotation, reuse detection
│   ├── refresh-token.entity.ts
│   ├── jwt.strategy.ts      # verifies Bearer tokens → request.user = { userId, email }
│   ├── jwt-auth.guard.ts
│   └── dto/                 # register, login, refresh
├── users/
│   ├── user.entity.ts
│   ├── users.service.ts     # create (409 on duplicate), findByEmail, findById
│   ├── users.controller.ts  # GET /users/me
│   └── users.module.ts      # exports UsersService for AuthModule
└── common/
    ├── decorators/          # @NormalizeEmail(), @CurrentUser()
    └── parse-duration.ts    # "15m" / "7d" → milliseconds
```

## Roadmap

Not built yet, roughly in order:

- **Auth extras (V.1):** email verification, password reset (should also revoke all sessions), Google/Facebook login and account linking. `.env.example` already has the `MAIL_*`, `GOOGLE_*` and `FACEBOOK_*` keys.
- **Users:** the four visibility tiers (public / friends / private / music preferences), `PATCH /users/me`, public profiles, and a friends model to enforce the friends tier.
- **Track Vote (V.2.1):** events, tracks, votes, public/private events with invites, location/time-restricted voting, live ranking over WebSockets.
- **Playlist Editor (V.2.3):** playlists, collaborators, concurrent editing with live sync.
- **Mobile app:** `make scaffold-mobile`, then build against the API. The backend address must be configurable (V.5): the app reads `EXPO_PUBLIC_API_URL`.
- **Shared types:** `packages/shared` currently has `AuthTokens` and `PublicUserProfile`; event, track, vote and playlist shapes will be added as the services are built.
- **Housekeeping:** remove the unused `JWT_REFRESH_SECRET`; a periodic cleanup of expired `refresh_tokens` rows.

## Full specification

The complete cahier des charges — service specs, security plan, ramp-up/load-testing plan and the day-by-day 20-day schedule: https://claude.ai/code/artifact/d975b604-7777-47c6-ad1a-a0160bfe446b
