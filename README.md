# Opspilot 2

Opspilot 2 is a safety-first incident response service for Kubernetes workloads. It turns an operational alert into an evidence-backed diagnosis and a controlled remediation proposal. This repository is intentionally separate from the other project named `Opspilot 1`.

The repository is currently in the bootstrap milestone. Product scope, architecture, and the first demo scenario are documented in [`docs/`](docs/).

## Local development

```bash
make setup
make test
make lint
make run
```

The API health endpoint is available at `http://127.0.0.1:8000/health` and the OpenAPI UI at `http://127.0.0.1:8000/docs`.

## Project status

- [x] MVP scope and acceptance criteria
- [x] Architecture and demo scenario
- [ ] Alert intake and incident model
- [ ] Read-only Kubernetes, Prometheus, and log diagnostics
- [ ] Evidence-based agent analysis
- [ ] Approval-gated remediation
- [ ] Audit and OpenTelemetry instrumentation
- [ ] Kind failure drill

## Environment status

The local Python development environment is ready. The following user-local tools are installed under `/Users/andrew/.local/bin`: Go 1.27.0 and Helm 3.19.0. `kubectl` and `kind` binaries are present, but this Codex execution environment terminates those binaries with exit code 137; they still need to be verified in a normal Terminal session. Docker Desktop is required before starting the Kind integration environment and is not installed yet.
