from datetime import UTC, datetime
from uuid import uuid4

from app.storage.audit import AuditEventType, AuditRepository


def test_audit_repository_appends_and_filters_events() -> None:
    repository = AuditRepository()
    incident_id = uuid4()
    created_at = datetime(2026, 8, 28, 1, 0, tzinfo=UTC)

    repository.append(
        incident_id=incident_id,
        event_type=AuditEventType.INCIDENT_CREATED,
        payload={"alert_name": "HighErrorRate"},
        trace_id="trace-1",
        created_at=created_at,
    )
    repository.append(
        incident_id=incident_id,
        event_type=AuditEventType.DIAGNOSTIC_COMPLETED,
        payload={"tool": "prometheus"},
        trace_id="trace-1",
        created_at=created_at,
    )
    repository.append(
        incident_id=uuid4(),
        event_type=AuditEventType.INCIDENT_CREATED,
        payload={},
        trace_id="trace-2",
        created_at=created_at,
    )

    events = repository.list_for_incident(incident_id)

    assert len(events) == 2
    assert events[0].event_type == AuditEventType.INCIDENT_CREATED
    assert events[0].payload == {"alert_name": "HighErrorRate"}
    assert events[0].trace_id == "trace-1"


def test_audit_repository_returns_copy_of_event_payload() -> None:
    repository = AuditRepository()
    incident_id = uuid4()
    payload = {"nested": {"value": 1}}
    repository.append(
        incident_id=incident_id,
        event_type=AuditEventType.ALERT_RECEIVED,
        payload=payload,
    )

    payload["nested"]["value"] = 99

    assert repository.list_for_incident(incident_id)[0].payload == {"nested": {"value": 1}}
