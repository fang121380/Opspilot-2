# ADR-0003: Gate Remediation on Converging Evidence

中文摘要：只有多来源证据收敛时，系统才提出修复建议。

## Status

Accepted

## Context

An alert alone is not sufficient to justify a production mutation. A model can produce plausible narratives from weak signals, especially when logs and telemetry contain noisy or adversarial content.

## Decision

The first rollout-regression analyzer is deterministic. It recommends rollback only when all of these are present:

1. Deployment availability is below the desired replica count.
2. The queried HTTP 5xx value is greater than zero.
3. Recent logs contain an error-level signal.

The analysis result is structured, includes evidence references, and marks every remediation recommendation as requiring approval. A future LLM layer may transform this structured output into an operator-facing explanation but cannot create an executable action directly.

## Consequences

Positive:

- The safety boundary is testable without an LLM API.
- Operators can see why a recommendation was made.
- Later model evaluations can distinguish evidence collection failures from reasoning failures.

Trade-offs:

- This first rule can miss valid incidents where one telemetry source is unavailable.
- Additional incident classes require new explicit rules or a carefully evaluated policy change.
