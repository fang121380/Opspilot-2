# ADR-0013: Represent Long Investigations as Jobs

## Status

Accepted

## Context

Kubernetes and observability calls can be slow or temporarily unavailable. Holding an HTTP request open for the whole investigation creates fragile retries and makes operator polling difficult.

## Decision

Expose an explicit job API:

- `POST /incidents/{incident_id}/investigate/jobs` enqueues an investigation and returns a job ID.
- `GET /investigation/jobs/{job_id}` returns queued, running, succeeded, or failed state.

The MVP uses an in-process task manager so behavior is testable without Redis. A production deployment can replace this manager with a durable queue without changing the API contract.

## Consequences

Positive:

- Clients can retry status reads without starting duplicate investigations.
- Investigation failures are represented as data rather than unhandled request timeouts.
- The job boundary is a natural place for concurrency limits and durable retries later.

Trade-offs:

- The in-process manager loses jobs when the API process restarts.
- Deduplication and cancellation policies are deferred to the durable queue milestone.

