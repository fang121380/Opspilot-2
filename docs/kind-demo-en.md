# Opspilot 2 Kind Incident Drill

This page is the English counterpart of [Kind 故障演练](kind-demo-zh.md). It reproduces the main scenario: `checkout` changes from a healthy version to a version that continuously returns HTTP 500.

## Prerequisites and bootstrap

- Docker Desktop is running.
- `docker`, `kind`, and `kubectl` are available.

```bash
./scripts/kind-demo.sh up
```

The script builds and loads the API and checkout images, deploys checkout, Prometheus, Alertmanager, and Opspilot 2, creates separate operator and Alertmanager Secrets, and waits for all Deployments. The Opspilot ServiceAccount can read only demo Deployments, ReplicaSets, Pods, and logs, and can patch a Deployment only for an approved rollback. It cannot read Secrets, modify RBAC, execute a shell, or access another namespace.

## Inject and observe the failure

```bash
./scripts/kind-demo.sh inject-failure
```

The injected version returns HTTP 500. The script generates requests inside the Pod so Prometheus observes the error rate across several scrapes. After the condition remains true for 15 seconds, query the alert:

```bash
kubectl -n demo port-forward service/prometheus 19090:9090
curl -s http://127.0.0.1:19090/api/v1/alerts
```

Expect `alertname=HighErrorRate` with state `firing`. Then inspect incidents through the API port-forward:

```bash
kubectl -n demo port-forward service/opspilot-2 18000:8000
curl -s http://127.0.0.1:18000/incidents
```

Alertmanager uses its own Bearer Secret and sends the firing alert to the API. It never receives the operator credential.

## Investigate, propose, and stop at approval

Use the incident ID for the read-only investigation:

```bash
curl -s -X POST http://127.0.0.1:18000/incidents/<incident-id>/investigate
```

The response cites Deployment availability, HTTP 5xx rate, and recent error logs. With matching evidence it recommends `rollback_deployment` at confidence `0.85` and moves the incident to `awaiting_approval`.

The async equivalent returns a Job ID. It atomically claims `received -> investigating`; recommendations advance to `awaiting_approval`, while no recommendation or investigation failure safely returns to `received`. A state-conflicted Job fails with `StateConflict` and does not call the investigator.

Creating a proposal and executing a change are separate operations. Missing or mismatched approval returns `403` and does not patch Kubernetes. The approval and execution commands are intentionally manual and are not part of fault injection:

```bash
OPSPILOT_KIND_TOKEN=$(<.secrets/opspilot-kind-token)
curl -s -X POST http://127.0.0.1:18000/remediation/proposals/<proposal-id>/approval \
  -H "Authorization: Bearer $OPSPILOT_KIND_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"expires_in_minutes":15}'
curl -s -X POST http://127.0.0.1:18000/remediation/execute \
  -H "Authorization: Bearer $OPSPILOT_KIND_TOKEN" \
  -H 'Content-Type: application/json' \
  -d '{"proposal_id":"<proposal-id>","approval_id":"<approval-id>"}'
```

The project does not execute this final step automatically. After a successful approved write, the incident enters `verifying`; a read-only Prometheus check must observe a 5xx rate no higher than `0.01` before it becomes `resolved`.

## Recovery and cleanup

```bash
./scripts/kind-demo.sh recover
./scripts/kind-demo.sh down
```

`recover` is only the checkout fault recovery helper. It does not approve or execute Opspilot remediation.
