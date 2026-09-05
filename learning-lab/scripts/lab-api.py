#!/usr/bin/env python3
"""Local, read-only bridge for the learning cluster.

This service is intentionally tiny and allowlisted. It is not a production API
and never accepts arbitrary shell commands or Kubernetes write operations.
"""

from __future__ import annotations

import argparse
import json
import subprocess
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer
from urllib.parse import parse_qs, urlsplit

CONTEXT = "kind-k8s-lab"
NAMESPACE = "learning"
ALLOWED = {
    "nodes": ["get", "nodes", "-o", "json"],
    "resources": ["-n", NAMESPACE, "get", "deploy,pods,svc", "-o", "json"],
    "events": ["-n", NAMESPACE, "get", "events", "--sort-by=.lastTimestamp", "-o", "json"],
    "logs": ["-n", NAMESPACE, "logs", "deployment/hello-web", "--tail=20"],
}


def kubectl(args: list[str]) -> tuple[int, str]:
    process = subprocess.run(
        ["kubectl", "--context", CONTEXT, *args],
        capture_output=True,
        text=True,
        encoding="utf-8",
        errors="replace",
        timeout=15,
        check=False,
    )
    return process.returncode, (process.stdout or process.stderr).strip()


def cluster_error(output: str) -> tuple[str, str]:
    detail = output.lower()
    if "context" in detail and ("does not exist" in detail or "not found" in detail):
        return "context_missing", "Create the k8s-lab cluster to restore context kind-k8s-lab."
    if "forbidden" in detail or "unauthorized" in detail:
        return "access_denied", "Check read access for context kind-k8s-lab in your kubeconfig."
    if "notfound" in detail or "not found" in detail:
        return (
            "resource_missing",
            "Start the learning lab and check namespace learning and hello-web.",
        )
    return "cluster_unavailable", "Start Docker and the k8s-lab cluster, then retry the live query."


class Handler(BaseHTTPRequestHandler):
    def _send(self, payload: dict[str, object], status: int = 200) -> None:
        body = json.dumps(payload, ensure_ascii=False).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json; charset=utf-8")
        self.send_header("Content-Length", str(len(body)))
        self.send_header("Cache-Control", "no-store")
        self.end_headers()
        self.wfile.write(body)

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        parsed = urlsplit(self.path)
        if parsed.path not in {"/", "/health"}:
            self._error("path_not_allowed", "Use /health or /?query=resources.", 404)
            return
        query = parse_qs(parsed.query, keep_blank_values=True)
        if parsed.path == "/health":
            if parsed.query:
                self._error(
                    "query_not_allowed", "The health endpoint accepts no query options.", 400
                )
            else:
                self._send({"ok": True, "service": "learning-lab-bridge"})
            return
        key = query.get("query", ["resources"])[0]
        if (
            set(query) - {"query"}
            or len(query.get("query", [])) > 1
            or key not in {*ALLOWED, "context"}
        ):
            self._error(
                "query_not_allowed", "Choose resources, events, nodes, logs, or context.", 400
            )
            return
        if key == "context":
            self._send({"ok": True, "query": key, "output": CONTEXT})
            return
        try:
            returncode, output = kubectl(ALLOWED[key])
        except FileNotFoundError:
            self._error("kubectl_missing", "Install kubectl and restart the read-only bridge.")
            return
        except subprocess.TimeoutExpired:
            self._error("cluster_timeout", "The cluster took too long. Check Docker and retry.")
            return
        except OSError:
            self._error(
                "kubectl_unavailable", "Check that kubectl can run, then restart the bridge."
            )
            return
        if returncode:
            self._error(*cluster_error(output))
            return
        if key in {"resources", "events", "nodes"}:
            try:
                data = json.loads(output)
                if not isinstance(data, dict) or not isinstance(data.get("items"), list):
                    raise ValueError("Expected a Kubernetes list")
            except (ValueError, TypeError):
                self._error("invalid_output", "kubectl returned invalid JSON. Check its version.")
                return
        self._send({"query": key, "ok": True, "output": output})

    def _error(self, code: str, message: str, status: int = 503) -> None:
        self._send({"ok": False, "error": code, "message": message}, status)

    def _reject_method(self) -> None:
        self._error("method_not_allowed", "This read-only bridge accepts GET requests only.", 405)

    do_POST = do_PUT = do_PATCH = do_DELETE = do_OPTIONS = _reject_method

    def do_HEAD(self) -> None:  # noqa: N802
        self.send_response(405)
        self.send_header("Allow", "GET")
        self.end_headers()

    def log_message(self, format: str, *args: object) -> None:
        return


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--port", type=int, default=8787)
    options = parser.parse_args()
    if not 1 <= options.port <= 65535:
        parser.error("--port must be between 1 and 65535")
    server = ThreadingHTTPServer(("127.0.0.1", options.port), Handler)
    print(f"Lab API listening on http://127.0.0.1:{options.port} (read-only)", flush=True)
    server.serve_forever()
