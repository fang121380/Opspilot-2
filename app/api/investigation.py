from __future__ import annotations

from typing import Annotated, Protocol
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel

from app.agent.analysis import AnalysisOutcome
from app.domain.incidents import Incident, IncidentStatus
from app.observability.metrics import INVESTIGATION_OUTCOMES, INVESTIGATIONS_STARTED
from app.storage.audit import AuditEventType, AuditRepository
from app.storage.incidents import IncidentRepository


class Investigator(Protocol):
    async def investigate(self, incident: Incident) -> AnalysisOutcome: ...


class InvestigationResponse(BaseModel):
    incident: Incident
    analysis: AnalysisOutcome


router = APIRouter(tags=["investigation"])


def repository_from_request(request: Request) -> IncidentRepository:
    return request.app.state.incident_repository


def investigator_from_request(request: Request) -> Investigator:
    investigator = request.app.state.investigator
    if investigator is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="investigation dependencies are not configured",
        )
    return investigator


def audit_from_request(request: Request) -> AuditRepository:
    return request.app.state.audit_repository


RepositoryDependency = Annotated[IncidentRepository, Depends(repository_from_request)]
InvestigatorDependency = Annotated[Investigator, Depends(investigator_from_request)]
AuditDependency = Annotated[AuditRepository, Depends(audit_from_request)]


@router.post("/incidents/{incident_id}/investigate", response_model=InvestigationResponse)
async def investigate_incident(
    incident_id: UUID,
    repository: RepositoryDependency,
    investigator: InvestigatorDependency,
    audit_repository: AuditDependency,
) -> InvestigationResponse:
    incident = repository.get(str(incident_id))
    if incident is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="incident not found")
    if incident.status != IncidentStatus.RECEIVED:
        raise HTTPException(
            status_code=409,
            detail=f"incident cannot be investigated from status {incident.status.value}",
        )

    incident = repository.transition_status(
        str(incident_id),
        expected=IncidentStatus.RECEIVED,
        target=IncidentStatus.INVESTIGATING,
    )
    if incident is None:
        raise HTTPException(status_code=409, detail="incident status changed; retry request")
    INVESTIGATIONS_STARTED.inc()
    try:
        analysis = await investigator.investigate(incident)
    except Exception as error:  # noqa: BLE001 - 外部调查依赖的统一 HTTP 边界
        INVESTIGATION_OUTCOMES.labels(outcome="failed").inc()
        audit_repository.append(
            event_type=AuditEventType.DIAGNOSTIC_FAILED,
            incident_id=incident.id,
            payload={"error_type": type(error).__name__},
        )
        repository.transition_status(
            str(incident_id),
            expected=IncidentStatus.INVESTIGATING,
            target=IncidentStatus.RECEIVED,
        )
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="incident investigation failed",
        ) from error
    if analysis.recommended_actions:
        transitioned = repository.transition_status(
            str(incident_id),
            expected=IncidentStatus.INVESTIGATING,
            target=IncidentStatus.AWAITING_APPROVAL,
        )
        if transitioned is None:
            raise HTTPException(
                status_code=409,
                detail="incident status changed during investigation",
            )
        incident = transitioned
    else:
        transitioned = repository.transition_status(
            str(incident_id),
            expected=IncidentStatus.INVESTIGATING,
            target=IncidentStatus.RECEIVED,
        )
        if transitioned is None:
            raise HTTPException(
                status_code=409,
                detail="incident status changed during investigation",
            )
        incident = transitioned
    INVESTIGATION_OUTCOMES.labels(
        outcome="recommended" if analysis.recommended_actions else "no_action"
    ).inc()
    return InvestigationResponse(incident=incident, analysis=analysis)
