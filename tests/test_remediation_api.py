from uuid import uuid4

from fastapi.testclient import TestClient

from app.main import create_app
from app.policy.remediation import RemediationExecutor, RemediationPolicy


class FakeRollbackClient:
    async def rollback_deployment(self, *, namespace: str, deployment: str, dry_run: bool) -> str:
        return "ok"


def test_create_proposal_and_approval_endpoints() -> None:
    client = TestClient(create_app())
    incident_id = uuid4()

    proposal = client.post(
        "/remediation/proposals",
        json={
            "incident_id": str(incident_id),
            "action": "rollback_deployment",
            "namespace": "demo",
            "deployment": "checkout",
        },
    )
    proposal_id = proposal.json()["id"]
    approval = client.post(
        f"/remediation/proposals/{proposal_id}/approval",
        json={"approved_by": "operator", "expires_in_minutes": 10},
    )

    assert proposal.status_code == 201
    assert approval.status_code == 201
    assert approval.json()["proposal_id"] == proposal_id


def test_execute_endpoint_is_disabled_without_injected_executor() -> None:
    client = TestClient(create_app())

    response = client.post("/remediation/execute", json={"proposal_id": str(uuid4())})

    assert response.status_code == 503


def test_execute_endpoint_runs_only_with_explicit_executor_and_approval() -> None:
    executor = RemediationExecutor(
        policy=RemediationPolicy(allowed_namespaces={"demo"}), rollback_client=FakeRollbackClient()
    )
    client = TestClient(create_app(remediation_executor=executor))
    incident_id = uuid4()
    proposal = client.post(
        "/remediation/proposals",
        json={
            "incident_id": str(incident_id),
            "action": "rollback_deployment",
            "namespace": "demo",
            "deployment": "checkout",
        },
    ).json()
    approval = client.post(
        f"/remediation/proposals/{proposal['id']}/approval",
        json={"approved_by": "operator", "expires_in_minutes": 10},
    ).json()

    response = client.post(
        "/remediation/execute",
        json={"proposal_id": proposal["id"], "approval_id": approval["id"]},
    )

    assert response.status_code == 200
    assert response.json()["status"] == "executed"
