from __future__ import annotations

import asyncio
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.agent.analysis import AnalysisOutcome
from app.agent.orchestrator import IncidentInvestigator
from app.domain.incidents import Incident


class JobStatus(StrEnum):
    QUEUED = "queued"
    RUNNING = "running"
    SUCCEEDED = "succeeded"
    FAILED = "failed"


class InvestigationJob(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    incident_id: UUID
    status: JobStatus = JobStatus.QUEUED
    analysis: AnalysisOutcome | None = None
    error: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    finished_at: datetime | None = None


class InvestigationJobManager:
    """轻量本地任务管理器；生产环境可替换为 Redis/Celery 或消息队列。"""

    def __init__(self, investigator: IncidentInvestigator) -> None:
        self._investigator = investigator
        self._jobs: dict[UUID, InvestigationJob] = {}

    def enqueue(self, incident: Incident) -> InvestigationJob:
        job = InvestigationJob(incident_id=incident.id)
        self._jobs[job.id] = job
        asyncio.create_task(self._run(job, incident))
        return job.model_copy(deep=True)

    def get(self, job_id: UUID) -> InvestigationJob | None:
        job = self._jobs.get(job_id)
        return job.model_copy(deep=True) if job else None

    async def _run(self, job: InvestigationJob, incident: Incident) -> None:
        job.status = JobStatus.RUNNING
        try:
            job.analysis = await self._investigator.investigate(incident)
            job.status = JobStatus.SUCCEEDED
        except Exception as error:  # noqa: BLE001 - job boundary records failures
            job.status = JobStatus.FAILED
            job.error = type(error).__name__
        finally:
            job.finished_at = datetime.now(UTC)
