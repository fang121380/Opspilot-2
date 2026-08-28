# OpsPilot MVP Architecture

## Design principles

1. **Read first, write last.** Diagnostics are read-only. Mutations are isolated behind policy and approval checks.
2. **Evidence over assertion.** The agent may summarize collected evidence, but it must not invent observations.
3. **Replaceable integrations.** Kubernetes, metrics, logs, and the LLM are adapters behind small interfaces.
4. **Deterministic tests.** Fake adapters and a fake LLM make the core workflow testable offline.
5. **Every action is observable.** Incident, tool, model, approval, and execution records share a correlation ID.

## Components

```text
Prometheus webhook
        |
        v
  FastAPI API  -----> Incident store (PostgreSQL)
        |
        v
 Incident orchestrator
        |
        +---- Kubernetes diagnostic adapter (read-only)
        +---- Prometheus diagnostic adapter (read-only)
        +---- Log diagnostic adapter (read-only)
        |
        v
 Evidence set -> Analysis service -> LLM provider (replaceable)
        |
        v
 Remediation proposal -> Policy engine -> Approval service
                                               |
                                               v
                                  Allowlisted executor (rollback)
                                               |
                                               v
                                  Verification + audit record

 OpenTelemetry spans cross every boundary.
```

## Suggested package boundaries

```text
app/
├── api/          # HTTP routes and request/response schemas
├── domain/       # Incident, evidence, proposal, approval models
├── adapters/     # Kubernetes, Prometheus, logs, and LLM integrations
├── agent/        # State machine and evidence-driven analysis
├── policy/       # Allowlist, authorization, and approval validation
├── executor/     # Narrow mutating operations
└── storage/      # Repositories and database mapping
```

## Data flow constraints

- Diagnostic adapters return typed `ToolResult` values, never raw subprocess output.
- The analysis service receives an immutable evidence set.
- A remediation proposal is data, not executable code.
- The executor accepts only a typed action such as `RollbackDeployment`.
- The policy engine validates namespace, resource, actor, approval, and expiry before execution.

## Incident state flow

```text
received -> investigating -> awaiting_approval -> executing -> verifying -> resolved
                              ^                    |
                              |____________________|
                           rejected approval
```

The API persists each transition in both the in-memory repository and SQLAlchemy store. A rejected, missing, mismatched, or expired approval cannot advance the incident to a mutating state.

## Initial technology choices

- Python 3.12+ with FastAPI and Pydantic.
- SQLAlchemy and PostgreSQL for persistence.
- `pytest` for tests and a linter/formatter enforced in CI.
- Docker Compose for local dependencies and Kind for the Kubernetes drill.
- OpenTelemetry SDK with an OTLP-compatible local collector in the integration environment.
