# 1. Running it on any laptop

## What the laptop needs

| Tool | Why | Check |
|---|---|---|
| **Docker**: Docker Desktop (macOS, Windows) **or Docker Engine + the Compose plugin** (Linux, no Desktop needed) | Runs Postgres and Mailpit (the fake mail inbox). Only `docker compose` (v2, ≥ 2.1) is used | `docker info`, `docker compose version` |
| **Node.js ≥ 22.18** | Runs the API, the web app and Expo. 22.18 is the first version that loads the shared TypeScript package without a build step | `node -v` |
| **Git** | To get the code | `git --version` |
| For the phone: **Expo Go** | Opens the mobile app from a QR code (any network with the tunnel, see [Phones](#phones-tunnel-and-the-api-address)) | — |

Nothing else: no global packages, no database install.

**On Linux** (Docker Engine, no Desktop):

```bash
sudo apt install docker-ce docker-compose-plugin curl   # Docker's own apt repository; or your distribution's packages
sudo systemctl enable --now docker                      # start the daemon now and at boot
sudo usermod -aG docker $USER                           # use docker without sudo; then log out and back in
```

Setup checks each of these and says exactly which one is missing: daemon not running, no permission on its socket, no Compose plugin, Compose too old, no curl.

## One command

```bash
git clone <repo-url> music-room && cd music-room
cp /path/to/your/.env .env        # optional: your .env with the Google / Facebook keys
make start
```

`make start` runs [`scripts/start.sh`](../../scripts/start.sh), which first runs [`scripts/setup.sh`](../../scripts/setup.sh). Every setup step is skipped when it's already done, so `make start` is also the everyday command.

```mermaid
flowchart TD
  A[make start] --> S1["1. Tools: Node >= 22.18? Docker running?<br/>(macOS: starts Docker Desktop itself)"]
  S1 --> S2["2. Configuration:<br/>.env kept if present, else created with a random JWT secret<br/>apps/web/.env and apps/mobile/.env created if missing"]
  S2 --> S3["3. Packages: npm ci, only if node_modules is missing or older than package-lock.json"]
  S3 --> S4["4. Database: docker compose up --wait (Postgres + Mailpit)"]
  S4 --> S5["5. Schema: TypeORM migrations"]
  S5 --> P{"Ports 3000, 5173, 8081 free?"}
  P -- no --> X["Says which process holds the port, stops (never kills it)"]
  P -- yes --> B["API (watch mode) + web app in the background<br/>logs in .logs/servers.log"]
  B --> H["Waits for /health and the web page"]
  H --> T{"NGROK_DOMAIN in .env?"}
  T -- "yes" --> TA["phone → API: https://NGROK_DOMAIN"]
  T -- "no" --> TL["phone → API: http://laptop-Wi-Fi-IP:3000"]
  TA --> E["Expo in the foreground, --tunnel: QR code + keys<br/>(3 tries, then Wi-Fi mode)"]
  TL --> E
  E --> C["Ctrl+C: stops Expo, then the API and the web app"]
```

When it's ready it prints:

```
HOLY is running
Web app        http://localhost:5173
API docs       http://localhost:3000/api-docs
Emails (codes) http://localhost:8025
Phone app      Expo Go, scan the QR code (tunnel: any network)
Phone → API    https://<NGROK_DOMAIN>   (public: any network)  — or http://<laptop IP>:3000 (same Wi-Fi only)
Server logs    make logs   (in another terminal)
```

| Command | What |
|---|---|
| `make start` | Everything (setup, API, web, Expo) |
| `make start-lan` | The same with Expo on the Wi-Fi only (no tunnel) |
| `make start-web` | The same without Expo |
| `make setup` | Only the setup steps |
| `make logs` | Follow the API and web logs, including the JSON action log (V.6) |
| `make help` | Every target |

**Why Expo runs in the foreground:** Expo only shows its QR code and accepts keys (`a` Android, `r` reload) when it owns a real terminal. Started next to the others (for example with `concurrently`), it runs "non-interactive" with no QR code. So the API and the web app go to the background with their output in a log file, and Expo gets the terminal.

## The `.env` files

| File | Created by setup when missing | Holds |
|---|---|---|
| `.env` (repo root) | From `.env.example`, with a **fresh random** `JWT_ACCESS_SECRET` | Database, JWT, mail, Google / Facebook keys, `WEB_ORIGINS`. Read by the API and Docker Compose |
| `apps/web/.env` | From its example | `VITE_API_URL` (default API address of the web app) |
| `apps/mobile/.env` | From its example; the API address is set to the laptop's **Wi-Fi IP** | `EXPO_PUBLIC_API_URL` (default API address of the app) |

All three are git-ignored. Setup never overwrites an existing one, and never prints a secret's value.

**Bringing your own `.env`** (with the Google / Facebook keys): copy it to the repo root before `make start`. Without it, setup generates one: email + password works fully, and the Google / Facebook buttons fail at the provider (no keys).

## Using the apps

- **Web:** open http://localhost:5173. Register, then the 6-digit code arrives in Mailpit (http://localhost:8025).
- **Phone:** scan the QR code with Expo Go (Android) or the Camera (iOS). On the first screen, **Server: … · change** must show the "Phone → API" address from the banner. `make start` gives it to the app; an address saved earlier in the app's Server settings wins, so change it there if needed (brief V.5).
- **Android emulator:** press `a` in the Expo terminal. The API address for the emulator is `http://10.0.2.2:3000`. For Google sign-in run `adb reverse tcp:3000 tcp:3000` after each emulator start.

## Phones: tunnel and the API address

A phone needs two things from the laptop:

| | What | How it's reached |
|---|---|---|
| 1 | **The app's code**, from Metro (Expo's bundler) | `make start` runs Expo with **`--tunnel`**: a public `exp://….exp.direct` address, so the phone can be on **any network** (4G, another Wi-Fi). `make start-lan` = same Wi-Fi only |
| 2 | **The API** | With `NGROK_DOMAIN` + `NGROK_AUTHTOKEN` in `.env` (a free ngrok account and its free static domain), the API opens `https://<NGROK_DOMAIN>` at start, and `make start` gives that address to the app → any network. Without them: `http://<laptop Wi-Fi IP>:3000`, **same Wi-Fi only** |

So for a phone on **any** network you need both: the tunnel (automatic) **and** `NGROK_DOMAIN` (once, in `.env`). On the same Wi-Fi, neither is needed.

**The tunnel isn't ours.** `--tunnel` goes through **Expo's own ngrok account**, shared by every Expo user in the world. It is sometimes full: *"Your account is limited to 5000 simultaneous ngrok agent sessions" (ERR_NGROK_108)*, seen while testing this. So `make start` tries it **3 times**, then falls back to Wi-Fi mode and says so, instead of failing. For the defense: have the phone on the laptop's Wi-Fi (or the laptop on the phone's hotspot) as the safe path.

