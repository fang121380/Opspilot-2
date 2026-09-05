#!/usr/bin/env bash
set -euo pipefail

UI_HOST="127.0.0.1"
if [[ $# -gt 1 ]] || [[ $# -eq 1 && "$1" != "--lan" ]]; then
  echo "Usage: open-workbench-macos.sh [--lan]" >&2
  exit 2
fi
if [[ $# -eq 1 ]]; then UI_HOST="0.0.0.0"; fi

# Desktop launcher for this repository's local learning workbench.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
UI_DIR="$LAB_DIR/ui"
URL="http://127.0.0.1:5173/"
API_URL="http://127.0.0.1:8787/health"
PROXY_URL="http://127.0.0.1:5173/lab-api/health"
LOG_DIR="$LAB_DIR/.workbench-logs"
LOG_FILE="$LOG_DIR/ui.log"
API_LOG_FILE="$LOG_DIR/lab-api.log"

# Finder and AppleScript do not inherit the interactive shell's Node.js PATH.
export PATH="$HOME/.node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

mkdir -p "$LOG_DIR"

fail() {
  echo "$1 See $LOG_DIR." >&2
  osascript -e 'display alert "Workbench could not start" message "Check learning-lab/.workbench-logs and restart from this checkout." as critical'
  exit 1
}

PYTHON_BIN="$(command -v python3 || true)"
[[ -n "$PYTHON_BIN" ]] || fail "Install Python 3.12+ before opening the workbench."

bridge_ready() {
  curl --silent --fail --max-time 2 "$1" 2>/dev/null |
    "$PYTHON_BIN" -c 'import json,sys; d=json.load(sys.stdin); sys.exit(not (d.get("ok") is True and d.get("service")=="learning-lab-bridge"))' 2>/dev/null
}

ui_ready() {
  curl --silent --fail --max-time 2 "$URL" 2>/dev/null | grep -qi "Opspilot" &&
    bridge_ready "$PROXY_URL"
}

open_workbench() {
  if [[ "$UI_HOST" == "0.0.0.0" ]]; then
    lsof -nP -iTCP:5173 -sTCP:LISTEN -Fn | grep -q '^n\*:5173$' ||
      fail "The existing UI is local-only. Stop it and rerun with --lan."
    echo "Android: use the same trusted Wi-Fi and open http://<Mac-Wi-Fi-IPv4>:5173."
    echo "LAN clients can read lab resources and logs. Keep API ports 8787 and 8000 local."
  fi
  open "$URL"
}

if ! bridge_ready "$API_URL"; then
  nohup "$PYTHON_BIN" "$LAB_DIR/scripts/lab-api.py" >>"$API_LOG_FILE" 2>&1 &
  API_PID=$!
  API_READY=0
  for _ in {1..20}; do
    kill -0 "$API_PID" 2>/dev/null || fail "The read-only bridge exited. Port 8787 may be occupied."
    if bridge_ready "$API_URL"; then API_READY=1; break; fi
    sleep 1
  done
  [[ "$API_READY" == 1 ]] || fail "The read-only bridge did not become ready."
fi

if curl --silent --fail --max-time 1 "$URL" >/dev/null 2>&1; then
  ui_ready || fail "Port 5173 is occupied by a UI without a working workbench proxy."
  open_workbench
  exit 0
fi

NPM_BIN="$(command -v npm || true)"
if [[ -z "$NPM_BIN" ]]; then
  fail "Install Node.js 22.18+ with npm before opening the workbench."
fi

if [[ ! -d "$UI_DIR/node_modules" ]]; then
  if [[ -f "$UI_DIR/package-lock.json" ]]; then
    "$NPM_BIN" ci --prefix "$UI_DIR" >>"$LOG_FILE" 2>&1
  else
    "$NPM_BIN" install --prefix "$UI_DIR" >>"$LOG_FILE" 2>&1
  fi
fi

nohup "$NPM_BIN" run dev --prefix "$UI_DIR" -- --host "$UI_HOST" --port 5173 --strictPort >>"$LOG_FILE" 2>&1 &
UI_PID=$!

for _ in {1..30}; do
  kill -0 "$UI_PID" 2>/dev/null || fail "The UI exited. Port 5173 may be occupied."
  if ui_ready; then
    open_workbench
    exit 0
  fi
  sleep 1
done

fail "The UI or its API proxy did not become ready."
