from __future__ import annotations

from copy import deepcopy
from datetime import UTC, datetime
from enum import StrEnum
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class AuditEventType(StrEnum):
    ALERT_RECEIVED = "alert.received"
    INCIDENT_CREATED = "incident.created"
    INCIDENT_DEDUPLICATED = "incident.deduplicated"
    DIAGNOSTIC_COMPLETED = "diagnostic.completed"
    ANALYSIS_COMPLETED = "analysis.completed"
    APPROVAL_GRANTED = "approval.granted"
    REMEDIATION_REQUESTED = "remediation.requested"
    REMEDIATION_EXECUTED = "remediation.executed"
    REMEDIATION_REJECTED = "remediation.rejected"
    VERIFICATION_COMPLETED = "verification.completed"


class AuditEvent(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    incident_id: UUID | None = None
    event_type: AuditEventType
    payload: dict[str, object] = Field(default_factory=dict)
    trace_id: str | None = None
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class AuditRepository:
    """带有明确不可变边界的临时审计存储。

    当前实现使用内存列表，下一阶段会替换为 PostgreSQL Repository；调用方
    不应依赖具体存储方式，只依赖 append/list_for_incident 接口。
    """

    def __init__(self) -> None:
        self._events: list[AuditEvent] = []

    def append(
        self,
        *,
        event_type: AuditEventType,
        payload: dict[str, object] | None = None,
        incident_id: UUID | None = None,
        trace_id: str | None = None,
        created_at: datetime | None = None,
    ) -> AuditEvent:
        event = AuditEvent(
            incident_id=incident_id,
            event_type=event_type,
            payload=deepcopy(payload or {}),
            trace_id=trace_id,
            created_at=created_at or datetime.now(UTC),
        )
        self._events.append(event)
        return event

    def list_for_incident(self, incident_id: UUID) -> list[AuditEvent]:
        return [
            event.model_copy(deep=True)
            for event in self._events
            if event.incident_id == incident_id
        ]

    def list_all(self) -> list[AuditEvent]:
        return [event.model_copy(deep=True) for event in self._events]
