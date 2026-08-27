# ADR-0001: Constrain the First OpsPilot Release to One Incident Loop

## Status

Accepted

## Context

OpsPilot could expand into a general-purpose agent, a Kubernetes Operator, an MCP gateway, and a multi-cluster remediation platform. Building all of those capabilities at once would make the project difficult to test and difficult to explain in an interview.

## Decision

The first release implements one vertical slice: a high HTTP 5xx rate caused by a bad deployment, followed by evidence collection, a rollback proposal, human approval, allowlisted execution, and post-remediation verification.

The first implementation uses Python interfaces and fake adapters so the domain workflow can be tested offline. MCP exposure, a Go Operator, additional remediation actions, and a richer UI are follow-on milestones.

## Consequences

Positive:

- The repository remains runnable at every milestone.
- Tests can prove safety properties before real cluster access is added.
- The demo tells one coherent story across AI Agent and operations engineering.

Trade-offs:

- The MVP supports only one incident class and one mutating action.
- Some integrations are intentionally represented by adapters rather than fully featured production clients.

