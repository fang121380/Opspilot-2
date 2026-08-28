# Opspilot 2

Opspilot 2 is a safety-first incident response service for Kubernetes workloads. It turns an operational alert into an evidence-backed diagnosis and a controlled remediation proposal. This repository is intentionally separate from the other project named `Opspilot 1`.

> This is a portfolio project built to demonstrate production-minded AI Agent, SRE, and cloud-native engineering. It does not claim autonomous production remediation.

## Safety model

```text
Alertmanager webhook
        |
        v
Normalized incident + fingerprint deduplication
        |
        v
Read-only evidence: Kubernetes + Prometheus + logs
        |
        v
Evidence-gated analysis and remediation proposal
        |
        v
Policy allowlist + exact, expiring human approval
        |
        v
Narrow executor + post-action verification (next milestone)
```

Design documents: [scope](docs/product-scope.md), [architecture](docs/architecture.md), [demo scenario](docs/demo-scenario.md), [Kind 故障演练](docs/kind-demo-zh.md), [中文学习指南](docs/learning-guide.md), [ADRs](docs/adr/), and [open-source design research](docs/research/open-source-landscape.md).

## Local development

```bash
make setup
make test
make coverage
make lint
make run
```

The API health endpoint is available at `http://127.0.0.1:8000/health` and the OpenAPI UI at `http://127.0.0.1:8000/docs`.

## Project status

- [x] MVP scope and acceptance criteria
- [x] Architecture and demo scenario
- [x] Alert intake and incident model
- [x] Read-only Kubernetes and Prometheus diagnostics
- [x] Evidence-based deployment-regression analysis
- [x] Deterministic incident investigation orchestrator
- [x] Approval-gated remediation policy and executor boundary
- [x] Audit and OpenTelemetry instrumentation
- [x] Kind failure drill assets (runtime verification pending Docker)

## Current capabilities

- Prometheus-compatible alert webhook with active-alert fingerprint deduplication.
- Typed, bounded Prometheus instant queries and Kubernetes deployment/Pod/log diagnostics.
- Deterministic regression analysis requiring converging deployment, HTTP 5xx, and log evidence.
- Explicit rollback proposal with action and namespace allowlists.
- Matching, expiring human approval required before the rollback client can be invoked.
- Replaceable OpenAI-compatible text provider; model output is narration only and has no tool or mutation authority.
- Reproducible Kind manifests and a deterministic `checkout` failure injector are included; execution waits for Docker Desktop.

## Environment status

The local Python development environment is ready. The following user-local tools are installed under `/Users/andrew/.local/bin`: Go 1.27.0 and Helm 3.19.0. `kubectl` and `kind` binaries are present, but this Codex execution environment terminates those binaries with exit code 137; they still need to be verified in a normal Terminal session. Docker Desktop is required before starting the Kind integration environment and is not installed yet.
