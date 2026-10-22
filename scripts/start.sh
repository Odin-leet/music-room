#!/usr/bin/env bash
# `make start`: everything with one command.
#   1. setup.sh (tools, .env files, packages, database, migrations)
#   2. the API and the web app in the background (logs: .logs/servers.log)
#   3. Expo in the foreground, with its QR code and keys (a: Android, r: reload)
#      in TUNNEL mode by default: a phone on any network can load the app
# Ctrl+C stops all of it.
#   MOBILE=0 make start      no Expo (API + web only)         = make start-web
#   EXPO_TUNNEL=0 make start  Expo on the Wi-Fi only (LAN)     = make start-lan
# The phone also needs to reach the API: with NGROK_DOMAIN (+ NGROK_AUTHTOKEN)
# in .env the API opens a public HTTPS address and the app is given it;
# without, the app uses http://<this laptop's Wi-Fi IP>:3000.
set -euo pipefail
cd "$(dirname "$0")/.."

./scripts/setup.sh
echo

# Ports must be free: say who holds one rather than killing anything.
# Checked with Node (always there), since lsof is often missing on Linux.
busy() {
  node -e '
    const net = require("node:net");
    const port = Number(process.argv[1]);
    const tryHost = (host) => new Promise((ok) => {
      const s = net.connect({ port, host }, () => { s.destroy(); ok(true); });
      s.on("error", () => ok(false));
    });
    Promise.all([tryHost("127.0.0.1"), tryHost("::1")]).then((r) => process.exit(r.includes(true) ? 0 : 1));
  ' "$1"
}
for port in 3000 5173 $([ "${MOBILE:-1}" = 0 ] || echo 8081); do
  if busy "$port"; then
    printf '\033[31mPort %s is already in use.\033[0m\n' "$port"
    if command -v lsof >/dev/null; then
      pid=$(lsof -nP -iTCP:"$port" -sTCP:LISTEN -t 2>/dev/null | head -1 || true)
      [ -z "$pid" ] || echo "By PID $pid: $(ps -o command= -p "$pid" | cut -c1-70)"
    else
      echo "See who holds it: ss -ltnp | grep :$port"
    fi
    echo "Stop it (Ctrl+C in its terminal), then run make start again."
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
NGROK_DOMAIN=$(grep -E '^NGROK_DOMAIN=' .env | tail -1 | cut -d= -f2- | tr -d '"[:space:]' || true)
TUNNEL=${EXPO_TUNNEL:-1}

# Where the phone reaches the API.
# (macOS ships bash 3.2: no ${var:-…} with quotes inside a heredoc)
PHONE_API="http://${LAN_IP}:3000"
[ -n "$LAN_IP" ] || PHONE_API="http://<this laptop's Wi-Fi IP>:3000"
API_NOTE="same Wi-Fi as this laptop only"
if [ -n "$NGROK_DOMAIN" ]; then
  # The API opens it right after starting (main.ts): wait for it to answer.
  printf 'Waiting for the API public address https://%s' "$NGROK_DOMAIN"
  for _ in $(seq 1 30); do
    curl -sf -o /dev/null "https://$NGROK_DOMAIN/health" && break
    printf '.'
    sleep 1
  done
  echo
  if curl -sf -o /dev/null "https://$NGROK_DOMAIN/health"; then
    PHONE_API="https://$NGROK_DOMAIN"
    API_NOTE="public: any network"
  else
    printf '\033[33m! The API tunnel https://%s does not answer (see make logs: ngrok token / domain?). Phones use the Wi-Fi address.\033[0m\n' "$NGROK_DOMAIN"
  fi
fi

APP_NOTE="Expo Go, scan the QR code (tunnel: any network)"
[ "$TUNNEL" = 1 ] || APP_NOTE="Expo Go, scan the QR code (same Wi-Fi only)"

cat <<INFO

  ┌──────────────────────────────────────────────────────────────
  │  HOLY is running
  │  Web app        http://localhost:5173
  │  API docs       http://localhost:3000/api-docs
  │  Emails (codes) http://localhost:8025
  │  Phone app      ${APP_NOTE}
  │  Phone → API    ${PHONE_API}   (${API_NOTE})
  │  Server logs    make logs   (in another terminal)
  │  Stop           Ctrl+C
  └──────────────────────────────────────────────────────────────

INFO
if [ "$TUNNEL" = 1 ] && [ "$API_NOTE" != "public: any network" ]; then
  echo "  Note: the app loads from anywhere through the tunnel, but the API is only on"
  echo "  this Wi-Fi. For phones on another network (4G, isolated school Wi-Fi), set"
  echo "  NGROK_DOMAIN and NGROK_AUTHTOKEN in .env (free at ngrok.com) — see docs/technical/01-running.md."
  echo
fi
echo "  If the app shows another server on its first screen: Server: … · change → ${PHONE_API}"
echo

if [ "${MOBILE:-1}" = 0 ]; then
  wait $SERVERS
  exit 0
fi

# Foreground: Expo needs the real terminal for its QR code and keys.
# EXPO_PUBLIC_API_URL from here wins over apps/mobile/.env (Expo doesn't
# overwrite variables that are already set).
expo() { EXPO_PUBLIC_API_URL="$PHONE_API" npm run start --workspace=apps/mobile -- "$@"; }

if [ "$TUNNEL" = 1 ]; then
  # Expo's tunnel goes through Expo's own ngrok account, shared by every Expo
  # user: it is sometimes full (ERR_NGROK_108) or down. An attempt that fails
  # within a minute is a tunnel that didn't open: try again, then fall back
  # to the Wi-Fi instead of stopping everything.
  for attempt in 1 2 3; do
    started=$(date +%s)
    expo --tunnel && exit 0
    code=$?
    [ $(( $(date +%s) - started )) -lt 60 ] || exit $code # it ran, then stopped: not a startup failure
    printf "\n\033[33m! Expo's tunnel did not open (attempt %s/3). Expo's shared tunnel service is sometimes full or down.\033[0m\n" "$attempt"
    [ "$attempt" = 3 ] || sleep 5
  done
  printf "\033[33m! Falling back to the Wi-Fi: the phone must be on the same network as this laptop (make start-lan does this directly).\033[0m\n\n"
fi
expo
