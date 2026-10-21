#!/usr/bin/env bash
# One-time (and safe to re-run) setup on any machine: checks the tools,
# prepares the .env files, installs the packages, starts Postgres + Mailpit
# and applies the migrations. `make setup` runs it; `make start` runs it
# first too. Every step is skipped when already done.
set -euo pipefail
cd "$(dirname "$0")/.."

bold() { printf '\033[1m%s\033[0m\n' "$*"; }
ok() { printf '  \033[32m✓\033[0m %s\n' "$*"; }
warn() { printf '  \033[33m!\033[0m %s\n' "$*"; }
fail() {
  printf '  \033[31m✗ %s\033[0m\n' "$*"
  exit 1
}

# ---------- 1. tools ----------
bold "1/5  Tools"
command -v node >/dev/null || fail "Node.js is not installed. Install Node 22 (nvm install 22), then run make setup again."
node -e '
  const [maj, min] = process.versions.node.split(".").map(Number);
  process.exit(maj > 22 || (maj === 22 && min >= 18) ? 0 : 1);
' || fail "Node $(node -v) is too old: Node >= 22.18 is needed (nvm install 22 && nvm use 22)."
ok "Node $(node -v)"
command -v docker >/dev/null || fail "Docker is not installed. Install Docker Desktop, start it, then run make setup again."
if ! docker info >/dev/null 2>&1; then
  if [ "$(uname)" = "Darwin" ]; then
    warn "Docker Desktop is not running: starting it (up to 2 minutes)…"
    open -a Docker || true
    for _ in $(seq 1 60); do docker info >/dev/null 2>&1 && break; sleep 2; done
  fi
  docker info >/dev/null 2>&1 || fail "Docker is not running. Start Docker Desktop, then run make setup again."
fi
ok "Docker $(docker version --format '{{.Server.Version}}' 2>/dev/null)"

# ---------- 2. .env files ----------
bold "2/5  Configuration"
# The laptop's address on the Wi-Fi: what a phone uses to reach the API.
lan_ip() {
  if [ "$(uname)" = "Darwin" ]; then
    ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true
  else
    hostname -I 2>/dev/null | awk '{print $1}' || true
  fi
}
LAN_IP="$(lan_ip)"

if [ -f .env ]; then
  ok ".env found (kept as it is)"
else
  cp .env.example .env
  # A fresh random signing key: never the example's placeholder.
  secret=$(node -e 'console.log(require("node:crypto").randomBytes(64).toString("base64url"))')
  node -e '
    const fs = require("node:fs");
    const s = fs.readFileSync(".env", "utf8").replace(/^JWT_ACCESS_SECRET=.*$/m, "JWT_ACCESS_SECRET=" + process.argv[1]);
    fs.writeFileSync(".env", s);
  ' "$secret"
  ok ".env created from .env.example, with a new random JWT_ACCESS_SECRET"
fi

# What's missing or still a placeholder (values are never printed).
val() { grep -E "^$1=" .env | tail -1 | cut -d= -f2- | tr -d '"' || true; }
[ "$(val JWT_ACCESS_SECRET)" = "change-me" ] || [ -z "$(val JWT_ACCESS_SECRET)" ] &&
  fail "JWT_ACCESS_SECRET in .env is empty or 'change-me'. Delete .env and run make setup again (a random one is generated)."
for k in DB_HOST DB_PORT DB_USER DB_PASSWORD DB_NAME; do
  [ -n "$(val $k)" ] || fail "$k is empty in .env"
done
if [ -z "$(val GOOGLE_CLIENT_ID)" ] || [ -z "$(val FACEBOOK_APP_ID)" ]; then
  warn "Google / Facebook keys are empty in .env: email + password works, social login doesn't."
  warn "To get it, copy your own .env (with the keys) to this folder and run make setup again."
else
  ok "Google and Facebook keys present"
fi
[ -z "$(val NGROK_DOMAIN)" ] || warn "NGROK_DOMAIN is set: the API will try to open that tunnel at start."

if [ -f apps/web/.env ]; then
  ok "apps/web/.env found"
else
  cp apps/web/.env.example apps/web/.env
  ok "apps/web/.env created (API: http://localhost:3000)"
fi

if [ -f apps/mobile/.env ]; then
  ok "apps/mobile/.env found"
else
  cp apps/mobile/.env.example apps/mobile/.env
  if [ -n "$LAN_IP" ]; then
    # A phone with Expo Go reaches the laptop through its Wi-Fi address.
    node -e '
      const fs = require("node:fs");
      const p = "apps/mobile/.env";
      fs.writeFileSync(p, fs.readFileSync(p, "utf8").replace(/^EXPO_PUBLIC_API_URL=.*$/m, "EXPO_PUBLIC_API_URL=http://" + process.argv[1] + ":3000"));
    ' "$LAN_IP"
    ok "apps/mobile/.env created (API: http://$LAN_IP:3000, this laptop on the Wi-Fi)"
  else
    ok "apps/mobile/.env created (API: http://10.0.2.2:3000, the Android emulator)"
  fi
fi

# ---------- 3. packages ----------
bold "3/5  Packages"
# npm writes node_modules/.package-lock.json on install: older than the
# lockfile = the dependencies changed since (e.g. after a git pull).
if [ ! -f node_modules/.package-lock.json ] || [ package-lock.json -nt node_modules/.package-lock.json ]; then
  echo "  installing (npm ci, a few minutes the first time)…"
  npm ci --no-audit --no-fund --loglevel=error
  ok "installed"
else
  ok "already installed"
fi

# ---------- 4. database ----------
bold "4/5  Database (Docker)"
docker compose up -d --wait postgres mailpit >/dev/null 2>&1 ||
  fail "Postgres / Mailpit didn't start: docker compose logs postgres"
ok "Postgres on 127.0.0.1:$(val DB_PORT), Mailpit on http://localhost:8025"

# ---------- 5. schema ----------
bold "5/5  Schema"
out=$(cd apps/api && npm run --silent typeorm -- migration:run -d src/data-source.ts 2>&1) ||
  { echo "$out" | tail -20; fail "migrations failed"; }
if echo "$out" | grep -q "No migrations are pending"; then ok "up to date"; else ok "migrations applied"; fi

echo
bold "Ready. Next: make start"
