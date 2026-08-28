from __future__ import annotations

from threading import RLock
from uuid import UUID

from app.policy.remediation import Approval, RemediationProposal


class RemediationRepository:
    """提案和审批的进程内存储。

    API 只接收 ID，执行时从此存储读取原始对象，避免客户端重新提交可篡改的
    namespace、deployment 或 expires_at。生产环境可替换成关系型 Repository。
    """

    def __init__(self) -> None:
        self._proposals: dict[UUID, RemediationProposal] = {}
        self._approvals: dict[UUID, Approval] = {}
        self._proposal_by_incident: dict[UUID, UUID] = {}
        self._lock = RLock()

    def create_or_get_proposal(
        self, proposal: RemediationProposal
    ) -> tuple[RemediationProposal, bool]:
        with self._lock:
            existing_id = self._proposal_by_incident.get(proposal.incident_id)
            if existing_id is not None:
                return self._proposals[existing_id].model_copy(deep=True), True
            self._proposals[proposal.id] = proposal.model_copy(deep=True)
            self._proposal_by_incident[proposal.incident_id] = proposal.id
            return proposal.model_copy(deep=True), False

    def add_proposal(self, proposal: RemediationProposal) -> RemediationProposal:
        stored, _ = self.create_or_get_proposal(proposal)
        return stored

    def get_proposal(self, proposal_id: UUID) -> RemediationProposal | None:
        proposal = self._proposals.get(proposal_id)
        return proposal.model_copy(deep=True) if proposal else None

    def add_approval(self, approval: Approval) -> Approval:
        self._approvals[approval.id] = approval.model_copy(deep=True)
        return approval.model_copy(deep=True)

    def get_approval(self, approval_id: UUID) -> Approval | None:
        approval = self._approvals.get(approval_id)
        return approval.model_copy(deep=True) if approval else None
