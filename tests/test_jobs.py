import asyncio
from datetime import UTC, datetime

import pytest

from app.agent.analysis import AnalysisOutcome
from app.agent.jobs import InvestigationJobManager, JobStatus
from app.domain.incidents import Incident


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
