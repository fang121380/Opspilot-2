# ADR-0009: Use the Kubernetes Python Client Directly

中文摘要：直接使用类型化 Kubernetes 客户端，避免在 Agent 边界执行 kubectl Shell。

## Status

Accepted

## Context

The Kind drill needs the running application to query Kubernetes. Shelling out to `kubectl` would introduce command construction, quoting, process, and privilege risks into the Agent boundary.

## Decision

The runtime constructs `kubernetes-asyncio` API clients from the user's kubeconfig and injects them into the existing typed diagnostics adapter. The adapter exposes only the read methods already defined by the MVP. It does not create a generic command runner or read cluster Secrets.

## Consequences

Positive:

- Requests are typed and go through the Kubernetes API client's normal authentication and RBAC.
- Async calls fit the FastAPI investigation path.
- The same adapter remains testable with fake API objects.

Trade-offs:

- A real cluster or kubeconfig is required for integration tests.
- Client lifecycle management must close the API client during application shutdown.
