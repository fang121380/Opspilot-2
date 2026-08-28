from __future__ import annotations

import json
from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.adapters.kubernetes import DeploymentStatus, PodSummary
from app.adapters.prometheus import MetricQueryResult, MetricSample
from app.agent.orchestrator import IncidentInvestigator
from app.main import create_app
from app.policy.remediation import RemediationExecutor, RemediationPolicy
from app.security.auth import BearerTokenAuthenticator
from app.storage.audit import AuditRepository


class DemoKubernetes:
    async def deployment_status(self, *, namespace: str, name: str) -> DeploymentStatus:
        return DeploymentStatus(
            name=name,
            namespace=namespace,
            desired_replicas=3,
            available_replicas=2,
            updated_replicas=2,
        )

    async def list_pods(self, *, namespace: str, label_selector: str) -> list[PodSummary]:
        return [PodSummary(name="checkout-v2-7f6bc", phase="Running")]

    async def tail_pod_logs(
        self, *, namespace: str, pod_name: str, container: str | None = None
    ) -> str:
        return "ERROR migration connection refused\nERROR request failed\n"


class DemoPrometheus:
    async def instant_query(self, query: str) -> MetricQueryResult:
        return MetricQueryResult(
            query=query,
            samples=[
                MetricSample(
                    labels={"service": "checkout", "code": "500"},
                    timestamp=datetime.now(UTC),
                    value=0.42,
                )
            ],
        )


class DemoRollbackClient:
    async def rollback_deployment(self, *, namespace: str, deployment: str, dry_run: bool) -> str:
        if dry_run:
            return "演示 dry-run"
        return f"演示：已请求回滚 {namespace}/{deployment}"


def run_demo() -> str:
    """运行不依赖 Docker 的 API 闭环演示，并返回中文输出。"""

    audit = AuditRepository()
    investigator = IncidentInvestigator(
        kubernetes=DemoKubernetes(), prometheus=DemoPrometheus(), audit_repository=audit
    )
    executor = RemediationExecutor(
        policy=RemediationPolicy(allowed_namespaces={"demo"}),
        rollback_client=DemoRollbackClient(),
    )
    client = TestClient(
        create_app(
            audit_repository=audit,
            investigator=investigator,
            remediation_executor=executor,
            operator_authenticator=BearerTokenAuthenticator(
                token="local-demo-token", subject="demo-operator"
            ),
        )
    )
    alert = client.post(
        "/webhooks/prometheus",
        json={
            "status": "firing",
            "alerts": [
                {
                    "status": "firing",
                    "labels": {
                        "alertname": "HighErrorRate",
                        "namespace": "demo",
                        "service": "checkout",
                        "severity": "critical",
                    },
                    "annotations": {"summary": "Checkout 5xx 错误率升高"},
                    "startsAt": "2026-08-28T00:00:00Z",
                    "fingerprint": "demo-high-error-rate",
                }
            ],
        },
    ).json()
    incident_id = alert["incident"]["id"]
    analysis = client.post(f"/incidents/{incident_id}/investigate").json()["analysis"]
    proposal = client.post(
        "/remediation/proposals",
        json={
            "incident_id": incident_id,
            "action": "rollback_deployment",
            "namespace": "demo",
            "deployment": "checkout",
        },
    ).json()
    approval = client.post(
        f"/remediation/proposals/{proposal['id']}/approval",
        headers={"Authorization": "Bearer local-demo-token"},
        json={"expires_in_minutes": 15},
    ).json()
    execution = client.post(
        "/remediation/execute",
        headers={"Authorization": "Bearer local-demo-token"},
        json={"proposal_id": proposal["id"], "approval_id": approval["id"]},
    ).json()
    timeline = client.get(f"/incidents/{incident_id}/audit").json()
    lines = [
        "=== Opspilot 2 本地闭环演示 ===",
        f"事故 ID: {incident_id}",
        f"根因假设: {analysis['hypotheses'][0]['title']}",
        f"分析置信度: {analysis['confidence']}",
        f"修复建议: {analysis['recommended_actions'][0]['action']}",
        f"执行结果: {execution['message']}",
        "审计事件:",
        json.dumps([event["event_type"] for event in timeline], ensure_ascii=False),
    ]
    return "\n".join(lines)
