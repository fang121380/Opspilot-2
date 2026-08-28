from __future__ import annotations

from datetime import UTC, datetime, timedelta
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.policy.remediation import (
    Approval,
    ApprovalExpiredError,
    ApprovalRequiredError,
    ExecutionResult,
    PolicyDeniedError,
    RemediationExecutor,
    RemediationProposal,
)
from app.storage.audit import AuditEventType, AuditRepository
from app.storage.remediation import RemediationRepository

router = APIRouter(tags=["remediation"])


class CreateProposalRequest(BaseModel):
    incident_id: UUID
    action: str
    namespace: str
    deployment: str


class ApprovalRequest(BaseModel):
    approved_by: str
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


AuditDependency = Annotated[AuditRepository, Depends(audit_from_request)]
ExecutorDependency = Annotated[RemediationExecutor | None, Depends(executor_from_request)]
RepositoryDependency = Annotated[RemediationRepository, Depends(repository_from_request)]


@router.post("/remediation/proposals", response_model=RemediationProposal, status_code=201)
async def create_proposal(
    payload: CreateProposalRequest,
    audit_repository: AuditDependency,
    repository: RepositoryDependency,
) -> RemediationProposal:
    proposal = RemediationProposal(**payload.model_dump())
    repository.add_proposal(proposal)
    audit_repository.append(
        event_type=AuditEventType.REMEDIATION_REQUESTED,
        incident_id=proposal.incident_id,
        payload=proposal.model_dump(mode="json"),
    )
    return proposal


@router.post(
    "/remediation/proposals/{proposal_id}/approval", response_model=Approval, status_code=201
)
async def approve_proposal(
    proposal_id: UUID,
    payload: ApprovalRequest,
    audit_repository: AuditDependency,
    repository: RepositoryDependency,
) -> Approval:
    if repository.get_proposal(proposal_id) is None:
        raise HTTPException(status_code=404, detail="remediation proposal not found")
    if not payload.approved_by.strip():
        raise HTTPException(status_code=422, detail="approved_by must not be empty")
    if not 1 <= payload.expires_in_minutes <= 60:
        raise HTTPException(status_code=422, detail="expires_in_minutes must be between 1 and 60")
    now = datetime.now(UTC)
    approval = Approval(
        proposal_id=proposal_id,
        approved_by=payload.approved_by,
        approved_at=now,
        expires_at=now + timedelta(minutes=payload.expires_in_minutes),
    )
    repository.add_approval(approval)
    audit_repository.append(
        event_type=AuditEventType.APPROVAL_GRANTED,
        payload=approval.model_dump(mode="json"),
    )
    return approval


@router.post("/remediation/execute", response_model=ExecutionResult)
async def execute_remediation(
    request: ExecuteRequest,
    executor: ExecutorDependency = None,
    repository: RepositoryDependency = None,
) -> ExecutionResult:
    if executor is None:
        raise HTTPException(status_code=503, detail="remediation executor is not configured")
    proposal = repository.get_proposal(request.proposal_id)
    if proposal is None:
        raise HTTPException(status_code=404, detail="remediation proposal not found")
    approval = repository.get_approval(request.approval_id) if request.approval_id else None
    if request.approval_id and approval is None:
        raise HTTPException(status_code=404, detail="remediation approval not found")
    try:
        return await executor.execute(proposal, approval=approval)
    except (PolicyDeniedError, ApprovalRequiredError, ApprovalExpiredError) as error:
        raise HTTPException(status_code=403, detail=str(error)) from error
