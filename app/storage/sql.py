from __future__ import annotations

from datetime import UTC, datetime
from uuid import UUID

from sqlalchemy import DateTime, ForeignKey, String, Text, create_engine, select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import (
    DeclarativeBase,
    Mapped,
    mapped_column,
    relationship,
    sessionmaker,
)

from app.domain.incidents import Incident, IncidentStatus
from app.domain.jobs import InvestigationJob, JobStatus
from app.policy.remediation import Approval, RemediationProposal
from app.storage.audit import AuditEvent, AuditEventType


class Base(DeclarativeBase):
    pass


class IncidentRow(Base):
    __tablename__ = "incidents"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    alert_name: Mapped[str] = mapped_column(String(255), nullable=False)
    alert_fingerprint: Mapped[str] = mapped_column(String(255), index=True, nullable=False)
    active_fingerprint: Mapped[str | None] = mapped_column(
        String(255), unique=True, nullable=True
    )
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


class RemediationProposalRow(Base):
    __tablename__ = "remediation_proposals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), nullable=False)
    action: Mapped[str] = mapped_column(String(64), nullable=False)
    namespace: Mapped[str] = mapped_column(String(255), nullable=False)
    deployment: Mapped[str] = mapped_column(String(255), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class ApprovalRow(Base):
    __tablename__ = "remediation_approvals"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    proposal_id: Mapped[str] = mapped_column(ForeignKey("remediation_proposals.id"), nullable=False)
    approved_by: Mapped[str] = mapped_column(String(255), nullable=False)
    approved_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)


