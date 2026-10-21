#!/usr/bin/env bash
# `make start`: everything with one command.
#   1. setup.sh (tools, .env files, packages, database, migrations)
#   2. the API and the web app in the background (logs: .logs/servers.log)
#   3. Expo in the foreground, with its QR code and keys (a: Android, r: reload)
# Ctrl+C stops all of it. MOBILE=0 make start: no Expo (API + web only).
set -euo pipefail
cd "$(dirname "$0")/.."

./scripts/setup.sh
echo

# Ports must be free: say who holds one rather than killing anything.
for port in 3000 5173 $([ "${MOBILE:-1}" = 0 ] || echo 8081); do
  pid=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)
  if [ -n "$pid" ]; then
    printf '\033[31mPort %s is already in use by PID %s (%s).\033[0m\n' "$port" "$pid" "$(ps -o command= -p "$pid" | cut -c1-70)"
    echo "Stop it (Ctrl+C in its terminal, or kill $pid), then run make start again."
    exit 1
  fi
done

mkdir -p .logs
: > .logs/servers.log
npx --no-install concurrently -k -n API,WEB -c blue,magenta \
  "npm run start:dev --workspace=apps/api" \
  "npm run dev --workspace=apps/web" >> .logs/servers.log 2>&1 &
SERVERS=$!
# Whatever happens next (Ctrl+C, an error, Expo quitting): stop the servers.
trap 'kill $SERVERS 2>/dev/null || true; wait $SERVERS 2>/dev/null || true' EXIT

printf 'Starting the API and the web app'
for _ in $(seq 1 90); do
  curl -sf -o /dev/null http://localhost:3000/health && curl -sf -o /dev/null http://localhost:5173 && break
  kill -0 $SERVERS 2>/dev/null || break
  printf '.'
  sleep 1
done
echo
if ! curl -sf -o /dev/null http://localhost:3000/health; then
  echo "The API didn't start. Last lines of .logs/servers.log:"
  tail -30 .logs/servers.log
  exit 1
fi

LAN_IP=$( (ipconfig getifaddr en0 || ipconfig getifaddr en1 || hostname -I | awk '{print $1}') 2>/dev/null || true)
# (macOS ships bash 3.2: no ${var:-…} with quotes inside a heredoc)
PHONE_API="http://${LAN_IP}:3000"
[ -n "$LAN_IP" ] || PHONE_API="http://<this laptop's Wi-Fi IP>:3000"
cat <<INFO

  ┌──────────────────────────────────────────────────────────────
  │  HOLY is running
  │  Web app        http://localhost:5173
  │  API docs       http://localhost:3000/api-docs
  │  Emails (codes) http://localhost:8025
  │  Phone (Expo Go, same Wi-Fi): Server settings → ${PHONE_API}
  │  Server logs    make logs   (in another terminal)
  │  Stop           Ctrl+C
  └──────────────────────────────────────────────────────────────

INFO

if [ "${MOBILE:-1}" = 0 ]; then
  wait $SERVERS
else
  # Foreground: Expo needs the real terminal for its QR code and keys.
  npm run start --workspace=apps/mobile
fi
