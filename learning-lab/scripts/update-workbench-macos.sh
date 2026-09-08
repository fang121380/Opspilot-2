#!/usr/bin/env bash
set -euo pipefail

if [[ $# -gt 1 ]] || [[ $# -eq 1 && "$1" != "--lan" ]]; then
  echo "Usage: update-workbench-macos.sh [--lan]" >&2
  exit 2
fi
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
LAB_DIR="$(cd "$SCRIPT_DIR/.." && pwd)"
UI_DIR="$LAB_DIR/ui"
export PATH="$HOME/.node/bin:/opt/homebrew/bin:/usr/local/bin:$PATH"
LOG_DIR="$LAB_DIR/.workbench-logs"
mkdir -p "$LOG_DIR"
exec > >(tee -a "$LOG_DIR/update.log") 2>&1
LOCK_DIR="$LOG_DIR/update.lock"
if ! mkdir "$LOCK_DIR" 2>/dev/null; then
  echo "已有更新任务，或上次更新被中断。请检查 $LOCK_DIR，不要同时更新。" >&2
  exit 1
fi
trap 'rmdir "$LOCK_DIR"' EXIT
trap 'echo "更新未完成，请查看上方错误。代码和本地修改均保留；可以重新运行。" >&2' ERR

PYTHON_BIN="$(command -v python3)"
NPM_BIN="$(command -v npm)"
NODE_BIN="$(command -v node)"
"$NODE_BIN" -e 'const [major,minor]=process.versions.node.split(".").map(Number); if(major<22 || (major===22 && minor<18)){console.error("Node.js 22.18+ is required");process.exit(1)}'

echo "1/4 检查并同步 GitHub 最新代码..."
"$PYTHON_BIN" "$SCRIPT_DIR/update-workbench.py"

# Inspect all listeners first. Never stop an unrelated process just to free a port.
PIDS=()
EXPECTED=()
for PORT in 5173 8787; do
  for PID in $(lsof -nP -t -iTCP:"$PORT" -sTCP:LISTEN || true); do
    PROCESS_COMMAND="$(ps -p "$PID" -o command=)"
    if [[ "$PORT" == 5173 ]]; then
      case "$PROCESS_COMMAND" in
        *"$UI_DIR/node_modules/.bin/vite "*|*"$UI_DIR/node_modules/vite/bin/vite.js "*) ;;
        *) echo "端口 $PORT 属于其他程序，更新已停止，不会关闭该程序。" >&2; exit 1 ;;
      esac
    else
      case "$PROCESS_COMMAND" in
        *"$SCRIPT_DIR/lab-api.py"*) ;;
        *) echo "端口 $PORT 属于其他程序，更新已停止，不会关闭该程序。" >&2; exit 1 ;;
      esac
    fi
    PIDS+=("$PID")
    EXPECTED+=("$PROCESS_COMMAND")
  done
done

echo "2/4 重启本项目的工作台服务..."
for ((INDEX=0; INDEX<${#PIDS[@]}; INDEX++)); do
  PID="${PIDS[$INDEX]}"
  if [[ "$(ps -p "$PID" -o command= || true)" == "${EXPECTED[$INDEX]}" ]]; then
    kill -TERM "$PID"
    for _ in {1..20}; do
      kill -0 "$PID" 2>/dev/null || break
      sleep .5
    done
    if kill -0 "$PID" 2>/dev/null; then
      echo "工作台进程没有正常退出，请检查后重试。" >&2
      exit 1
    fi
  fi
done

bounded() {
  "$PYTHON_BIN" -c 'import subprocess,sys; sys.exit(subprocess.run(sys.argv[2:],timeout=int(sys.argv[1])).returncode)' "$@"
}
echo "3/4 安装锁定依赖并验证前端（首次可能需要几分钟）..."
bounded 300 "$NPM_BIN" ci --prefix "$UI_DIR" --no-audit --no-fund
bounded 180 "$NPM_BIN" run build --prefix "$UI_DIR"

echo "4/4 启动最新版工作台..."
/bin/bash "$SCRIPT_DIR/open-workbench-macos.sh" "$@"
echo "更新完成：http://127.0.0.1:5173/"
