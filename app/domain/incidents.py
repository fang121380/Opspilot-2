from __future__ import annotations

from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class IncidentStatus(StrEnum):
    RECEIVED = "received"
    INVESTIGATING = "investigating"
    AWAITING_APPROVAL = "awaiting_approval"
    EXECUTING = "executing"
    VERIFYING = "verifying"
    RESOLVED = "resolved"
    CLOSED = "closed"


class Incident(BaseModel):
    """A normalized operational incident created from one active alert fingerprint."""

    id: UUID = Field(default_factory=uuid4)
    status: IncidentStatus = IncidentStatus.RECEIVED
    alert_name: str
    alert_fingerprint: str
    service: str | None = None
    namespace: str | None = None
    severity: str = "warning"
    summary: str | None = None
    started_at: datetime
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
    updated_at: datetime = Field(default_factory=lambda: datetime.now(UTC))
