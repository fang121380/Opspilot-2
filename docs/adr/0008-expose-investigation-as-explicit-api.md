# ADR-0008: Expose Investigation as an Explicit API Operation

中文摘要：告警接收与调查分为显式 API 操作，便于重试和处理部分失败。

## Status

Accepted

## Context

The alert webhook creates an incident, while the diagnostic adapters and analyzer perform a separate investigation. Hiding that second step inside the webhook would make retries, latency, and partial failures difficult to reason about.

## Decision

Opspilot 2 exposes `POST /incidents/{incident_id}/investigate` as an explicit operation. It loads a known incident, invokes the configured deterministic investigator, and returns the structured analysis. If the incident does not exist, the API returns 404. If runtime diagnostic dependencies are not configured, it returns 503 instead of fabricating a result.

## Consequences

Positive:

- Alert ingestion and investigation can be retried independently.
- Operators can inspect the incident before starting an expensive investigation.
- Integration tests can inject a fake investigator without a cluster or model.

Trade-offs:

- The default application factory does not yet construct real Kubernetes and Prometheus clients.
- A later job/queue layer is needed for long-running investigations.
