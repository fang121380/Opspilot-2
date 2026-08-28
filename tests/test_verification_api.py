from datetime import UTC, datetime

from fastapi.testclient import TestClient

from app.agent.verification import VerificationOutcome
from app.domain.incidents import Incident, IncidentStatus
from app.main import create_app
from app.storage.incidents import IncidentRepository


class FakeVerifier:
    def __init__(self, resolved: bool) -> None:
        self.resolved = resolved

    async def verify(self, incident: Incident) -> VerificationOutcome:
        return VerificationOutcome(
            resolved=self.resolved,
            observed_error_rate=0.0 if self.resolved else 0.2,
            threshold=0.01,
            reason="test",
        )


def app_for_verification(*, resolved: bool) -> tuple[TestClient, Incident]:
    repository = IncidentRepository()
    incident = Incident(
        status=IncidentStatus.VERIFYING,
        alert_name="HighErrorRate",
        alert_fingerprint=f"verification-api-{resolved}",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    repository.create_or_get_active(incident)
    return (
        TestClient(
            create_app(incident_repository=repository, verifier=FakeVerifier(resolved))
        ),
        incident,
    )


def test_verification_marks_incident_resolved_and_audits() -> None:
    client, incident = app_for_verification(resolved=True)

    response = client.post(f"/incidents/{incident.id}/verify")

    assert response.status_code == 200
    assert response.json()["resolved"] is True
    assert client.get("/incidents").json()[0]["status"] == "resolved"
    audit = client.get(f"/incidents/{incident.id}/audit").json()
    assert audit[-1]["event_type"] == "verification.completed"


def test_verification_keeps_incident_open_when_signal_is_unhealthy() -> None:
    client, incident = app_for_verification(resolved=False)

    response = client.post(f"/incidents/{incident.id}/verify")

    assert response.status_code == 200
    assert response.json()["resolved"] is False
    assert client.get("/incidents").json()[0]["status"] == "verifying"


def test_verification_rejects_incident_in_wrong_state() -> None:
    client, incident = app_for_verification(resolved=True)
    client.app.state.incident_repository.update_status(
        str(incident.id), IncidentStatus.AWAITING_APPROVAL
    )

    response = client.post(f"/incidents/{incident.id}/verify")

    assert response.status_code == 409
