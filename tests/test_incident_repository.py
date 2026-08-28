from datetime import UTC, datetime

from app.domain.incidents import Incident, IncidentStatus
from app.storage.incidents import IncidentRepository


def incident(fingerprint: str = "recurring-alert") -> Incident:
    return Incident(
        alert_name="HighErrorRate",
        alert_fingerprint=fingerprint,
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )


def test_repository_deduplicates_only_active_incidents() -> None:
    repository = IncidentRepository()
    first, _ = repository.create_or_get_active(incident())
    duplicate, deduplicated = repository.create_or_get_active(incident())

    assert deduplicated is True
    assert duplicate.id == first.id

    repository.update_status(str(first.id), IncidentStatus.RESOLVED)
    repeated, deduplicated = repository.create_or_get_active(incident())

    assert deduplicated is False
    assert repeated.id != first.id
