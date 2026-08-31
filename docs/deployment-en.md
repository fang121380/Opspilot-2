# Opspilot 2 Deployment Guide

This page is the English counterpart of [部署说明](deployment-zh.md).

## Local Python mode

Use this mode for offline development and unit tests. Incidents are stored in memory:

```bash
make setup
make test
make run
```

## Docker Compose mode

Compose starts Opspilot 2, PostgreSQL, and Prometheus. With `OPSPILOT_DATABASE_URL`, incidents, audits, proposals, approvals, and investigation Job snapshots use SQLAlchemy persistence:

```bash
docker compose up --build
curl http://127.0.0.1:8000/health
```

The API waits for PostgreSQL, runs `python -m app.migrate`, and only then starts Uvicorn. `/health` is a dependency-free liveness check. `/ready` is `200` only when investigation, async Jobs, remediation execution, verification, and both authenticators are configured. Compose intentionally does not mount Kubernetes credentials, so investigation returns an explicit `503` instead of fabricated evidence.

Prometheus is built as a dedicated image and is reachable only inside the Compose network. The API is exposed on host port `8000` by default. If another local instance owns that port, use `OPSPILOT_HOST_PORT=8001 docker compose up --build` and call `http://127.0.0.1:8001/health`.

The default credentials are for local demonstrations only. Production deployments must use Secrets for database credentials and replace image, network, RBAC, and backup policies.

## Database migrations

Back up a persistent database before migration:

```bash
export OPSPILOT_DATABASE_URL='postgresql+psycopg://...'
make migrate
alembic current
```

The chain is `0001_initial_schema -> 0002_active_fingerprint -> 0003_persist_investigation_jobs -> 0004_deduplicate_active_jobs -> 0005_unique_proposals`. Migrations adopt only known empty, legacy, or current schemas. Partial, ambiguous, or unknown structures fail closed rather than dropping data or guessing which duplicate to keep.

## Interrupted Job recovery

Async Jobs run in the current process and are not automatically resumed after a crash. The application never changes shared Job state during startup, because one API replica cannot safely infer that another replica stopped. Stop all API/worker processes, back up the database, and inspect candidates first:

```bash
export OPSPILOT_DATABASE_URL='postgresql+psycopg://...'
make recover-jobs
```

After confirming that the candidates belong to an interrupted process, run:

```bash
.venv/bin/python -m app.job_recovery --confirm
```

The command conditionally marks only `queued`/`running` snapshots as `failed` with `ProcessRestarted`, releases `active_incident_id`, and returns an `investigating` incident to `received` only when that state still matches. It never starts a new coroutine, repeats diagnostics, or calls Kubernetes.

## Kubernetes and Kind mode

See the [Kind incident drill](kind-demo-en.md). The manifests use `/health` for liveness and `/ready` for readiness, so missing external dependencies do not make a Pod ready for traffic.

## Configuration

| Variable | Purpose | Default |
| --- | --- | --- |
| `OPSPILOT_ENVIRONMENT` | Runtime environment label | `development` |
| `OPSPILOT_HOST_PORT` | Compose host API port | `8000` |
| `OPSPILOT_DATABASE_URL` | SQLAlchemy database URL | unset, in-memory mode |
| `OPSPILOT_PROMETHEUS_URL` | Prometheus endpoint | unset |
| `OPSPILOT_OPERATOR_ID` | Trusted approval operator identity | unset |
| `OPSPILOT_OPERATOR_TOKEN` | Operator Bearer secret | unset |
| `OPSPILOT_ALERTMANAGER_TOKEN` | Alertmanager Bearer secret | unset |

When `OPSPILOT_PROMETHEUS_URL` is configured, startup attempts in-cluster ServiceAccount credentials and then the current kubeconfig. Successful setup creates read-only Kubernetes and Prometheus adapters plus the investigator and verifier. Without those dependencies the API remains usable for alert ingestion and offline tests, while investigation returns `503`.

Operator approval and execution use a separate Bearer identity from Alertmanager. The server maps the operator token to `approved_by`; clients cannot forge that field. Alertmanager can create incidents but cannot approve or execute remediation.
