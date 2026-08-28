from uuid import uuid4

from app.policy.remediation import RemediationProposal
from app.storage.remediation import RemediationRepository


def test_remediation_repository_returns_copies() -> None:
    repository = RemediationRepository()
    proposal = RemediationProposal(
        incident_id=uuid4(), action="rollback_deployment", namespace="demo", deployment="checkout"
    )
    repository.add_proposal(proposal)
    loaded = repository.get_proposal(proposal.id)
    loaded.deployment = "modified"

    assert repository.get_proposal(proposal.id).deployment == "checkout"
