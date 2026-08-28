from __future__ import annotations

from threading import RLock
from typing import Protocol
from uuid import UUID

from app.domain.jobs import InvestigationJob, JobStatus


class InvestigationJobRepository(Protocol):
    def create_or_get_active_job(
        self, job: InvestigationJob
    ) -> tuple[InvestigationJob, bool]: ...

    def update_job(self, job: InvestigationJob) -> InvestigationJob: ...

    def get_job(self, job_id: UUID) -> InvestigationJob | None: ...


class InMemoryInvestigationJobRepository:
    """Thread-safe in-memory job snapshots for local and Kind execution."""

    def __init__(self) -> None:
        self._jobs: dict[UUID, InvestigationJob] = {}
        self._active_by_incident: dict[UUID, UUID] = {}
        self._lock = RLock()

    def create_or_get_active_job(
        self, job: InvestigationJob
    ) -> tuple[InvestigationJob, bool]:
        with self._lock:
            existing_id = self._active_by_incident.get(job.incident_id)
            if existing_id is not None:
                return self._jobs[existing_id].model_copy(deep=True), True
            self._jobs[job.id] = job.model_copy(deep=True)
            self._active_by_incident[job.incident_id] = job.id
            return job.model_copy(deep=True), False

    def update_job(self, job: InvestigationJob) -> InvestigationJob:
        with self._lock:
            if job.id not in self._jobs:
                raise KeyError(str(job.id))
            self._jobs[job.id] = job.model_copy(deep=True)
            if job.status in {JobStatus.SUCCEEDED, JobStatus.FAILED}:
                if self._active_by_incident.get(job.incident_id) == job.id:
                    self._active_by_incident.pop(job.incident_id, None)
            return job.model_copy(deep=True)

    def get_job(self, job_id: UUID) -> InvestigationJob | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return job.model_copy(deep=True) if job is not None else None
