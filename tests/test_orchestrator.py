from datetime import UTC, datetime
from types import SimpleNamespace

import pytest

from app.adapters.kubernetes import DeploymentStatus
from app.adapters.prometheus import MetricQueryResult, MetricSample
from app.agent.orchestrator import IncidentInvestigator
from app.domain.incidents import Incident
from app.storage.audit import AuditEventType, AuditRepository


class FakeKubernetes:
    async def deployment_status(self, *, namespace: str, name: str):
        return DeploymentStatus(
            name=name,
            namespace=namespace,
            desired_replicas=3,
            available_replicas=2,
            updated_replicas=2,
        )

    async def list_pods(self, *, namespace: str, label_selector: str):
        return [SimpleNamespace(name="checkout-123")]

    async def tail_pod_logs(self, *, namespace: str, pod_name: str, container: str | None = None):
        return "ERROR request failed\n"


class FakePrometheus:
    async def instant_query(self, query: str) -> MetricQueryResult:
        assert 'service="checkout"' in query
        return MetricQueryResult(
            query=query,
            samples=[
                MetricSample(
                    labels={"service": "checkout"},
                    timestamp=datetime(2026, 8, 28, 1, 0, tzinfo=UTC),
                    value=0.42,
                )
            ],
        )


@pytest.mark.asyncio
async def test_investigator_collects_evidence_analyzes_and_audits() -> None:
    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="alert-123",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, 0, 55, tzinfo=UTC),
    )
    audit = AuditRepository()
    investigator = IncidentInvestigator(
        kubernetes=FakeKubernetes(), prometheus=FakePrometheus(), audit_repository=audit
    )

    outcome = await investigator.investigate(incident)

    assert outcome.hypotheses[0].title == "Recent deployment regression"
    assert [event.event_type for event in audit.list_for_incident(incident.id)] == [
        AuditEventType.DIAGNOSTIC_COMPLETED,
        AuditEventType.ANALYSIS_COMPLETED,
    ]
    assert all(
        event.trace_id and len(event.trace_id) == 32
        for event in audit.list_for_incident(incident.id)
    )


@pytest.mark.asyncio
async def test_investigator_requires_incident_scope() -> None:
    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="alert-123",
        namespace="demo",
        started_at=datetime(2026, 8, 28, 0, 55, tzinfo=UTC),
    )
    investigator = IncidentInvestigator(
        kubernetes=FakeKubernetes(), prometheus=FakePrometheus(), audit_repository=AuditRepository()
    )

    with pytest.raises(ValueError, match="service and namespace"):
        await investigator.investigate(incident)
