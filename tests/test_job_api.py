from datetime import UTC, datetime
from uuid import uuid4

from fastapi.testclient import TestClient

from app.agent.analysis import AnalysisOutcome
from app.agent.jobs import InvestigationJobManager
from app.domain.incidents import Incident
from app.main import create_app
from app.storage.incidents import IncidentRepository


class FakeInvestigator:
    async def investigate(self, incident: Incident) -> AnalysisOutcome:
        return AnalysisOutcome(summary="done", impact="none", confidence=0.9)


def test_job_api_queues_and_reads_job() -> None:
    repository = IncidentRepository()
    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="job-api-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    repository.create_or_get_active(incident)
    manager = InvestigationJobManager(FakeInvestigator())
    client = TestClient(create_app(incident_repository=repository, job_manager=manager))

    queued = client.post(f"/incidents/{incident.id}/investigate/jobs")
    job_id = queued.json()["id"]
    read = client.get(f"/investigation/jobs/{job_id}")

    assert queued.status_code == 202
    assert read.status_code == 200
    assert read.json()["incident_id"] == str(incident.id)


def test_app_factory_auto_configures_jobs_for_injected_investigator() -> None:
    repository = IncidentRepository()
    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="auto-job-api-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    repository.create_or_get_active(incident)
    client = TestClient(
        create_app(incident_repository=repository, investigator=FakeInvestigator())
    )

    response = client.post(f"/incidents/{incident.id}/investigate/jobs")

    assert response.status_code == 202


def test_job_api_rejects_unknown_job() -> None:
    manager = InvestigationJobManager(FakeInvestigator())
    client = TestClient(create_app(job_manager=manager))

    response = client.get(f"/investigation/jobs/{uuid4()}")

    assert response.status_code == 404
