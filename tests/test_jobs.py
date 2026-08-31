import asyncio
from datetime import UTC, datetime

import pytest

from app.agent.analysis import AnalysisOutcome, RemediationRecommendation
from app.agent.jobs import InvestigationJobManager, JobStatus
from app.domain.incidents import Incident, IncidentStatus
from app.storage.audit import AuditEventType, AuditRepository
from app.storage.incidents import IncidentRepository
from app.storage.jobs import InMemoryInvestigationJobRepository


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
async def test_job_snapshot_survives_manager_recreation() -> None:
    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="job-restart-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    jobs = InMemoryInvestigationJobRepository()
    first_manager = InvestigationJobManager(FakeInvestigator(), job_repository=jobs)
    queued = first_manager.enqueue(incident)
    for _ in range(20):
        await asyncio.sleep(0)
        current = first_manager.get(queued.id)
        if current and current.status == JobStatus.SUCCEEDED:
            break

    recreated = InvestigationJobManager(FakeInvestigator(), job_repository=jobs)
    restored = recreated.get(queued.id)

    assert restored is not None
    assert restored.status == JobStatus.SUCCEEDED
    assert restored.analysis is not None
    assert restored.analysis.confidence == 0.9


@pytest.mark.asyncio
async def test_job_manager_deduplicates_only_active_investigations() -> None:
    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="job-deduplication-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    manager = InvestigationJobManager(FakeInvestigator())

    first = manager.enqueue(incident)
    duplicate = manager.enqueue(incident)
    assert duplicate.id == first.id

    for _ in range(20):
        await asyncio.sleep(0)
        current = manager.get(first.id)
        if current and current.status == JobStatus.SUCCEEDED:
            break
    repeated = manager.enqueue(incident)

    assert repeated.id != first.id


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


@pytest.mark.asyncio
async def test_job_manager_sanitizes_and_audits_investigation_failure() -> None:
    class FailingInvestigator:
        async def investigate(self, incident: Incident) -> AnalysisOutcome:
            raise RuntimeError("sensitive upstream detail")

    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="job-failure-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    repository = IncidentRepository()
    repository.create_or_get_active(incident)
    audit = AuditRepository()
    manager = InvestigationJobManager(FailingInvestigator(), repository, audit)

    queued = manager.enqueue(incident)
    for _ in range(20):
        await asyncio.sleep(0)
        current = manager.get(queued.id)
        if current and current.status == JobStatus.FAILED:
            break

    assert current.error == "RuntimeError"
    assert "sensitive" not in current.model_dump_json()
    events = audit.list_for_incident(incident.id)
    assert events[-1].event_type == AuditEventType.DIAGNOSTIC_FAILED
    assert events[-1].payload == {
        "error_type": "RuntimeError",
        "job_id": str(queued.id),
    }
    assert repository.get(str(incident.id)).status == IncidentStatus.RECEIVED


@pytest.mark.asyncio
async def test_job_manager_does_not_investigate_when_state_is_already_claimed() -> None:
    class UnexpectedInvestigator:
        async def investigate(self, incident: Incident) -> AnalysisOutcome:
            raise AssertionError("a state-conflicted job must not investigate")

    incident = Incident(
        status=IncidentStatus.INVESTIGATING,
        alert_name="HighErrorRate",
        alert_fingerprint="job-state-conflict-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    repository = IncidentRepository()
    repository.create_or_get_active(incident)
    manager = InvestigationJobManager(UnexpectedInvestigator(), repository)

    queued = manager.enqueue(incident)
    for _ in range(20):
        await asyncio.sleep(0)
        current = manager.get(queued.id)
        if current and current.status == JobStatus.FAILED:
            break

    assert current is not None
    assert current.status == JobStatus.FAILED
    assert current.error == "StateConflict"
    assert repository.get(str(incident.id)).status == IncidentStatus.INVESTIGATING


@pytest.mark.asyncio
async def test_job_manager_does_not_overwrite_state_changed_during_investigation() -> None:
    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="job-final-state-conflict-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    repository = IncidentRepository()
    repository.create_or_get_active(incident)

    class StateChangingInvestigator:
        async def investigate(self, incident: Incident) -> AnalysisOutcome:
            repository.transition_status(
                str(incident.id),
                expected=IncidentStatus.INVESTIGATING,
                target=IncidentStatus.EXECUTING,
            )
            return AnalysisOutcome(summary="done", impact="none", confidence=0.9)

    manager = InvestigationJobManager(StateChangingInvestigator(), repository)
    queued = manager.enqueue(incident)
    for _ in range(20):
        await asyncio.sleep(0)
        current = manager.get(queued.id)
        if current and current.status == JobStatus.FAILED:
            break

    assert current is not None
    assert current.status == JobStatus.FAILED
    assert current.error == "StateConflict"
    assert repository.get(str(incident.id)).status == IncidentStatus.EXECUTING
