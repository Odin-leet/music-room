# apps/

The two npm workspaces of the monorepo:

- **api/** — NestJS API (auth, users, music, Track Vote events, real-time gateway). Run it with `make dev-api`.
- **mobile/** — Expo (React Native) app. Run it with `npm run start --workspace=apps/mobile`; set its API address in `mobile/.env` (copy `mobile/.env.example`).

Both were generated once with `make scaffold-api` / `make scaffold-mobile` and are now regular source code — don't re-run those targets.

See the root [`README.md`](../README.md) for setup, configuration, features and the code layout of each app.
