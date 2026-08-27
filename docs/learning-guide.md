# Opspilot 2 Learning Guide

This guide explains the project in the order an interviewer or contributor should read it.

## 1. Start with the incident boundary

Read [product-scope.md](product-scope.md) and [ADR-0001](adr/0001-mvp-boundary.md). The MVP deliberately focuses on one scenario: a deployment regression that causes a high HTTP 5xx alert.

Why this matters: a portfolio project is stronger when it finishes one production-shaped workflow than when it lists many integrations without a demonstrated safety boundary.

## 2. Follow an alert into an incident

Read `app/api/prometheus.py` and `app/domain/incidents.py`.

- `AlertmanagerWebhook` accepts a Prometheus Alertmanager-compatible payload.
- The API normalizes provider-specific JSON into `Incident` immediately.
- Alert fingerprints deduplicate active incidents.

The key interview concept is **idempotency**: monitoring systems resend alerts, so a receiver must not create an unbounded number of identical incidents.

## 3. Inspect the read-only adapters

Read `app/adapters/prometheus.py` and `app/adapters/kubernetes.py`.

- Prometheus supports only `GET /api/v1/query` and converts vectors into typed samples.
- Kubernetes diagnostics read deployment status, pod summaries, and bounded log tails.
- No adapter takes a shell command, accesses Secrets, or mutates cluster state.

The key concept is **capability design**: an agent should receive only the smallest API surface needed for its job.

## 4. Understand evidence-gated analysis

Read `app/agent/analysis.py` and [ADR-0003](adr/0003-evidence-gated-remediation.md).

The initial analyzer is deterministic. It suggests a rollback only when deployment availability is reduced, HTTP 5xx is non-zero, and logs contain an error signal. This creates a baseline that is straightforward to test before using an LLM.

The key concept is **grounded reasoning**: a model can later explain evidence, but must not invent the evidence or authorise a mutation.

## 5. Trace the approval gate

Read `app/policy/remediation.py` and [ADR-0004](adr/0004-approval-gated-execution.md).

An operation reaches the rollback client only if it is allowlisted, targets a permitted namespace, has a matching approval, and that approval has not expired.

The key concept is **defence in depth**: approval alone is insufficient; policy scope, proposal binding, and expiry prevent common replay and overreach failures.

## 6. Run the checks

```bash
make test
make coverage
make lint
```

The unit tests are intentionally offline. They prove domain, policy, and adapter behavior before a cluster or LLM API is introduced. The Kind drill and integration environment are later milestones.

