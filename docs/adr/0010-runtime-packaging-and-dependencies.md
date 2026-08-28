# ADR-0010: Separate Offline Development from Runtime Dependencies

## Status

Accepted

## Context

Opspilot 2 must remain easy to test on a laptop while also offering a realistic deployment path with PostgreSQL, Prometheus, and Kubernetes. Requiring all infrastructure for every unit test would slow iteration and hide domain regressions behind environment failures.

## Decision

The default application factory uses in-memory repositories and does not construct external clients unless explicitly injected. Docker Compose packages the API with PostgreSQL and Prometheus for a deployable local runtime. Environment variables select external endpoints; missing dependencies cause an explicit 503 for investigation rather than silent fallback to fake evidence.

## Consequences

Positive:

- Unit tests remain fast and deterministic.
- A single Compose command documents the expected service topology.
- Runtime configuration is externalized and can be replaced by deployment Secret management.

Trade-offs:

- PostgreSQL persistence is wired through the SQLAlchemy Repository when `OPSPILOT_DATABASE_URL` is configured; the default test factory still uses in-memory storage.
- The Kind integration still requires Docker Desktop and a working kubeconfig.