**Sign in with Google on a phone** also needs the public API address: Google sends the browser back to `https://<NGROK_DOMAIN>/auth/google/callback`, which must be registered in Google Cloud (and in Facebook Login for Facebook). See the README → "Testing on a real phone".

## Google / Facebook on another laptop

Google and Facebook only send the browser back to **registered** addresses. The registered callbacks are `http://localhost:3000/auth/google/callback` and `http://localhost:3000/auth/facebook/callback`.

| From | Works? | Why |
|---|---|---|
| The web app on the laptop | Yes (with the keys) | The browser is on the laptop, so `localhost:3000` is the API |
| The Android emulator | Yes, after `adb reverse tcp:3000 tcp:3000` | The emulator's `localhost:3000` is forwarded to the laptop |
| A real phone | Only through a public HTTPS address (ngrok, README → "Testing on a real phone") | On a phone, `localhost` is the phone itself |

## When something goes wrong

| What you see | Cause → fix |
|---|---|
| `Node … is too old` | `nvm install 22 && nvm use 22`, then `make start` |
| `Docker is not running` (macOS) | Start Docker Desktop (setup tries itself), then `make start` |
| `The Docker daemon is not running` (Linux) | `sudo systemctl start docker` |
| `No permission to use Docker` (Linux) | `sudo usermod -aG docker $USER`, log out and back in (or `newgrp docker`) |
| `The Docker Compose plugin is missing` | Install `docker-compose-plugin` (the old `docker-compose` v1 isn't supported) |
| `Port 3000 is already in use` | Another API is running (often in another terminal): stop it. It names the process (`lsof`), or tells you to run `ss -ltnp \| grep :3000` on Linux |
| `The API didn't start` + log lines | Read them: usually a bad value in `.env` |
| The phone can't reach the server | Look at "Phone → API" in the banner. Wi-Fi address: same Wi-Fi? Some school / guest Wi-Fis block devices from seeing each other → put the laptop on the phone's hotspot, or set `NGROK_DOMAIN`. The address in the app's Server settings must be the banner's |
| `Expo's tunnel did not open (attempt n/3)` | Expo's shared tunnel service is full or down (not our setup). It falls back to Wi-Fi by itself; retry later for the tunnel |
| `relation … does not exist` | Migrations didn't run: `make setup` |
| A test account needs its code | Mailpit: http://localhost:8025 |

## Files to open

| File | What |
|---|---|
| `scripts/setup.sh` | The five setup steps |
| `scripts/start.sh` | Ports check, background servers, the phone's API address, Expo in tunnel mode (with fallback) in the foreground, clean stop |
| `Makefile` | Every command (`make help`) |
| `docker-compose.yml` | Postgres 16 and Mailpit, bound to 127.0.0.1 only |
| `.env.example`, `apps/*/.env.example` | Every setting, with comments |
