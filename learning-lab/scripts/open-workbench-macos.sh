#!/usr/bin/env bash
set -euo pipefail

# Desktop launcher for this repository's local learning workbench.
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
UI_DIR="$LAB_DIR/ui"
URL="http://127.0.0.1:5173/"
LOG_DIR="$LAB_DIR/.workbench-logs"
LOG_FILE="$LOG_DIR/ui.log"

# Finder and AppleScript do not inherit the interactive shell's Node.js PATH.
export PATH="$HOME/.node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"

if curl --silent --fail --max-time 1 "$URL" >/dev/null 2>&1; then
  open "$URL"
  exit 0
fi

NPM_BIN="$(command -v npm || true)"
if [[ -z "$NPM_BIN" ]]; then
  osascript -e 'display alert "无法启动工作台" message "没有找到 npm。请先安装 Node.js，然后再打开此图标。" as critical'
  exit 1
fi

mkdir -p "$LOG_DIR"
if [[ ! -d "$UI_DIR/node_modules" ]]; then
  "$NPM_BIN" install --prefix "$UI_DIR" >>"$LOG_FILE" 2>&1
fi

nohup "$NPM_BIN" run dev --prefix "$UI_DIR" -- --host 0.0.0.0 --port 5173 >>"$LOG_FILE" 2>&1 &

for _ in {1..30}; do
  if curl --silent --fail --max-time 1 "$URL" >/dev/null 2>&1; then
    open "$URL"
    exit 0
  fi
  sleep 1
done

osascript -e 'display alert "工作台启动失败" message "请查看 learning-lab/.workbench-logs/ui.log 获取详细信息。" as critical'
exit 1
