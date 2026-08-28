# ADR-0013: Represent Long Investigations as Jobs

## Status

Accepted

## Context

Kubernetes and observability calls can be slow or temporarily unavailable. Holding an HTTP request open for the whole investigation creates fragile retries and makes operator polling difficult.

## Decision

Expose an explicit job API:

- `POST /incidents/{incident_id}/investigate/jobs` enqueues an investigation and returns a job ID.
- `GET /investigation/jobs/{job_id}` returns queued, running, succeeded, or failed state.

The MVP uses an in-process task manager so behavior is testable without Redis. Job snapshots are persisted through a repository as described in ADR-0018. A production deployment can replace execution with a durable queue without changing the API contract.

## Consequences

Positive:

- Clients can retry status reads without starting duplicate investigations.
- Investigation failures are represented as data rather than unhandled request timeouts.
- The job boundary is a natural place for concurrency limits and durable retries later.

Trade-offs:

- In-flight coroutines are not resumed when the API process restarts, although their last persisted snapshot remains queryable.
- Leases, deduplication, cancellation, and retry policies are deferred to the durable queue milestone.
