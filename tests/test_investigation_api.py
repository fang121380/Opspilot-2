from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.agent.analysis import AnalysisOutcome, RemediationRecommendation
from app.domain.incidents import Incident, IncidentStatus
from app.main import create_app
from app.storage.incidents import IncidentRepository


class FakeInvestigator:
    async def investigate(self, incident: Incident) -> AnalysisOutcome:
        return AnalysisOutcome(
            summary=f"分析 {incident.service}",
            impact="测试影响",
            confidence=0.7,
        )


class FailingInvestigator:
    async def investigate(self, incident: Incident) -> AnalysisOutcome:
        raise RuntimeError("sensitive upstream detail")


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
    assert response.json()["incident"]["status"] == "received"
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


def test_investigation_api_records_sanitized_dependency_failure() -> None:
    repository = IncidentRepository()
    incident = make_incident()
    repository.create_or_get_active(incident)
    client = TestClient(
        create_app(incident_repository=repository, investigator=FailingInvestigator())
    )

    response = client.post(f"/incidents/{incident.id}/investigate")

    assert response.status_code == 503
    assert response.json()["detail"] == "incident investigation failed"
    assert "sensitive" not in response.text
    audit = client.get(f"/incidents/{incident.id}/audit").json()
    assert audit[-1]["event_type"] == "diagnostic.failed"
    assert audit[-1]["payload"] == {"error_type": "RuntimeError"}
    assert client.get("/incidents").json()[0]["status"] == "received"


def test_investigation_api_cannot_regress_mutating_or_terminal_incidents() -> None:
    for current_status in (
        IncidentStatus.AWAITING_APPROVAL,
        IncidentStatus.EXECUTING,
        IncidentStatus.VERIFYING,
        IncidentStatus.RESOLVED,
        IncidentStatus.CLOSED,
    ):
        repository = IncidentRepository()
        incident = make_incident().model_copy(
            update={
                "id": uuid4(),
                "alert_fingerprint": f"status-{current_status.value}",
                "status": current_status,
            }
        )
        repository.create_or_get_active(incident)
        client = TestClient(
            create_app(
                incident_repository=repository,
                investigator=FakeInvestigator(),
            )
        )

        response = client.post(f"/incidents/{incident.id}/investigate")

        assert response.status_code == 409
        assert repository.get(str(incident.id)).status == current_status


def test_investigation_api_does_not_overwrite_state_changed_during_investigation() -> None:
    for recommends_remediation in (False, True):
        repository = IncidentRepository()
        incident = make_incident().model_copy(
            update={"id": uuid4(), "alert_fingerprint": f"race-{recommends_remediation}"}
        )
        repository.create_or_get_active(incident)

        class StateChangingInvestigator:
            def __init__(
                self,
                incident_repository: IncidentRepository,
                recommends: bool,
            ) -> None:
                self._repository = incident_repository
                self._recommends = recommends

            async def investigate(self, current: Incident) -> AnalysisOutcome:
                self._repository.transition_status(
                    str(current.id),
                    expected=IncidentStatus.INVESTIGATING,
                    target=IncidentStatus.EXECUTING,
                )
                recommendations = (
                    [
                        RemediationRecommendation(
                            action="rollback_deployment",
                            namespace="demo",
                            deployment="checkout",
                        )
                    ]
                    if self._recommends
                    else []
                )
                return AnalysisOutcome(
                    summary="done",
                    impact="none",
                    confidence=0.9,
                    recommended_actions=recommendations,
                )

        client = TestClient(
            create_app(
                incident_repository=repository,
                investigator=StateChangingInvestigator(
                    repository,
                    recommends_remediation,
                ),
            )
        )

        response = client.post(f"/incidents/{incident.id}/investigate")

        assert response.status_code == 409
        assert repository.get(str(incident.id)).status == IncidentStatus.EXECUTING
