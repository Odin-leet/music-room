# Music Room — technical documentation

How the project works inside: what each part does, how the parts talk to each other, and **why** each choice was made. The project [README](../../README.md) says what the project is and how to start it; these pages explain the code.

Every page ends with **files to open**: where to look in the code for what it describes.

| # | Page | What it explains |
|---|---|---|
| 1 | [Running it on any laptop](01-running.md) | `make start`, what it does step by step, a phone, Google keys, problems |
| 2 | [Architecture](02-architecture.md) | The parts (API, mobile, web, shared types, Postgres), one request from end to end, realtime, configuration |
| 3 | [Data model](03-data-model.md) | Every table, its relations and the rules the database itself enforces |
| 4 | [Accounts and sign-in](04-auth.md) | Passwords, tokens and their rotation, email codes, lockout, rate limits, Google / Facebook, linking |
| 5 | [Profiles and friends](05-profiles-friends.md) | The four visibility tiers, friend requests, live friend notifications |
| 6 | [Track Vote](06-track-vote.md) | Events, who may vote, the ranked queue, votes under concurrency, playback, live updates |
| 7 | [Playlist Editor](07-playlist-editor.md) | Ordering without locks (fractional positions), concurrent edits, live changes |
| 8 | [The apps](08-apps.md) | The mobile app and the web app: structure, session, player, live hooks, music |

Related reference documents (already in `docs/`):
- [`openapi.json`](../openapi.json): every REST route and schema (also served as Swagger UI at `/api-docs`).
- [`realtime.md`](../realtime.md): every socket message.
- [`security.md`](../security.md): threats, protections, the tests that prove them, accepted risks.
- [`control-delegation.md`](../control-delegation.md): the design of the service that was not built.

## Words used everywhere

| Word | Meaning here |
|---|---|
| **Event** | A Track Vote party: one shared queue people vote on |
| **Playlist** | A Playlist Editor playlist: tracks several people edit at once |
| **Member / role** | A user's link to an event or playlist: `owner`, `invited` (invited by email) or `guest` (joined it) |
| **Visibility** | Who can **find and see** it: `public` or `private` (members only) |
| **License** | Who can **act** on it: vote (events) or edit (playlists) |
| **Policy** | A plain function that answers "may this user do that?" (`canView`, `canParticipate`, `canEdit`, `profileFor`) |
| **Bus** | An in-process message the services publish **after** a database change commits, for the realtime layer to send |
| **Room** | A Socket.IO group: everyone watching one event / playlist, or one user's own devices |
| **Access / refresh token** | The short-lived (15 min) JWT sent with every request / the long-lived (7 days) secret that gets a new pair |
| **PKCE** | The proof (RFC 7636) that the app finishing a social login is the one that started it |
| **Fractional position** | A sortable string key that lets a track go *between* two others without renumbering anything |
