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
    def update_status(self, incident_id: str, status: IncidentStatus) -> Incident: ...


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
        job = InvestigationJob(incident_id=incident.id)
        self._job_repository.add_job(job)
        asyncio.create_task(self._run(job, incident))
        return job.model_copy(deep=True)

    def get(self, job_id: UUID) -> InvestigationJob | None:
        return self._job_repository.get_job(job_id)

    async def _run(self, job: InvestigationJob, incident: Incident) -> None:
        job.status = JobStatus.RUNNING
        self._job_repository.update_job(job)
        self._update_incident(incident.id, IncidentStatus.INVESTIGATING)
        try:
            job.analysis = await self._investigator.investigate(incident)
            job.status = JobStatus.SUCCEEDED
            INVESTIGATION_OUTCOMES.labels(
                outcome="recommended" if job.analysis.recommended_actions else "no_action"
            ).inc()
            if job.analysis.recommended_actions:
                self._update_incident(incident.id, IncidentStatus.AWAITING_APPROVAL)
        except Exception as error:  # noqa: BLE001 - job boundary records failures
            job.status = JobStatus.FAILED
            job.error = type(error).__name__
            INVESTIGATION_OUTCOMES.labels(outcome="failed").inc()
            if self._audit_repository is not None:
                self._audit_repository.append(
                    event_type=AuditEventType.DIAGNOSTIC_FAILED,
                    incident_id=incident.id,
                    payload={"error_type": job.error, "job_id": str(job.id)},
                )
        finally:
            job.finished_at = datetime.now(UTC)
            self._job_repository.update_job(job)

    def _update_incident(self, incident_id: UUID, status: IncidentStatus) -> None:
        if self._incident_repository is not None:
            self._incident_repository.update_status(str(incident_id), status)
