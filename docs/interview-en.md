# Opspilot 2 Interview Guide

This page is the English counterpart of [面试讲解提纲](interview-zh.md).

## One-line introduction

Opspilot 2 is a safety-first Kubernetes incident response platform. It receives alerts, collects Kubernetes/metrics/log evidence, produces an explainable diagnosis, proposes a rollback, and requires human approval before any allowlisted mutation.

## Why build it

The difficult part of an AI operations project is not generating a fluent answer. It is ensuring that an agent sees bounded, structured, traceable evidence; keeping diagnosis separate from mutation; preventing duplicate incidents and approval replay; and preserving an audit timeline for every decision.

## Incident path

```text
Alertmanager -> authenticated webhook and fingerprint deduplication
             -> persisted Incident
             -> async Investigation Job with conditional state claims
             -> Deployment / Pod / logs / Prometheus evidence
             -> deterministic analysis
             -> Remediation Proposal -> Approval
             -> allowlisted AppsV1 rollback
             -> read-only verification -> Audit / Trace / Metrics
```

## Engineering decisions to explain

1. **Deterministic analysis first.** Rollback requires a non-zero HTTP 5xx signal and matching error-level Pod logs. Pod readiness is evidence, not proof of business health. An LLM may narrate the result but cannot call tools or authorize changes.
2. **No arbitrary shell.** Diagnostic adapters expose typed Deployment, Pod, bounded-log, and fixed PromQL operations. They do not expose `kubectl exec`, Secrets, or arbitrary commands.
3. **Approval prevents replay.** The server derives `approved_by` from an authenticated operator, checks action/namespace/resource/proposal/expiry, and atomically claims `awaiting_approval -> executing`. Executing, verifying, and terminal incidents cannot be reset by a new proposal.
4. **Kubernetes rollback uses current APIs.** Opspilot selects the previous ReplicaSet template and patches the Deployment through `AppsV1`; it does not rely on the removed `DeploymentRollback` API.
5. **Observability is part of correctness.** Audit events share correlation IDs and bounded Prometheus outcome labels; no incident ID or raw error text is used as a metric label.
6. **Separate monitoring and operator credentials.** Alertmanager can create incidents, while only the operator identity can approve or execute remediation.

## Quantitative status

- 120 unit and integration tests.
- 91.04% coverage with an 85% quality gate.
- Four offline evaluation cases, including three negative no-rollback cases.
- Three read-only MCP diagnostic tools.
- Kind validation covers Prometheus, Alertmanager, the API, minimal RBAC, and real investigation; the drill stops before human approval unless an operator explicitly continues it.

## Current limits

Investigation execution still runs in-process. Production should replace it with a worker queue providing leases, heartbeats, retries, timeout recovery, and idempotent side effects. Static Bearer credentials should be replaced with OIDC/JWT and fine-grained RBAC. A richer MCP gateway, OpenTelemetry Collector, multi-cluster support, and a web console are follow-on work, not hidden MVP requirements.
