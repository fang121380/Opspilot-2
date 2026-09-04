#!/usr/bin/env bash
set -euo pipefail

missing=0
for command_name in docker kind kubectl; do
  if command -v "$command_name" >/dev/null 2>&1; then
    version="$($command_name version --short 2>/dev/null || $command_name --version 2>/dev/null | head -1 || true)"
    printf 'OK   %-8s %s\n' "$command_name" "$version"
  else
    printf 'MISS %-8s install it before continuing\n' "$command_name"
    missing=1
  fi
done

if command -v docker >/dev/null 2>&1 && ! docker info >/dev/null 2>&1; then
  echo 'Docker daemon is not reachable. Start Docker Desktop and run this check again.' >&2
  missing=1
fi

if (( missing )); then
  exit 1
fi

echo 'Prerequisites ready / 环境已就绪'