class InvestigationJobRow(Base):
    __tablename__ = "investigation_jobs"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    incident_id: Mapped[str] = mapped_column(ForeignKey("incidents.id"), nullable=False)
    active_incident_id: Mapped[str | None] = mapped_column(
        String(36), unique=True, nullable=True
    )
    status: Mapped[str] = mapped_column(String(32), nullable=False)
    analysis_json: Mapped[str | None] = mapped_column(Text)
    error: Mapped[str | None] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    finished_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True))


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
        try:
            with self._sessions.begin() as session:
                existing = session.scalar(
                    select(IncidentRow).where(
                        IncidentRow.active_fingerprint == incident.alert_fingerprint,
                    )
                )
                if existing is not None:
                    return self._to_incident(existing), True
                session.add(self._incident_row(incident))
                session.flush()
        except IntegrityError:
            # A concurrent transaction may insert the same active fingerprint
            # after the lookup. The unique constraint selects the winner.
            with self._sessions() as session:
                existing = session.scalar(
                    select(IncidentRow).where(
                        IncidentRow.active_fingerprint == incident.alert_fingerprint,
                    )
                )
                if existing is None:
                    raise
                return self._to_incident(existing), True
        return incident, False

    def list(self) -> list[Incident]:
        with self._sessions() as session:
            rows = session.scalars(select(IncidentRow).order_by(IncidentRow.created_at)).all()
            return [self._to_incident(row) for row in rows]

    def get(self, incident_id: str) -> Incident | None:
        with self._sessions() as session:
            row = session.get(IncidentRow, incident_id)
            return self._to_incident(row) if row is not None else None

    def update_status(self, incident_id: str, status: IncidentStatus) -> Incident:
        with self._sessions.begin() as session:
            row = session.get(IncidentRow, incident_id)
            if row is None:
                raise KeyError(incident_id)
            row.status = status.value
            row.updated_at = datetime.now(UTC)
            row.active_fingerprint = (
                None
                if status in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}
                else row.alert_fingerprint
            )
            session.flush()
            return self._to_incident(row)

    def transition_status(
        self,
        incident_id: str,
        *,
        expected: IncidentStatus,
        target: IncidentStatus,
    ) -> Incident | None:
        """Atomically claim one workflow transition across processes."""

        with self._sessions.begin() as session:
            result = session.execute(
                update(IncidentRow)
                .where(
                    IncidentRow.id == incident_id,
                    IncidentRow.status == expected.value,
                )
                .values(
                    status=target.value,
                    updated_at=datetime.now(UTC),
                    active_fingerprint=(
                        None
                        if target in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}
                        else IncidentRow.alert_fingerprint
                    ),
                )
                .execution_options(synchronize_session=False)
            )
            if result.rowcount == 0:
                return None
            row = session.get(IncidentRow, incident_id)
            if row is None:  # pragma: no cover - protected by the successful update
                raise KeyError(incident_id)
            return self._to_incident(row)

    def close(self, incident_id: str) -> None:
        self.update_status(incident_id, IncidentStatus.CLOSED)

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

    def add_proposal(self, proposal: RemediationProposal) -> RemediationProposal:
        with self._sessions.begin() as session:
            session.merge(
                RemediationProposalRow(
                    id=str(proposal.id),
                    incident_id=str(proposal.incident_id),
                    action=proposal.action,
                    namespace=proposal.namespace,
                    deployment=proposal.deployment,
                    created_at=proposal.created_at,
                )
            )
        return proposal.model_copy(deep=True)

    def get_proposal(self, proposal_id: UUID) -> RemediationProposal | None:
        with self._sessions() as session:
            row = session.get(RemediationProposalRow, str(proposal_id))
            if row is None:
                return None
            return RemediationProposal(
                id=UUID(row.id),
                incident_id=UUID(row.incident_id),
                action=row.action,
                namespace=row.namespace,
                deployment=row.deployment,
                created_at=self._utc(row.created_at),
            )

    def add_approval(self, approval: Approval) -> Approval:
        with self._sessions.begin() as session:
            session.merge(
                ApprovalRow(
                    id=str(approval.id),
                    proposal_id=str(approval.proposal_id),
                    approved_by=approval.approved_by,
                    approved_at=approval.approved_at,
                    expires_at=approval.expires_at,
                )
            )
        return approval.model_copy(deep=True)

    def get_approval(self, approval_id: UUID) -> Approval | None:
        with self._sessions() as session:
            row = session.get(ApprovalRow, str(approval_id))
            if row is None:
                return None
            return Approval(
                id=UUID(row.id),
                proposal_id=UUID(row.proposal_id),
                approved_by=row.approved_by,
                approved_at=self._utc(row.approved_at),
                expires_at=self._utc(row.expires_at),
            )

    def create_or_get_active_job(
        self, job: InvestigationJob
    ) -> tuple[InvestigationJob, bool]:
        try:
            with self._sessions.begin() as session:
                existing = session.scalar(
                    select(InvestigationJobRow).where(
                        InvestigationJobRow.active_incident_id == str(job.incident_id)
                    )
                )
                if existing is not None:
                    return self._to_job(existing), True
                session.add(self._job_row(job))
                session.flush()
        except IntegrityError:
            with self._sessions() as session:
                existing = session.scalar(
                    select(InvestigationJobRow).where(
                        InvestigationJobRow.active_incident_id == str(job.incident_id)
                    )
                )
                if existing is None:
                    raise
                return self._to_job(existing), True
        return job.model_copy(deep=True), False

    def update_job(self, job: InvestigationJob) -> InvestigationJob:
        with self._sessions.begin() as session:
            row = session.get(InvestigationJobRow, str(job.id))
            if row is None:
                raise KeyError(str(job.id))
            row.status = job.status.value
            row.active_incident_id = (
                None
                if job.status in {JobStatus.SUCCEEDED, JobStatus.FAILED}
                else str(job.incident_id)
            )
            row.analysis_json = job.analysis.model_dump_json() if job.analysis else None
            row.error = job.error
            row.finished_at = job.finished_at
        return job.model_copy(deep=True)

    def get_job(self, job_id: UUID) -> InvestigationJob | None:
        with self._sessions() as session:
            row = session.get(InvestigationJobRow, str(job_id))
            if row is None:
                return None
            return self._to_job(row)

    @staticmethod
    def _incident_row(incident: Incident) -> IncidentRow:
        return IncidentRow(
            id=str(incident.id),
            status=incident.status.value,
            alert_name=incident.alert_name,
            alert_fingerprint=incident.alert_fingerprint,
            active_fingerprint=(
                None
                if incident.status in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}
                else incident.alert_fingerprint
            ),
            service=incident.service,
            namespace=incident.namespace,
            severity=incident.severity,
            summary=incident.summary,
            started_at=incident.started_at,
            created_at=incident.created_at,
            updated_at=incident.updated_at,
        )

    @staticmethod
    def _job_row(job: InvestigationJob) -> InvestigationJobRow:
        return InvestigationJobRow(
            id=str(job.id),
            incident_id=str(job.incident_id),
            active_incident_id=(
                None
                if job.status in {JobStatus.SUCCEEDED, JobStatus.FAILED}
                else str(job.incident_id)
            ),
            status=job.status.value,
            analysis_json=job.analysis.model_dump_json() if job.analysis else None,
            error=job.error,
            created_at=job.created_at,
            finished_at=job.finished_at,
        )

    @staticmethod
    def _to_job(row: InvestigationJobRow) -> InvestigationJob:
        from app.agent.analysis import AnalysisOutcome

        return InvestigationJob(
            id=UUID(row.id),
            incident_id=UUID(row.incident_id),
            status=JobStatus(row.status),
            analysis=(
                AnalysisOutcome.model_validate_json(row.analysis_json)
                if row.analysis_json
                else None
            ),
            error=row.error,
            created_at=SqlAlchemyStore._utc(row.created_at),
            finished_at=(
                SqlAlchemyStore._utc(row.finished_at) if row.finished_at else None
            ),
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
            started_at=SqlAlchemyStore._utc(row.started_at),
            created_at=SqlAlchemyStore._utc(row.created_at),
            updated_at=SqlAlchemyStore._utc(row.updated_at),
        )

    @staticmethod
    def _utc(value: datetime) -> datetime:
        return value.replace(tzinfo=UTC) if value.tzinfo is None else value
