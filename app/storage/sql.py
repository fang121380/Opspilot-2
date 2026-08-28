from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, create_engine, select
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)

from app.domain.incidents import Incident, IncidentStatus
from app.storage.audit import AuditEvent, AuditEventType


class Base(DeclarativeBase):
    pass


class IncidentRow(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    alert_name: Mapped[str] = mapped_column(String(255), nullable=False)
    alert_fingerprint: Mapped[str] = mapped_column(String(255), unique=True, nullable=False)
    service: Mapped[str | None] = mapped_column(String(255))
    namespace: Mapped[str | None] = mapped_column(String(255))
    severity: Mapped[str] = mapped_column(String(32), nullable=False)
    summary: Mapped[str | None] = mapped_column(Text)
    started_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    audit_events: Mapped[list[AuditRow]] = relationship(back_populates="incident")


class AuditRow(Base):
    __tablename__ = "audit_events"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    incident_id: Mapped[str | None] = mapped_column(ForeignKey("incidents.id"))
    event_type: Mapped[str] = mapped_column(String(64), nullable=False)
    payload_json: Mapped[str] = mapped_column(Text, nullable=False)
    trace_id: Mapped[str | None] = mapped_column(String(64))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    incident: Mapped[IncidentRow | None] = relationship(back_populates="audit_events")


class SqlAlchemyStore:
    """关系型 Incident/Audit 存储，SQLite 和 PostgreSQL 均可使用。

    当前 API 仍然采用同步 Repository 接口；FastAPI 部署时应将数据库操作移到
    线程池或改为异步 Session。这个实现先保证事务语义和数据模型可验证。
    """

    def __init__(self, database_url: str, *, create_schema: bool = True) -> None:
        self._engine = create_engine(database_url, future=True)
        self._sessions = sessionmaker(self._engine, expire_on_commit=False)
        if create_schema:
            Base.metadata.create_all(self._engine)

    def create_or_get_active(self, incident: Incident) -> tuple[Incident, bool]:
        with self._sessions.begin() as session:
            existing = session.scalar(
                select(IncidentRow).where(
                    IncidentRow.alert_fingerprint == incident.alert_fingerprint
                )
            )
            if existing is not None:
                return self._to_incident(existing), True
            row = self._incident_row(incident)
            session.add(row)
            return incident, False

    def list(self) -> list[Incident]:
        with self._sessions() as session:
            rows = session.scalars(select(IncidentRow).order_by(IncidentRow.created_at)).all()
            return [self._to_incident(row) for row in rows]

    def get(self, incident_id: str) -> Incident | None:
        with self._sessions() as session:
            row = session.get(IncidentRow, incident_id)
            return self._to_incident(row) if row is not None else None

    def append_audit(
        self,
        *,
        event_type: AuditEventType,
        payload: dict[str, object] | None = None,
        incident_id: UUID | None = None,
        trace_id: str | None = None,
        created_at: datetime | None = None,
    ) -> AuditEvent:
        import json

        event = AuditEvent(
            incident_id=incident_id,
            event_type=event_type,
            payload=payload or {},
            trace_id=trace_id,
            created_at=created_at or datetime.now(UTC),
        )
        with self._sessions.begin() as session:
            session.add(
                AuditRow(
                    id=str(event.id),
                    incident_id=str(incident_id) if incident_id else None,
                    event_type=event.event_type.value,
                    payload_json=json.dumps(event.payload, default=str),
                    trace_id=event.trace_id,
                    created_at=event.created_at,
                )
            )
        return event

    def append(self, **kwargs: object) -> AuditEvent:
        """兼容内存 AuditRepository 的接口，便于 API 工厂统一注入。"""

        return self.append_audit(**kwargs)  # type: ignore[arg-type]

    def list_audit(self, incident_id: UUID) -> list[AuditEvent]:
        import json

        with self._sessions() as session:
            rows = session.scalars(
                select(AuditRow)
                .where(AuditRow.incident_id == str(incident_id))
                .order_by(AuditRow.created_at)
            ).all()
            return [
                AuditEvent(
                    id=UUID(row.id),
                    incident_id=UUID(row.incident_id) if row.incident_id else None,
                    event_type=AuditEventType(row.event_type),
                    payload=json.loads(row.payload_json),
                    trace_id=row.trace_id,
                    created_at=row.created_at.replace(tzinfo=UTC)
                    if row.created_at.tzinfo is None
                    else row.created_at,
                )
                for row in rows
            ]

    def list_for_incident(self, incident_id: UUID) -> list[AuditEvent]:
        return self.list_audit(incident_id)

    @staticmethod
    def _incident_row(incident: Incident) -> IncidentRow:
        return IncidentRow(
            id=str(incident.id),
            status=incident.status.value,
            alert_name=incident.alert_name,
            alert_fingerprint=incident.alert_fingerprint,
            service=incident.service,
            namespace=incident.namespace,
            severity=incident.severity,
            summary=incident.summary,
            started_at=incident.started_at,
            created_at=incident.created_at,
            updated_at=incident.updated_at,
        )

    @staticmethod
    def _to_incident(row: IncidentRow) -> Incident:
        return Incident(
            id=UUID(row.id),
            status=IncidentStatus(row.status),
            alert_name=row.alert_name,
            alert_fingerprint=row.alert_fingerprint,
            service=row.service,
            namespace=row.namespace,
            severity=row.severity,
            summary=row.summary,
            started_at=row.started_at.replace(tzinfo=UTC)
            if row.started_at.tzinfo is None
            else row.started_at,
            created_at=row.created_at.replace(tzinfo=UTC)
            if row.created_at.tzinfo is None
            else row.created_at,
            updated_at=row.updated_at.replace(tzinfo=UTC)
            if row.updated_at.tzinfo is None
            else row.updated_at,
        )
