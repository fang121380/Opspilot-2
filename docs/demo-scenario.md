# MVP Demo Scenario: Deployment Regression

中文版本：[演示场景](demo-scenario-zh.md)

## Setup

- A Kind cluster contains the `checkout` service in the `demo` namespace.
- Version `v1` is healthy.
- Prometheus scrapes the service and evaluates a high-5xx-rate alert.
- OpsPilot has read-only access to diagnostic resources and a narrowly scoped permission for deployment rollback.

## Fault injection

Deploy version `v2` with a deterministic application error. The service begins returning HTTP 500 responses and the alert transitions to firing.

## Expected workflow

1. Alertmanager sends the alert with its dedicated Bearer credential to `POST /webhooks/prometheus`.
2. OpsPilot creates incident `inc-<id>` and records the received timestamp.
3. The orchestrator queries deployment rollout status, pod conditions, recent events, error-rate metrics, and recent logs.
4. The analysis output states that `checkout v2` is the leading hypothesis and cites the HTTP 5xx signal and matching application error logs. Pod readiness remains healthy in this application-level failure scenario.
5. OpsPilot proposes `rollback_deployment(checkout, demo)` with a dry-run result.
6. The API exposes the proposal as `awaiting_approval`.
7. An operator approves the proposal. An expired or mismatched approval is rejected.
8. The executor performs the allowlisted rollback.
9. OpsPilot polls the error-rate signal and marks the incident resolved only after the verification condition is met.
10. The incident view exposes the timeline, evidence, tool calls, approval, execution result, and trace ID.

## Failure cases to demonstrate

- Kubernetes API unavailable: incident remains open with a typed diagnostic error.
- No matching deployment regression: agent reports insufficient evidence and proposes no mutation.
- Approval expired: executor refuses to run.
- Action outside the allowlist: policy engine refuses to create an executable request.
- Rollback does not improve the signal: incident remains unresolved and no second mutation is attempted automatically.
