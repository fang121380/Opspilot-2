from __future__ import annotations

from threading import RLock
from typing import Protocol
from uuid import UUID

from app.domain.jobs import InvestigationJob


class InvestigationJobRepository(Protocol):
    def add_job(self, job: InvestigationJob) -> InvestigationJob: ...

    def update_job(self, job: InvestigationJob) -> InvestigationJob: ...

    def get_job(self, job_id: UUID) -> InvestigationJob | None: ...


class InMemoryInvestigationJobRepository:
    """Thread-safe in-memory job snapshots for local and Kind execution."""

    def __init__(self) -> None:
        self._jobs: dict[UUID, InvestigationJob] = {}
        self._lock = RLock()

    def add_job(self, job: InvestigationJob) -> InvestigationJob:
        with self._lock:
            self._jobs[job.id] = job.model_copy(deep=True)
            return job.model_copy(deep=True)

    def update_job(self, job: InvestigationJob) -> InvestigationJob:
        with self._lock:
            if job.id not in self._jobs:
                raise KeyError(str(job.id))
            self._jobs[job.id] = job.model_copy(deep=True)
            return job.model_copy(deep=True)

    def get_job(self, job_id: UUID) -> InvestigationJob | None:
        with self._lock:
            job = self._jobs.get(job_id)
            return job.model_copy(deep=True) if job is not None else None
