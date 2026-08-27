# ADR-0004: Require Expiring Approval for Every Remediation

## Status

Accepted

## Context

Opspilot 2 will eventually invoke a Kubernetes rollout rollback. Even a narrowly scoped mutation can have availability and data consequences. An agent recommendation must not be treated as authorization.

## Decision

The execution path requires all of the following:

1. A typed proposal with a known incident, action, namespace, and deployment.
2. A policy allowlist that accepts both the action and namespace.
3. An approval that matches the exact proposal ID.
4. An approval whose expiry is later than the execution time.

The first policy allows only `rollback_deployment` in the configured demo namespace. Arbitrary shell commands, cluster-wide deletes, RBAC updates, Secret reads, and `kubectl exec` are outside the design.

## Consequences

Positive:

- A test can prove a forbidden action never reaches the cluster client.
- Approval cannot be replayed for a different proposal or after expiry.
- The executor remains simple enough to audit.

Trade-offs:

- An operator must approve each mutation in the MVP.
- Production policy configuration and user identity verification are deferred until authentication is introduced.

