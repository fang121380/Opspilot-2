#!/usr/bin/env python3
"""Local, read-only bridge for the learning cluster.

This service is intentionally tiny and allowlisted. It is not a production API
and never accepts arbitrary shell commands or Kubernetes write operations.
"""

from __future__ import annotations

import json
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlparse

CONTEXT = "kind-k8s-lab"
NAMESPACE = "learning"
ALLOWED = {
    "context": ["config", "current-context"],
    "nodes": ["get", "nodes", "-o", "wide"],
    "resources": ["-n", NAMESPACE, "get", "deploy,pods,svc", "-o", "wide"],
    "events": ["-n", NAMESPACE, "get", "events", "--sort-by=.lastTimestamp"],
}


def kubectl(args: list[str]) -> tuple[int, str]:
    process = subprocess.run(
        ["kubectl", "--context", CONTEXT, *args],
        capture_output=True,
        text=True,
        timeout=15,
        check=False,
    )
    return process.returncode, (process.stdout or process.stderr).strip()


class Handler(BaseHTTPRequestHandler):
    def _send(self, payload: dict[str, object], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Access-Control-Allow-Origin", "http://127.0.0.1:5173")
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        query = parse_qs(urlparse(self.path).query)
        key = query.get("query", ["resources"])[0]
        args = ALLOWED.get(key)
        if args is None:
            self._send({"error": "query_not_allowed", "allowed": sorted(ALLOWED)}, 400)
            return
        try:
            returncode, output = kubectl(args)
        except (OSError, subprocess.TimeoutExpired) as error:
            self._send({"error": type(error).__name__}, 503)
            return
        status = 200 if returncode == 0 else 503
        self._send({"query": key, "ok": returncode == 0, "output": output}, status)

    def log_message(self, format: str, *args: object) -> None:
        return


if __name__ == "__main__":
    server = ThreadingHTTPServer(("127.0.0.1", 8787), Handler)
    print("Lab API listening on http://127.0.0.1:8787 (read-only)")
    server.serve_forever()
