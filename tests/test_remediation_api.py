from datetime import UTC, datetime
from uuid import UUID, uuid4

from fastapi.testclient import TestClient

from app.domain.incidents import Incident
from app.main import create_app
from app.policy.remediation import RemediationExecutor, RemediationPolicy
from app.storage.incidents import IncidentRepository


class FakeRollbackClient:
    async def rollback_deployment(self, *, namespace: str, deployment: str, dry_run: bool) -> str:
        return "ok"


def app_with_incident(
    incident_id: UUID, *, remediation_executor: RemediationExecutor | None = None
):
    repository = IncidentRepository()
    repository.create_or_get_active(
        Incident(
            id=incident_id,
            alert_name="HighErrorRate",
            alert_fingerprint=f"test:{incident_id}",
            service="checkout",
            namespace="demo",
            started_at=datetime.now(UTC),
        )
    )
    return create_app(
        incident_repository=repository, remediation_executor=remediation_executor
    )


def test_create_proposal_and_approval_endpoints() -> None:
    incident_id = uuid4()
    client = TestClient(app_with_incident(incident_id))

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
    assert client.get(f"/remediation/proposals/{proposal_id}").status_code == 200
    assert client.get(f"/remediation/approvals/{approval.json()['id']}").status_code == 200
    assert client.get("/incidents").json()[0]["status"] == "awaiting_approval"


def test_approval_rejects_unknown_proposal() -> None:
    client = TestClient(create_app())

    response = client.post(
        f"/remediation/proposals/{uuid4()}/approval",
        json={"approved_by": "operator", "expires_in_minutes": 10},
    )

    assert response.status_code == 404


def test_create_proposal_rejects_unknown_incident() -> None:
    client = TestClient(create_app())

    response = client.post(
        "/remediation/proposals",
        json={
            "incident_id": str(uuid4()),
            "action": "rollback_deployment",
            "namespace": "demo",
            "deployment": "checkout",
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "incident not found"


def test_execute_endpoint_is_disabled_without_injected_executor() -> None:
    client = TestClient(create_app())

    response = client.post("/remediation/execute", json={"proposal_id": str(uuid4())})

    assert response.status_code == 503


def test_execute_endpoint_runs_only_with_explicit_executor_and_approval() -> None:
    executor = RemediationExecutor(
        policy=RemediationPolicy(allowed_namespaces={"demo"}), rollback_client=FakeRollbackClient()
    )
    incident_id = uuid4()
    client = TestClient(app_with_incident(incident_id, remediation_executor=executor))
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
    assert client.get("/incidents").json()[0]["status"] == "verifying"


def test_execute_without_approval_keeps_incident_awaiting_approval() -> None:
    executor = RemediationExecutor(
        policy=RemediationPolicy(allowed_namespaces={"demo"}), rollback_client=FakeRollbackClient()
    )
    incident_id = uuid4()
    client = TestClient(app_with_incident(incident_id, remediation_executor=executor))
    proposal = client.post(
        "/remediation/proposals",
        json={
            "incident_id": str(incident_id),
            "action": "rollback_deployment",
            "namespace": "demo",
            "deployment": "checkout",
        },
    ).json()

    response = client.post(
        "/remediation/execute", json={"proposal_id": proposal["id"]}
    )

    assert response.status_code == 403
    assert client.get("/incidents").json()[0]["status"] == "awaiting_approval"
