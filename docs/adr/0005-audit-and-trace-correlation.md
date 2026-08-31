# ADR-0005: Correlate Audit Events with OpenTelemetry Trace IDs

中文摘要：审计事件保存关联 ID，便于从事故时间线追溯到 Trace。

## Status

Accepted

## Context

Incident response is asynchronous and crosses HTTP handlers, diagnostic adapters, agent steps, and remediation execution. A database audit row without a correlation field is difficult to connect to the corresponding request and tool spans.

## Decision

Each audit event stores a `trace_id`. When an OpenTelemetry SDK is configured, this is the active span's 128-bit trace ID. In a local process without an SDK or Collector, Opspilot 2 generates a unique 32-character correlation ID so events remain distinguishable without pretending they were exported to a tracing backend.

The audit repository returns deep copies of payloads and events. Callers cannot mutate historical records by retaining a reference to an input dictionary or returned model.

## Consequences

Positive:

- Operators can move from an incident timeline to its trace and back.
- Local tests remain deterministic about shape without requiring a collector.
- The same correlation contract works when storage changes from memory to PostgreSQL.

Trade-offs:

- A local fallback ID is not a distributed trace and must not be presented as one in production dashboards.
- Export configuration and sampling policy are deferred to the deployment milestone.
