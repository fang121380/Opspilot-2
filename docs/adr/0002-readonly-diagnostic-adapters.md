# ADR-0002: Keep First-Phase Diagnostic Adapters Read Only

中文摘要：第一阶段诊断适配器只提供受限、类型化的只读能力。

## Status

Accepted

## Context

Opspilot 2 needs Kubernetes state, logs, and metrics to investigate incidents. A generic integration layer that can invoke arbitrary URLs, shell commands, or `kubectl` arguments would give an LLM too much authority and make the integration difficult to test safely.

## Decision

The MVP exposes small, typed diagnostic adapter methods. The initial Prometheus adapter supports only the instant-query endpoint and maps successful vector responses into typed metric samples. Network errors, non-success responses, malformed JSON, and unsupported result types are explicit failures.

Kubernetes and log adapters will follow the same shape: named read-only operations with bounded inputs and typed outputs. Mutations remain separate from diagnostic adapters and will later pass through policy and approval checks.

## Consequences

Positive:

- The agent cannot turn an observability query into an arbitrary HTTP request.
- Tests can validate requests and failure handling without a live observability stack.
- Evidence can be stored and cited as structured data.

Trade-offs:

- Supporting a new query type requires intentional adapter work.
- Prometheus range queries are deferred until the incident timeline needs them.
