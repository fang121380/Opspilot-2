from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from pydantic import BaseModel, ConfigDict, field_validator

from app.domain.incidents import IncidentStatus
from app.domain.kubernetes import is_dns_label
from app.observability.metrics import REMEDIATION_OUTCOMES
from app.policy.remediation import (
    Approval,
    ApprovalExpiredError,
    ApprovalRequiredError,
    ExecutionResult,
    PolicyDeniedError,
    RemediationExecutor,
    RemediationProposal,
)
from app.security.auth import (
    AuthenticatedPrincipal,
    BearerAuthenticationError,
    BearerTokenAuthenticator,
)
from app.storage.audit import AuditEventType, AuditRepository
from app.storage.incidents import IncidentRepository
from app.storage.remediation import RemediationRepository

router = APIRouter(tags=["remediation"])


class CreateProposalRequest(BaseModel):
    incident_id: UUID
    action: str
    namespace: str
    deployment: str

    @field_validator("namespace", "deployment")
    @classmethod
    def requires_bounded_kubernetes_name(cls, value: str) -> str:
        if not is_dns_label(value):
            raise ValueError("must be a Kubernetes DNS label")
        return value


class ApprovalRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    expires_in_minutes: int = 15


class ExecuteRequest(BaseModel):
    proposal_id: UUID
    approval_id: UUID | None = None


def audit_from_request(request: Request) -> AuditRepository:
    return request.app.state.audit_repository


def executor_from_request(request: Request) -> RemediationExecutor | None:
    return request.app.state.remediation_executor


def repository_from_request(request: Request) -> RemediationRepository:
    return request.app.state.remediation_repository


def incident_repository_from_request(request: Request) -> IncidentRepository:
    return request.app.state.incident_repository


def operator_from_request(
    request: Request,
    authorization: Annotated[str | None, Header()] = None,
) -> AuthenticatedPrincipal:
    authenticator: BearerTokenAuthenticator | None = request.app.state.operator_authenticator
    if authenticator is None:
        raise HTTPException(status_code=503, detail="operator authentication is not configured")
    try:
        return authenticator.authenticate(authorization)
    except BearerAuthenticationError as error:
        raise HTTPException(
            status_code=401,
            detail=str(error),
            headers={"WWW-Authenticate": "Bearer"},
        ) from error


AuditDependency = Annotated[AuditRepository, Depends(audit_from_request)]
ExecutorDependency = Annotated[RemediationExecutor | None, Depends(executor_from_request)]
RepositoryDependency = Annotated[RemediationRepository, Depends(repository_from_request)]
IncidentRepositoryDependency = Annotated[
    IncidentRepository, Depends(incident_repository_from_request)
]
OperatorDependency = Annotated[AuthenticatedPrincipal, Depends(operator_from_request)]


@router.post("/remediation/proposals", response_model=RemediationProposal, status_code=201)
async def create_proposal(
    payload: CreateProposalRequest,
    audit_repository: AuditDependency,
    repository: RepositoryDependency,
    incident_repository: IncidentRepositoryDependency,
) -> RemediationProposal:
    incident = incident_repository.get(str(payload.incident_id))
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    if payload.namespace != incident.namespace or payload.deployment != incident.service:
        raise HTTPException(status_code=409, detail="proposal scope does not match incident")
    if incident.status not in {
        IncidentStatus.RECEIVED,
        IncidentStatus.AWAITING_APPROVAL,
    }:
        raise HTTPException(
            status_code=409,
            detail=f"incident cannot accept a proposal from status {incident.status.value}",
        )
    transitioned = incident_repository.transition_status(
        str(payload.incident_id),
        expected=incident.status,
        target=IncidentStatus.AWAITING_APPROVAL,
    )
    if transitioned is None:
        raise HTTPException(status_code=409, detail="incident status changed; retry request")
    proposal = RemediationProposal(**payload.model_dump())
    repository.add_proposal(proposal)
    audit_repository.append(
        event_type=AuditEventType.REMEDIATION_REQUESTED,
        incident_id=proposal.incident_id,
        payload=proposal.model_dump(mode="json"),
    )
    return proposal


@router.get("/remediation/proposals/{proposal_id}", response_model=RemediationProposal)
async def get_proposal(proposal_id: UUID, repository: RepositoryDependency) -> RemediationProposal:
    proposal = repository.get_proposal(proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="remediation proposal not found")
    return proposal


