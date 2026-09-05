"""Exercise the real HTTP boundary without contacting a Kubernetes cluster."""

import importlib.util
import json
import subprocess
import threading
from http.client import HTTPConnection
from http.server import ThreadingHTTPServer
from pathlib import Path

import pytest

ROOT = Path(__file__).resolve().parents[1]
spec = importlib.util.spec_from_file_location("lab_api", ROOT / "learning-lab/scripts/lab-api.py")
lab_api = importlib.util.module_from_spec(spec)
spec.loader.exec_module(lab_api)


@pytest.fixture
def bridge(monkeypatch):
    calls = []

    def run(command, **options):
        calls.append((command, options))
        output = '{"apiVersion":"v1","kind":"List","items":[]}'
        if "logs" in command:
            output = "hello-web started\nGET / 200"
        return subprocess.CompletedProcess(command, 0, output, "")

    monkeypatch.setattr(lab_api.subprocess, "run", run)
    server = ThreadingHTTPServer(("127.0.0.1", 0), lab_api.Handler)
    thread = threading.Thread(target=server.serve_forever, daemon=True)
    thread.start()

    def request(path, method="GET"):
        connection = HTTPConnection(*server.server_address, timeout=3)
        connection.request(method, path)
        response = connection.getresponse()
        body = response.read()
        connection.close()
        return response.status, json.loads(body) if body else None

    yield request, calls
    server.shutdown()
    server.server_close()
    thread.join()


def test_health_is_bridge_liveness_without_kubectl(bridge):
    request, calls = bridge
    status, body = request("/health")
    assert status == 200
    assert body == {"ok": True, "service": "learning-lab-bridge"}
    assert calls == []


def test_context_reports_fixed_target_without_reading_user_default(bridge):
    request, calls = bridge
    assert request("/?query=context") == (
        200,
        {"ok": True, "query": "context", "output": "kind-k8s-lab"},
    )
    assert calls == []


@pytest.mark.parametrize("query", ["resources", "events", "nodes"])
def test_structured_queries_use_json_and_explicit_context(bridge, query):
    request, calls = bridge
    status, body = request(f"/?query={query}")
    assert status == 200 and body["ok"] is True
    assert json.loads(body["output"])["items"] == []
    command, options = calls[0]
    assert command[:3] == ["kubectl", "--context", "kind-k8s-lab"]
    assert command[-2:] == ["-o", "json"]
    assert options.get("shell", False) is False
    assert options["timeout"] == 15


def test_logs_remain_text_with_bounded_fixed_target(bridge):
    request, calls = bridge
    status, body = request("/?query=logs")
    assert status == 200
    assert body["output"] == "hello-web started\nGET / 200"
    assert calls[0][0] == [
        "kubectl",
        "--context",
        "kind-k8s-lab",
        "-n",
        "learning",
        "logs",
        "deployment/hello-web",
        "--tail=20",
    ]


@pytest.mark.parametrize(
    "path",
    [
        "/write?query=resources",
        "/?query=delete",
        "/?query=logs&namespace=default",
        "/?query=logs&query=nodes",
        "/?query=",
        "/?command=get",
        "/health?query=nodes",
    ],
)
def test_unlisted_paths_and_options_never_invoke_kubectl(bridge, path):
    request, calls = bridge
    status, body = request(path)
    assert status in (400, 404)
    assert body["ok"] is False
    assert body["error"] and body["message"]
    assert calls == []


@pytest.mark.parametrize("method", ["POST", "PUT", "PATCH", "DELETE", "OPTIONS"])
def test_writes_and_preflight_are_rejected(bridge, method):
    request, calls = bridge
    status, body = request("/?query=resources", method)
    assert status == 405
    assert body["error"] == "method_not_allowed"
    assert calls == []


@pytest.mark.parametrize(
    ("failure", "code"),
    [
        (FileNotFoundError("private machine path"), "kubectl_missing"),
        (subprocess.TimeoutExpired("kubectl", 15), "cluster_timeout"),
        (OSError("private OS details"), "kubectl_unavailable"),
    ],
)
def test_execution_errors_are_typed_actionable_and_sanitized(bridge, monkeypatch, failure, code):
    def fail(*args, **kwargs):
        raise failure

    monkeypatch.setattr(lab_api.subprocess, "run", fail)
    status, body = bridge[0]("/?query=resources")
    assert status == 503
    assert body["ok"] is False and body["error"] == code
    assert len(body["message"]) > 30
    assert "private" not in json.dumps(body)


@pytest.mark.parametrize(
    ("stderr", "code"),
    [
        ('error: context "kind-k8s-lab" does not exist', "context_missing"),
        ('Error from server (NotFound): namespaces "learning" not found', "resource_missing"),
        ("Error from server (Forbidden): private user token", "access_denied"),
        ("Unable to connect to the server: private endpoint", "cluster_unavailable"),
    ],
)
def test_failed_kubectl_does_not_expose_raw_stderr(bridge, monkeypatch, stderr, code):
    monkeypatch.setattr(
        lab_api.subprocess,
        "run",
        lambda command, **kwargs: subprocess.CompletedProcess(command, 1, "", stderr),
    )
    status, body = bridge[0]("/?query=resources")
    assert status == 503
    assert body["error"] == code and body["message"]
    assert "private" not in json.dumps(body)


def test_invalid_kubectl_json_is_reported_as_invalid_output(bridge, monkeypatch):
    monkeypatch.setattr(
        lab_api.subprocess,
        "run",
        lambda command, **kwargs: subprocess.CompletedProcess(command, 0, "not JSON", ""),
    )
    status, body = bridge[0]("/?query=nodes")
    assert status == 503
    assert body["error"] == "invalid_output"
