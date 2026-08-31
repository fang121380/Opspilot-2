from datetime import UTC, datetime
from pathlib import Path
from time import sleep
from uuid import uuid4

from fastapi.testclient import TestClient

from app.agent.analysis import AnalysisOutcome
from app.agent.jobs import InvestigationJobManager
from app.domain.incidents import Incident, IncidentStatus
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


def test_job_api_rejects_incident_after_investigation_stage() -> None:
    repository = IncidentRepository()
    incident = Incident(
        status=IncidentStatus.AWAITING_APPROVAL,
        alert_name="HighErrorRate",
        alert_fingerprint="late-job-api-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    repository.create_or_get_active(incident)
    manager = InvestigationJobManager(FakeInvestigator(), repository)
    client = TestClient(
        create_app(incident_repository=repository, job_manager=manager)
    )

    response = client.post(f"/incidents/{incident.id}/investigate/jobs")

    assert response.status_code == 409
    assert repository.get(str(incident.id)).status == IncidentStatus.AWAITING_APPROVAL


def test_job_api_reopens_persisted_completed_job(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'job-api.db'}"
    application = create_app(database_url=database_url, investigator=FakeInvestigator())
    incident = Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="persistent-job-api-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )
    application.state.incident_repository.create_or_get_active(incident)
    with TestClient(application) as client:
        queued = client.post(f"/incidents/{incident.id}/investigate/jobs")
        job_id = queued.json()["id"]
        for _ in range(30):
            completed = client.get(f"/investigation/jobs/{job_id}")
            if completed.json()["status"] == "succeeded":
                break
            sleep(0.01)

    reopened_app = create_app(database_url=database_url, investigator=FakeInvestigator())
    with TestClient(reopened_app) as reopened:
        restored = reopened.get(f"/investigation/jobs/{job_id}")

    assert restored.status_code == 200
    assert restored.json()["status"] == "succeeded"
    assert restored.json()["analysis"]["confidence"] == 0.9
