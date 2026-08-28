from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field

from app.agent.analysis import AnalysisOutcome


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
