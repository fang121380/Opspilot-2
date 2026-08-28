# ADR-0012: Separate Proposal, Approval, and Execution APIs

## Status

Accepted

## Context

An incident analysis can finish long before an operator reviews its proposed action. Combining proposal creation, approval, and execution in one request would make accidental mutation and approval replay more likely.

## Decision

Expose three explicit operations:

- `POST /remediation/proposals` creates a typed, non-executable proposal.
- `POST /remediation/proposals/{proposal_id}/approval` creates an expiring approval record.
- `POST /remediation/execute` requires both the typed proposal and its matching approval, then delegates to an injected `RemediationExecutor`.

The API maps policy, missing approval, and expired approval failures to HTTP 403. The executor remains disabled unless explicitly configured in the application runtime.

## Consequences

Positive:

- Each safety transition is visible in the audit timeline.
- Approval can be reviewed independently of analysis.
- Tests can prove the default API cannot mutate without an injected executor.

Trade-offs:

- A persistent proposal/approval repository is still needed for multi-process production deployment.
- Authentication of `approved_by` is deferred; the MVP treats it as an input field, not an identity proof.

