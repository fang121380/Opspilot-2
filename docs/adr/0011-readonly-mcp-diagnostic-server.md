# ADR-0011: Expose Read-Only Diagnostics through MCP

## Status

Accepted

## Context

MCP gives agent hosts a standard way to discover and call tools. It also makes an accidentally broad tool surface easy to expose to a model, so the server boundary must be intentionally narrow.

## Decision

Opspilot 2 provides an MCP server with exactly three tools:

- `get_deployment_status`
- `list_service_pods`
- `query_http_error_rate`

All three are read-only and return typed structured data. The HTTP error-rate tool constructs one fixed PromQL template and escapes label values; clients cannot supply arbitrary PromQL or a remediation command. Rollback remains in the approval-gated executor and is not an MCP tool.

The implementation follows the official Python SDK v2 decorator model and is tested with the SDK's in-memory `Client`, so protocol framing and tool schemas are exercised without a network listener.

## Consequences

Positive:

- Claude, an IDE, or a future Agent runtime can discover the same diagnostic capabilities.
- The MCP tool catalog itself documents the security boundary.
- In-memory protocol tests catch schema and structured-output regressions.

Trade-offs:

- The server is not yet mounted into FastAPI's Streamable HTTP transport.
- Authentication and per-caller authorization are deferred to the MCP gateway milestone.

