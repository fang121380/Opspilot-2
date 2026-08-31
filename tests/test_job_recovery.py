from __future__ import annotations

import json
from datetime import UTC, datetime
from pathlib import Path

from app.domain.incidents import Incident, IncidentStatus
from app.domain.jobs import InvestigationJob, JobStatus
from app.job_recovery import INTERRUPTED_JOB_ERROR, main, recover_active_jobs
from app.storage.incidents import IncidentRepository
from app.storage.jobs import InMemoryInvestigationJobRepository
from app.storage.sql import SqlAlchemyStore


def make_incident() -> Incident:
    return Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="recovery-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 31, tzinfo=UTC),
    )


def test_recovery_fails_active_job_and_releases_investigating_incident() -> None:
    incidents = IncidentRepository()
    incident = make_incident()
    incidents.create_or_get_active(incident)
    incidents.transition_status(
        str(incident.id),
        expected=IncidentStatus.RECEIVED,
        target=IncidentStatus.INVESTIGATING,
    )
    jobs = InMemoryInvestigationJobRepository()
    job, _ = jobs.create_or_get_active_job(
        InvestigationJob(incident_id=incident.id, status=JobStatus.RUNNING)
    )

    result = recover_active_jobs(jobs, incidents)

    recovered = jobs.get_job(job.id)
    assert result.candidates == 1
    assert result.failed_jobs == 1
    assert result.reset_incidents == 1
    assert recovered is not None
    assert recovered.status == JobStatus.FAILED
    assert recovered.error == INTERRUPTED_JOB_ERROR
    assert recovered.finished_at is not None
    assert incidents.get(str(incident.id)).status == IncidentStatus.RECEIVED
    new_job, deduplicated = jobs.create_or_get_active_job(
        InvestigationJob(incident_id=incident.id)
    )
    assert deduplicated is False
    assert new_job.id != job.id


def test_recovery_never_regresses_incident_owned_by_another_workflow() -> None:
    incidents = IncidentRepository()
    incident = make_incident()
    incidents.create_or_get_active(incident)
    incidents.transition_status(
        str(incident.id),
        expected=IncidentStatus.RECEIVED,
        target=IncidentStatus.EXECUTING,
    )
    jobs = InMemoryInvestigationJobRepository()
    job, _ = jobs.create_or_get_active_job(InvestigationJob(incident_id=incident.id))

    result = recover_active_jobs(jobs, incidents)

    assert result.failed_jobs == 1
    assert result.reset_incidents == 0
    assert jobs.get_job(job.id).error == INTERRUPTED_JOB_ERROR
    assert incidents.get(str(incident.id)).status == IncidentStatus.EXECUTING


def test_recovery_command_defaults_to_dry_run(tmp_path: Path, capsys) -> None:
    database_url = f"sqlite:///{tmp_path / 'recovery.db'}"
    store = SqlAlchemyStore(database_url)
    incident, _ = store.create_or_get_active(make_incident())
    job, _ = store.create_or_get_active_job(InvestigationJob(incident_id=incident.id))

    assert main(["--database-url", database_url]) == 0

    result = json.loads(capsys.readouterr().out)
    assert result["dry_run"] is True
    assert result["active_job_ids"] == [str(job.id)]
    assert store.get_job(job.id).status == JobStatus.QUEUED


def test_recovery_command_confirms_sql_recovery(tmp_path: Path, capsys) -> None:
    database_url = f"sqlite:///{tmp_path / 'confirmed-recovery.db'}"
    store = SqlAlchemyStore(database_url)
    incident, _ = store.create_or_get_active(make_incident())
    store.transition_status(
        str(incident.id),
        expected=IncidentStatus.RECEIVED,
        target=IncidentStatus.INVESTIGATING,
    )
    job, _ = store.create_or_get_active_job(
        InvestigationJob(incident_id=incident.id, status=JobStatus.RUNNING)
    )

    assert main(["--database-url", database_url, "--confirm"]) == 0

    result = json.loads(capsys.readouterr().out)
    assert result == {"candidates": 1, "failed_jobs": 1, "reset_incidents": 1}
    assert store.get_job(job.id).status == JobStatus.FAILED
    assert store.get(str(incident.id)).status == IncidentStatus.RECEIVED