@router.post(
    "/remediation/proposals/{proposal_id}/approval", response_model=Approval, status_code=201
)
async def approve_proposal(
    proposal_id: UUID,
    payload: ApprovalRequest,
    audit_repository: AuditDependency,
    repository: RepositoryDependency,
    operator: OperatorDependency,
) -> Approval:
    proposal = repository.get_proposal(proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="remediation proposal not found")
    if not 1 <= payload.expires_in_minutes <= 60:
        raise HTTPException(status_code=422, detail="expires_in_minutes must be between 1 and 60")
    now = datetime.now(UTC)
    approval = Approval(
        proposal_id=proposal_id,
        approved_by=operator.subject,
        approved_at=now,
        expires_at=now + timedelta(minutes=payload.expires_in_minutes),
    )
    repository.add_approval(approval)
    audit_repository.append(
        event_type=AuditEventType.APPROVAL_GRANTED,
        incident_id=proposal.incident_id,
        payload=approval.model_dump(mode="json"),
    )
    return approval


@router.get("/remediation/approvals/{approval_id}", response_model=Approval)
async def get_approval(approval_id: UUID, repository: RepositoryDependency) -> Approval:
    approval = repository.get_approval(approval_id)
    if approval is None:
        raise HTTPException(status_code=404, detail="remediation approval not found")
    return approval


@router.post("/remediation/execute", response_model=ExecutionResult)
async def execute_remediation(
    request: ExecuteRequest,
    operator: OperatorDependency,
    executor: ExecutorDependency = None,
    repository: RepositoryDependency = None,
    audit_repository: AuditDependency = None,
    incident_repository: IncidentRepositoryDependency = None,
) -> ExecutionResult:
    if executor is None:
        raise HTTPException(status_code=503, detail="remediation executor is not configured")
    proposal = repository.get_proposal(request.proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="remediation proposal not found")
    approval = repository.get_approval(request.approval_id) if request.approval_id else None
    if request.approval_id and approval is None:
        raise HTTPException(status_code=404, detail="remediation approval not found")
    if approval is not None and approval.approved_by != operator.subject:
        raise HTTPException(status_code=403, detail="approval belongs to a different operator")
    if incident_repository.get(str(proposal.incident_id)) is None:
        raise HTTPException(status_code=404, detail="incident not found")
    claimed = incident_repository.transition_status(
        str(proposal.incident_id),
        expected=IncidentStatus.AWAITING_APPROVAL,
        target=IncidentStatus.EXECUTING,
    )
    if claimed is None:
        incident = incident_repository.get(str(proposal.incident_id))
        REMEDIATION_OUTCOMES.labels(outcome="blocked").inc()
        raise HTTPException(
            status_code=409,
            detail=(
                "incident cannot execute remediation from status "
                f"{incident.status.value if incident else 'unknown'}"
            ),
        )
    try:
        result = await executor.execute(proposal, approval=approval)
        transitioned = incident_repository.transition_status(
            str(proposal.incident_id),
            expected=IncidentStatus.EXECUTING,
            target=IncidentStatus.VERIFYING,
        )
        if transitioned is None:
            raise RuntimeError("incident execution claim was lost")
        REMEDIATION_OUTCOMES.labels(outcome="executed").inc()
        audit_repository.append(
            event_type=AuditEventType.REMEDIATION_EXECUTED,
            incident_id=proposal.incident_id,
            payload=result.model_dump(mode="json"),
        )
        return result
    except (PolicyDeniedError, ApprovalRequiredError, ApprovalExpiredError) as error:
        REMEDIATION_OUTCOMES.labels(outcome="rejected").inc()
        incident_repository.transition_status(
            str(proposal.incident_id),
            expected=IncidentStatus.EXECUTING,
            target=IncidentStatus.AWAITING_APPROVAL,
        )
        audit_repository.append(
            event_type=AuditEventType.REMEDIATION_REJECTED,
            incident_id=proposal.incident_id,
            payload={"reason": str(error)},
        )
        raise HTTPException(status_code=403, detail=str(error)) from error
    except Exception as error:  # noqa: BLE001 - 写操作结果未知时必须保守停留
        REMEDIATION_OUTCOMES.labels(outcome="failed").inc()
        audit_repository.append(
            event_type=AuditEventType.REMEDIATION_FAILED,
            incident_id=proposal.incident_id,
            payload={"error_type": type(error).__name__, "outcome": "unknown"},
        )
        raise HTTPException(
            status_code=503,
            detail="remediation outcome is unknown; manual review is required",
        ) from error
