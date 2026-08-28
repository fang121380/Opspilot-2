import asyncio
from datetime import UTC, datetime

import pytest

from app.agent.analysis import AnalysisOutcome, RemediationRecommendation
from app.agent.jobs import InvestigationJobManager, JobStatus
from app.domain.incidents import Incident, IncidentStatus
from app.storage.incidents import IncidentRepository


class FakeInvestigator:
    async def investigate(self, incident: Incident) -> AnalysisOutcome:
        await asyncio.sleep(0)
        return AnalysisOutcome(summary="done", impact="none", confidence=0.9)


@pytest.mark.asyncio
async def test_job_manager_runs_investigation_and_exposes_snapshot() -> None:
    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="job-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    manager = InvestigationJobManager(FakeInvestigator())

    queued = manager.enqueue(incident)
    assert queued.status == JobStatus.QUEUED

    for _ in range(20):
        await asyncio.sleep(0)
        current = manager.get(queued.id)
        if current and current.status == JobStatus.SUCCEEDED:
            break

    assert current is not None
    assert current.status == JobStatus.SUCCEEDED
    assert current.analysis.confidence == 0.9


@pytest.mark.asyncio
async def test_job_manager_updates_incident_when_remediation_is_recommended() -> None:
    class RecommendingInvestigator:
        async def investigate(self, incident: Incident) -> AnalysisOutcome:
            return AnalysisOutcome(
                summary="rollback recommended",
                impact="users affected",
                confidence=0.85,
                recommended_actions=[
                    RemediationRecommendation(
                        action="rollback_deployment",
                        namespace="demo",
                        deployment="checkout",
                    )
                ],
            )

    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="job-state-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    repository = IncidentRepository()
    repository.create_or_get_active(incident)
    manager = InvestigationJobManager(RecommendingInvestigator(), repository)

    queued = manager.enqueue(incident)
    for _ in range(20):
        await asyncio.sleep(0)
        current = manager.get(queued.id)
        if current and current.status == JobStatus.SUCCEEDED:
            break

    assert repository.get(str(incident.id)).status == IncidentStatus.AWAITING_APPROVAL
