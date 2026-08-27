from datetime import UTC, datetime, timedelta
from uuid import uuid4

import pytest

from app.policy.remediation import (
    Approval,
    ApprovalExpiredError,
    ApprovalRequiredError,
    PolicyDeniedError,
    RemediationExecutor,
    RemediationPolicy,
    RemediationProposal,
)


class FakeRollbackClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, str, bool]] = []

    async def rollback_deployment(self, *, namespace: str, deployment: str, dry_run: bool) -> str:
        self.calls.append((namespace, deployment, dry_run))
        return "rollback accepted"


def proposal(
    *, action: str = "rollback_deployment", namespace: str = "demo"
) -> RemediationProposal:
    return RemediationProposal(
        incident_id=uuid4(),
        action=action,
        namespace=namespace,
        deployment="checkout",
    )


@pytest.mark.asyncio
async def test_executor_requires_matching_unexpired_approval() -> None:
    now = datetime(2026, 8, 27, 8, 0, tzinfo=UTC)
    request = proposal()
    rollback_client = FakeRollbackClient()
    executor = RemediationExecutor(
        policy=RemediationPolicy(allowed_namespaces={"demo"}), rollback_client=rollback_client
    )

    with pytest.raises(ApprovalRequiredError):
        await executor.execute(request, approval=None, now=now)

    approval = Approval(
        proposal_id=request.id,
        approved_by="on-call@example.com",
        approved_at=now,
        expires_at=now + timedelta(minutes=15),
    )
    result = await executor.execute(request, approval=approval, now=now)

    assert result.status == "executed"
    assert result.message == "rollback accepted"
    assert rollback_client.calls == [("demo", "checkout", False)]


@pytest.mark.asyncio
async def test_executor_rejects_expired_approval_without_calling_cluster() -> None:
    now = datetime(2026, 8, 27, 8, 0, tzinfo=UTC)
    request = proposal()
    rollback_client = FakeRollbackClient()
    executor = RemediationExecutor(
        policy=RemediationPolicy(allowed_namespaces={"demo"}), rollback_client=rollback_client
    )
    approval = Approval(
        proposal_id=request.id,
        approved_by="on-call@example.com",
        approved_at=now - timedelta(minutes=20),
        expires_at=now - timedelta(minutes=5),
    )

    with pytest.raises(ApprovalExpiredError):
        await executor.execute(request, approval=approval, now=now)

    assert rollback_client.calls == []


@pytest.mark.asyncio
async def test_executor_rejects_disallowed_actions_and_namespaces() -> None:
    now = datetime(2026, 8, 27, 8, 0, tzinfo=UTC)
    rollback_client = FakeRollbackClient()
    executor = RemediationExecutor(
        policy=RemediationPolicy(allowed_namespaces={"demo"}), rollback_client=rollback_client
    )

    unsafe = proposal(action="delete_namespace")
    unsafe_approval = Approval(
        proposal_id=unsafe.id,
        approved_by="on-call@example.com",
        approved_at=now,
        expires_at=now + timedelta(minutes=15),
    )
    with pytest.raises(PolicyDeniedError, match="not allowlisted"):
        await executor.execute(unsafe, approval=unsafe_approval, now=now)

    production = proposal(namespace="production")
    production_approval = Approval(
        proposal_id=production.id,
        approved_by="on-call@example.com",
        approved_at=now,
        expires_at=now + timedelta(minutes=15),
    )
    with pytest.raises(PolicyDeniedError, match="not permitted"):
        await executor.execute(production, approval=production_approval, now=now)

    assert rollback_client.calls == []
