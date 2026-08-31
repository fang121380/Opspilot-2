# Opspilot 2 Learning Guide

This page is the English counterpart of [中文学习指南](learning-guide.md). Read the sections in order; each one maps to an engineering concept and runnable tests.

## 1. Start with the incident boundary

Read [Product scope](product-scope.md) and [ADR-0001](adr/0001-mvp-boundary.md). The MVP handles one complete scenario: a bad Deployment release that causes an HTTP 5xx alert. A narrow, tested workflow makes the safety model inspectable.

## 2. Follow an alert into an incident

Read `app/api/prometheus.py` and `app/domain/incidents.py`. The webhook validates a separate Alertmanager Bearer credential, normalizes vendor JSON into an `Incident`, validates bounded Kubernetes labels, and deduplicates active alerts by fingerprint. Resolved or closed incidents release the fingerprint so a later occurrence gets a new timeline. See [ADR-0017](adr/0017-authenticate-alertmanager-webhooks.md).

## 3. Inspect the read-only adapters

Read `app/adapters/prometheus.py` and `app/adapters/kubernetes.py`. The adapters expose typed Deployment, Pod, bounded-log, and fixed PromQL operations. They do not expose arbitrary shell commands, `kubectl exec`, Secret reads, or cluster mutations.

## 4. Understand evidence-gated analysis

Read `app/agent/analysis.py` and [ADR-0003](adr/0003-evidence-gated-remediation.md). The deterministic analyzer recommends rollback only when both a non-zero HTTP 5xx signal and matching error-level Pod logs are present. Pod readiness is useful evidence but is not proof of business health. An LLM may narrate evidence; it cannot invent evidence or authorize a change.

## 5. Trace the approval boundary

Read `app/policy/remediation.py` and [ADR-0004](adr/0004-approval-gated-execution.md). A mutation must pass the action allowlist, namespace scope, exact proposal match, authenticated operator identity, and expiry checks. The server derives `approved_by`; clients cannot forge it. The executor atomically claims `awaiting_approval -> executing`, so concurrent replicas cannot perform the same rollback. See [ADR-0016](adr/0016-authenticate-privileged-operator-actions.md).

Kubernetes write failures conservatively leave an incident in `executing`, because the API cannot know whether the cluster partially accepted a request. Operators must inspect the Deployment and audit timeline before deciding what to do next.

## 6. Read the audit and trace timeline

Read `app/storage/audit.py`, `app/observability/tracing.py`, and `app/api/prometheus.py`. Alert receipt, diagnostics, analysis, proposals, approvals, execution, and verification create structured events with correlation IDs. Prometheus labels are bounded outcome enums; incident IDs and raw error text are never metric labels.

## 7. Run the offline evaluation

Read `evals/incidents.json`, `scripts/run-evals.py`, and [Evaluation baseline](evaluation-en.md):

```bash
make eval
```

The four fixed cases include one rollback-positive scenario and three negative cases. The safety property is that missing evidence must not produce a rollback recommendation.

## 8. Understand the investigation orchestrator

Read `app/agent/orchestrator.py` and [ADR-0006](adr/0006-deterministic-investigation-orchestrator.md). The orchestrator reads Deployment, Pod, logs, and HTTP 5xx metrics in a fixed order, then records both diagnostic and analysis events. Dependency failures return a sanitized HTTP 503 and conditionally return the incident from `investigating` to `received`; a later workflow that already claimed the incident is never overwritten.

## 9. Understand asynchronous investigation Jobs

Read `app/agent/jobs.py`, `app/api/jobs.py`, and [ADR-0013](adr/0013-async-investigation-jobs.md). A Job atomically claims `received -> investigating`, advances to `awaiting_approval` when it has a recommendation, and returns to `received` when evidence is insufficient or investigation fails. A state-conflicted Job fails with `StateConflict` without calling the investigator. SQL snapshots and the unique `active_incident_id` constraint make retries idempotent across API replicas.

Jobs still execute as in-process `asyncio` tasks. After a confirmed process interruption, stop all API/worker processes and inspect candidates with the default dry-run recovery command:

```bash
make recover-jobs
```

Only after explicit maintenance confirmation should an operator run `python -m app.job_recovery --confirm`; it marks active snapshots as `ProcessRestarted` and conditionally releases the incident. It never retries diagnostics or calls Kubernetes. See [ADR-0021](adr/0021-guard-investigation-state-transitions.md) and [ADR-0022](adr/0022-explicit-interrupted-job-recovery.md).

## 10. Understand deployment boundaries

Read `Dockerfile`, `docker-compose.yml`, and [Deployment guide](deployment-en.md). Compose runs PostgreSQL migrations before the API and fails closed on unknown schemas. Kind uses `/health` for liveness and `/ready` for dependency-aware readiness. Compose intentionally omits Kubernetes credentials, so investigation returns `503` instead of fabricated data.

## 11. Run all checks

```bash
make test
make coverage
make lint
make eval
make demo
```

Unit tests do not require a cluster or online LLM. The Kind drill covers Prometheus, Alertmanager, the in-cluster API, minimal RBAC, and real read-only investigation. A production OpenTelemetry Collector and distributed worker queue remain future work.

## 12. Understand the read-only MCP layer

Read `app/mcp_server.py` and [ADR-0011](adr/0011-readonly-mcp-diagnostic-server.md). MCP exposes only three typed diagnostic tools: Deployment status, service Pod summaries, and a fixed HTTP 5xx query. It has no rollback, restart, shell, Secret, or arbitrary PromQL tool. A standard protocol does not imply unlimited permissions.
