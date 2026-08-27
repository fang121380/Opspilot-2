from __future__ import annotations

from datetime import UTC, datetime
from typing import Protocol
from uuid import UUID, uuid4

from pydantic import BaseModel, Field


class PolicyDeniedError(PermissionError):
    """Raised when an action is outside Opspilot 2's explicit remediation policy."""


class ApprovalRequiredError(PermissionError):
    """Raised when a mutation has not been explicitly approved."""


class ApprovalExpiredError(PermissionError):
    """Raised when an otherwise valid approval is no longer active."""


class RemediationProposal(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    incident_id: UUID
    action: str
    namespace: str
    deployment: str
    created_at: datetime = Field(default_factory=lambda: datetime.now(UTC))


class Approval(BaseModel):
    id: UUID = Field(default_factory=uuid4)
    proposal_id: UUID
    approved_by: str
    approved_at: datetime
    expires_at: datetime


class ExecutionResult(BaseModel):
    proposal_id: UUID
    status: str
    message: str
    executed_at: datetime


class RollbackClient(Protocol):
    async def rollback_deployment(
        self, *, namespace: str, deployment: str, dry_run: bool
    ) -> str: ...


class RemediationPolicy:
    """An intentionally narrow policy for the first incident-response scenario."""

    allowed_actions = frozenset({"rollback_deployment"})

    def __init__(self, *, allowed_namespaces: set[str]) -> None:
        self._allowed_namespaces = frozenset(allowed_namespaces)

    def authorize(self, proposal: RemediationProposal) -> None:
        if proposal.action not in self.allowed_actions:
            raise PolicyDeniedError(f"action {proposal.action!r} is not allowlisted")
        if proposal.namespace not in self._allowed_namespaces:
            raise PolicyDeniedError(f"namespace {proposal.namespace!r} is not permitted")


class RemediationExecutor:
    """Runs one allowlisted operation only after policy and approval validation."""

    def __init__(self, *, policy: RemediationPolicy, rollback_client: RollbackClient) -> None:
        self._policy = policy
        self._rollback_client = rollback_client

    async def execute(
        self,
        proposal: RemediationProposal,
        *,
        approval: Approval | None,
        now: datetime | None = None,
    ) -> ExecutionResult:
        self._policy.authorize(proposal)
        if approval is None or approval.proposal_id != proposal.id:
            raise ApprovalRequiredError("a matching approval is required before execution")

        execution_time = now or datetime.now(UTC)
        if approval.expires_at <= execution_time:
            raise ApprovalExpiredError("approval has expired")

        message = await self._rollback_client.rollback_deployment(
            namespace=proposal.namespace, deployment=proposal.deployment, dry_run=False
        )
        return ExecutionResult(
            proposal_id=proposal.id,
            status="executed",
            message=message,
            executed_at=execution_time,
        )
