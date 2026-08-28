from types import SimpleNamespace
from uuid import uuid4

import pytest

from app.config import Settings
from app.main import runtime_remediation_executor
from app.policy.remediation import Approval, PolicyDeniedError, RemediationProposal


def test_remediation_namespaces_discards_empty_entries() -> None:
    settings = Settings(allowed_remediation_namespaces=" demo, staging, ,demo ")

    assert settings.remediation_namespaces() == {"demo", "staging"}


@pytest.mark.asyncio
async def test_runtime_executor_enforces_configured_namespace_before_kubernetes_call() -> None:
    executor = runtime_remediation_executor(SimpleNamespace(), {"demo"})
    proposal = RemediationProposal(
        incident_id=uuid4(),
        action="rollback_deployment",
        namespace="production",
        deployment="checkout",
    )
    approval = Approval(
        proposal_id=proposal.id,
        approved_by="operator@example.com",
        approved_at=proposal.created_at,
        expires_at=proposal.created_at.replace(year=proposal.created_at.year + 1),
    )

    with pytest.raises(PolicyDeniedError, match="not permitted"):
        await executor.execute(proposal, approval=approval)
