from __future__ import annotations

from typing import Annotated, Protocol
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request

from app.agent.verification import VerificationOutcome
from app.domain.incidents import Incident, IncidentStatus
from app.observability.metrics import VERIFICATION_OUTCOMES
from app.storage.audit import AuditEventType, AuditRepository
from app.storage.incidents import IncidentRepository


class Verifier(Protocol):
    async def verify(self, incident: Incident) -> VerificationOutcome: ...


router = APIRouter(tags=["verification"])


def repository_from_request(request: Request) -> IncidentRepository:
    return request.app.state.incident_repository


def audit_from_request(request: Request) -> AuditRepository:
    return request.app.state.audit_repository


def verifier_from_request(request: Request) -> Verifier:
    verifier = request.app.state.verifier
    if verifier is None:
        raise HTTPException(status_code=503, detail="verification dependency is not configured")
    return verifier


RepositoryDependency = Annotated[IncidentRepository, Depends(repository_from_request)]
AuditDependency = Annotated[AuditRepository, Depends(audit_from_request)]
VerifierDependency = Annotated[Verifier, Depends(verifier_from_request)]


@router.post("/incidents/{incident_id}/verify", response_model=VerificationOutcome)
async def verify_incident(
    incident_id: UUID,
    repository: RepositoryDependency,
    audit_repository: AuditDependency,
    verifier: VerifierDependency,
) -> VerificationOutcome:
    incident = repository.get(str(incident_id))
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    if incident.status != IncidentStatus.VERIFYING:
        raise HTTPException(status_code=409, detail="incident is not awaiting verification")

    try:
        outcome = await verifier.verify(incident)
    except Exception as error:  # noqa: BLE001 - 外部指标依赖的统一 HTTP 边界
        VERIFICATION_OUTCOMES.labels(outcome="failed").inc()
        audit_repository.append(
            event_type=AuditEventType.VERIFICATION_FAILED,
            incident_id=incident.id,
            payload={"error_type": type(error).__name__},
        )
        raise HTTPException(
            status_code=503,
            detail="incident verification failed",
        ) from error
    if outcome.resolved:
        repository.update_status(str(incident.id), IncidentStatus.RESOLVED)
    VERIFICATION_OUTCOMES.labels(
        outcome="resolved" if outcome.resolved else "unhealthy"
    ).inc()
    audit_repository.append(
        event_type=AuditEventType.VERIFICATION_COMPLETED,
        incident_id=incident.id,
        payload=outcome.model_dump(mode="json"),
    )
    return outcome
