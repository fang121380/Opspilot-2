from __future__ import annotations

import logging
import os
from http.server import BaseHTTPRequestHandler, HTTPServer

from prometheus_client import Counter, Histogram, generate_latest

logging.basicConfig(level=logging.INFO, format="%(levelname)s %(message)s")
logger = logging.getLogger("checkout")

REQUESTS = Counter(
    "http_requests_total",
    "HTTP requests handled by the checkout demo service.",
    ["service", "code", "path"],
)
LATENCY = Histogram(
    "http_request_duration_seconds",
    "HTTP request latency for the checkout demo service.",
    ["service", "path"],
)


class CheckoutHandler(BaseHTTPRequestHandler):
    service = "checkout"
    failure_mode = os.getenv("CHECKOUT_FAILURE_MODE", "none")

    def do_GET(self) -> None:  # noqa: N802 - BaseHTTPRequestHandler API
        with LATENCY.labels(self.service, self.path).time():
            if self.path == "/metrics":
                body = generate_latest()
                self.send_response(200)
                self.send_header("Content-Type", "text/plain; version=0.0.4")
                self.send_header("Content-Length", str(len(body)))
                self.end_headers()
                self.wfile.write(body)
                return

            if self.path == "/health":
                self._respond(200, b"ok")
                return

            if self.path == "/checkout" and self.failure_mode == "always":
                logger.error("checkout request failed: injected failure mode is active")
                self._respond(500, b"checkout unavailable")
                return

            self._respond(200, b"checkout ok")

    def log_message(self, format: str, *args: object) -> None:
        return

    def _respond(self, code: int, body: bytes) -> None:
        REQUESTS.labels(self.service, str(code), self.path).inc()
        self.send_response(code)
        self.send_header("Content-Type", "text/plain")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)


def main() -> None:
    server = HTTPServer(("0.0.0.0", int(os.getenv("PORT", "8080"))), CheckoutHandler)
    server.serve_forever()


if __name__ == "__main__":
    main()
