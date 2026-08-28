# ADR-0006: Use a Deterministic Investigation Orchestrator Before LLM Autonomy

## Status

Accepted

## Context

An LLM-based agent can choose tools in an unpredictable order and hide whether a failure came from data collection or reasoning. Opspilot 2 needs a baseline that is reproducible before adding model-driven summaries.

## Decision

The MVP investigation path uses a fixed sequence:

1. Read the named Deployment status.
2. List Pods using the service label.
3. Tail at most the adapter's bounded log output from the first Pod.
4. Query one explicitly constructed PromQL expression for the service's HTTP 5xx rate.
5. Run the evidence-gated analyzer.
6. Write diagnostic and analysis audit events.

Service and namespace values are escaped before they enter the PromQL label selector. A missing service or namespace fails before any external adapter is called.

## Consequences

Positive:

- The same evidence collection path can be replayed in tests and incident drills.
- Tool failures and reasoning failures have separate audit boundaries.
- An LLM can later summarize or rank the structured result without receiving mutation authority.

Trade-offs:

- The first path supports only one known incident class.
- Adaptive tool selection is deferred until evaluation data exists.

