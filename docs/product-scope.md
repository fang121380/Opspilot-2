# OpsPilot MVP Product Scope

## Product statement

OpsPilot is a safety-first incident response service for Kubernetes workloads. It turns an operational alert into an evidence-backed diagnosis and a controlled remediation proposal. Any mutating action requires explicit human approval and is limited to an allowlisted operation.

## Target users

- SREs and operations developers who investigate Kubernetes incidents.
- Platform engineers building internal automation for incident response.
- Engineers evaluating whether an AI agent is reliable enough to use around production systems.

## MVP problem

When a service starts returning errors after a deployment, an operator must correlate an alert with Kubernetes state, recent logs, and time-series metrics before deciding whether to roll back. This work is repetitive, time-sensitive, and easy to document poorly.

## MVP outcome

For one Kubernetes service and one incident class (high HTTP 5xx rate after deployment), OpsPilot must:

1. Receive a Prometheus-compatible alert webhook.
2. Create a normalized incident record with a stable ID.
3. Collect read-only evidence from Kubernetes, Prometheus, and the service logs.
4. Produce a structured diagnosis with cited evidence and confidence.
5. Propose a rollback as a dry-run action.
6. Require human approval before executing the rollback.
7. Verify the post-remediation signal and record the complete audit trail.

## In scope

- Single-cluster, single-namespace demo environment.
- One incident type for the first vertical slice.
- Read-only diagnostic tools.
- Allowlisted deployment rollback as the first mutating operation.
- Fake adapters for deterministic unit tests.
- A replaceable LLM provider interface; tests must not require a live model.
- Structured audit records and OpenTelemetry instrumentation.

## Explicitly out of scope for MVP

- Arbitrary shell commands or `kubectl exec`.
- Automatic production changes without approval.
- Multi-cluster orchestration.
- Secret retrieval or RBAC mutation.
- Fine-tuning, vector search, or a general-purpose knowledge base.
- A full web console. API, OpenAPI, and a small CLI are sufficient initially.
- GPU scheduling and model serving. Those belong in a later Operator project.

## MVP acceptance criteria

- `make test` passes without a Kubernetes cluster or external LLM.
- A local Kind demo can inject the target failure and complete the incident workflow.
- Every diagnosis lists the evidence used to produce it.
- Every mutating request is rejected unless it has a valid, unexpired approval.
- Every tool call and remediation attempt has a correlation ID and audit record.
- A new engineer can run the demo from the repository documentation.

