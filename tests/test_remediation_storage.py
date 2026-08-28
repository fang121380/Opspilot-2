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


def test_remediation_repository_deduplicates_proposals_by_incident() -> None:
    repository = RemediationRepository()
    first = RemediationProposal(
        incident_id=uuid4(), action="rollback_deployment", namespace="demo", deployment="checkout"
    )
    second = first.model_copy(update={"id": uuid4()})

    stored_first, first_duplicate = repository.create_or_get_proposal(first)
    stored_second, second_duplicate = repository.create_or_get_proposal(second)

    assert first_duplicate is False
    assert second_duplicate is True
    assert stored_second.id == stored_first.id
