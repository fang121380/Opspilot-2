from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID

from app.agent.analysis import AnalysisOutcome
from app.domain.incidents import Incident, IncidentStatus
from app.domain.jobs import InvestigationJob, JobStatus
from app.observability.metrics import INVESTIGATION_OUTCOMES
from app.storage.audit import AuditEventType
from app.storage.jobs import (
    InMemoryInvestigationJobRepository,
    InvestigationJobRepository,
)


class Investigator(Protocol):
    async def investigate(self, incident: Incident) -> AnalysisOutcome: ...


class IncidentStatusRepository(Protocol):
    def transition_status(
        self,
        incident_id: str,
        *,
        expected: IncidentStatus,
        target: IncidentStatus,
    ) -> Incident | None: ...


class AuditRepository(Protocol):
    def append(self, **kwargs: object) -> object: ...


class InvestigationJobManager:
    """Execute local tasks while persisting every externally visible snapshot."""

    def __init__(
        self,
        investigator: Investigator,
        incident_repository: IncidentStatusRepository | None = None,
        audit_repository: AuditRepository | None = None,
        job_repository: InvestigationJobRepository | None = None,
    ) -> None:
        self._investigator = investigator
        self._incident_repository = incident_repository
        self._audit_repository = audit_repository
        self._job_repository = job_repository or InMemoryInvestigationJobRepository()

    def enqueue(self, incident: Incident) -> InvestigationJob:
        candidate = InvestigationJob(incident_id=incident.id)
        job, deduplicated = self._job_repository.create_or_get_active_job(candidate)
        if not deduplicated:
            asyncio.create_task(self._run(job, incident))
        return job.model_copy(deep=True)

    def get(self, job_id: UUID) -> InvestigationJob | None:
        return self._job_repository.get_job(job_id)

    async def _run(self, job: InvestigationJob, incident: Incident) -> None:
        job.status = JobStatus.RUNNING
        self._job_repository.update_job(job)
        claimed = self._transition_incident(
            incident.id,
            expected=IncidentStatus.RECEIVED,
            target=IncidentStatus.INVESTIGATING,
        )
        if not claimed:
            self._fail_job(job, incident, "StateConflict")
            job.finished_at = datetime.now(UTC)
            self._job_repository.update_job(job)
            return
        try:
            job.analysis = await self._investigator.investigate(incident)
            if job.analysis.recommended_actions:
                transitioned = self._transition_incident(
                    incident.id,
                    expected=IncidentStatus.INVESTIGATING,
                    target=IncidentStatus.AWAITING_APPROVAL,
                )
            else:
                transitioned = self._transition_incident(
                    incident.id,
                    expected=IncidentStatus.INVESTIGATING,
                    target=IncidentStatus.RECEIVED,
                )
            if not transitioned:
                self._fail_job(job, incident, "StateConflict")
                return
            job.status = JobStatus.SUCCEEDED
            INVESTIGATION_OUTCOMES.labels(
                outcome="recommended" if job.analysis.recommended_actions else "no_action"
            ).inc()
        except Exception as error:  # noqa: BLE001 - job boundary records failures
            self._fail_job(job, incident, type(error).__name__)
            self._transition_incident(
                incident.id,
                expected=IncidentStatus.INVESTIGATING,
                target=IncidentStatus.RECEIVED,
            )
        finally:
            job.finished_at = datetime.now(UTC)
            self._job_repository.update_job(job)

    def _transition_incident(
        self,
        incident_id: UUID,
        *,
        expected: IncidentStatus,
        target: IncidentStatus,
    ) -> bool:
        if self._incident_repository is None:
            return True
        return (
            self._incident_repository.transition_status(
                str(incident_id), expected=expected, target=target
            )
            is not None
        )

    def _fail_job(self, job: InvestigationJob, incident: Incident, error: str) -> None:
        job.status = JobStatus.FAILED
        job.error = error
        INVESTIGATION_OUTCOMES.labels(outcome="failed").inc()
        if self._audit_repository is not None:
            self._audit_repository.append(
                event_type=AuditEventType.DIAGNOSTIC_FAILED,
                incident_id=incident.id,
                payload={"error_type": error, "job_id": str(job.id)},
            )
