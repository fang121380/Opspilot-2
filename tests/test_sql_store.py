from datetime import UTC, datetime
from pathlib import Path

from app.domain.incidents import Incident
from app.storage.audit import AuditEventType
from app.storage.sql import SqlAlchemyStore


def make_incident(fingerprint: str = "db-test") -> Incident:
    return Incident(
        alert_name="HighErrorRate",
        alert_fingerprint=fingerprint,
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, 0, 0, tzinfo=UTC),
    )


def test_sql_store_persists_incidents_after_reopening(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'opspilot.db'}"
    incident = make_incident()

    first_store = SqlAlchemyStore(database_url)
    stored, deduplicated = first_store.create_or_get_active(incident)
    assert stored.id == incident.id
    assert deduplicated is False
    first_store.append_audit(
        incident_id=incident.id,
        event_type=AuditEventType.INCIDENT_CREATED,
        payload={"source": "test"},
        trace_id="trace-db",
    )

    reopened = SqlAlchemyStore(database_url)
    duplicate, is_duplicate = reopened.create_or_get_active(make_incident())

    assert is_duplicate is True
    assert duplicate.id == incident.id
    assert reopened.get(str(incident.id)).service == "checkout"
    assert reopened.list_audit(incident.id)[0].payload == {"source": "test"}


def test_sql_store_does_not_confuse_distinct_fingerprints(tmp_path: Path) -> None:
    store = SqlAlchemyStore(f"sqlite:///{tmp_path / 'opspilot.db'}")

    first, _ = store.create_or_get_active(make_incident("one"))
    second, duplicate = store.create_or_get_active(make_incident("two"))

    assert duplicate is False
    assert first.id != second.id
    assert len(store.list()) == 2
