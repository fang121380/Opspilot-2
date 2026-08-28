from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.agent.analysis import AnalysisOutcome
from app.domain.incidents import Incident
from app.main import create_app
from app.storage.incidents import IncidentRepository


class FakeInvestigator:
    async def investigate(self, incident: Incident) -> AnalysisOutcome:
        return AnalysisOutcome(
            summary=f"分析 {incident.service}",
            impact="测试影响",
            confidence=0.7,
        )


def make_incident() -> Incident:
    return Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="api-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, 0, 0, tzinfo=UTC),
    )


def test_investigation_api_returns_analysis_for_existing_incident() -> None:
    repository = IncidentRepository()
    incident = make_incident()
    repository.create_or_get_active(incident)
    client = TestClient(create_app(incident_repository=repository, investigator=FakeInvestigator()))

    response = client.post(f"/incidents/{incident.id}/investigate")

    assert response.status_code == 200
    assert response.json()["incident"]["id"] == str(incident.id)
    assert response.json()["incident"]["status"] == "investigating"
    assert response.json()["analysis"]["confidence"] == 0.7


def test_investigation_api_rejects_unknown_incident() -> None:
    client = TestClient(create_app(investigator=FakeInvestigator()))

    response = client.post(f"/incidents/{uuid4()}/investigate")

    assert response.status_code == 404


def test_investigation_api_reports_missing_runtime_dependencies() -> None:
    repository = IncidentRepository()
    incident = make_incident()
    repository.create_or_get_active(incident)
    client = TestClient(create_app(incident_repository=repository))

    response = client.post(f"/incidents/{incident.id}/investigate")

    assert response.status_code == 503
