# OpsPilot

OpsPilot is a safety-first incident response service for Kubernetes workloads. It turns an operational alert into an evidence-backed diagnosis and a controlled remediation proposal.

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

