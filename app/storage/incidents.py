from __future__ import annotations

from datetime import UTC, datetime
from threading import RLock

from app.domain.incidents import Incident, IncidentStatus


class IncidentRepository:
    """In-memory incident storage for the first vertical slice.

    A database-backed repository will replace this implementation once the incident
    workflow includes audit records and approval persistence.
    """

    def __init__(self) -> None:
        self._incidents: dict[str, Incident] = {}
        self._active_by_fingerprint: dict[str, str] = {}
        self._lock = RLock()

    def create_or_get_active(self, incident: Incident) -> tuple[Incident, bool]:
        with self._lock:
            existing_id = self._active_by_fingerprint.get(incident.alert_fingerprint)
            if existing_id is not None:
                return self._incidents[existing_id].model_copy(deep=True), True

            incident_id = str(incident.id)
            self._incidents[incident_id] = incident.model_copy(deep=True)
            self._active_by_fingerprint[incident.alert_fingerprint] = incident_id
            return incident.model_copy(deep=True), False

    def list(self) -> list[Incident]:
        with self._lock:
            return [incident.model_copy(deep=True) for incident in self._incidents.values()]

    def get(self, incident_id: str) -> Incident | None:
        with self._lock:
            incident = self._incidents.get(incident_id)
            return incident.model_copy(deep=True) if incident is not None else None

    def update_status(self, incident_id: str, status: IncidentStatus) -> Incident:
        with self._lock:
            incident = self._incidents[incident_id]
            self._set_status(incident, status)
            return incident.model_copy(deep=True)

    def transition_status(
        self,
        incident_id: str,
        *,
        expected: IncidentStatus,
        target: IncidentStatus,
    ) -> Incident | None:
        """Atomically change status only when the expected state still matches."""

        with self._lock:
            incident = self._incidents[incident_id]
            if incident.status != expected:
                return None
            self._set_status(incident, target)
            return incident.model_copy(deep=True)

    def close(self, incident_id: str) -> None:
        self.update_status(incident_id, IncidentStatus.CLOSED)

    def _set_status(self, incident: Incident, status: IncidentStatus) -> None:
        incident.status = status
        incident.updated_at = datetime.now(UTC)
        if status in {IncidentStatus.RESOLVED, IncidentStatus.CLOSED}:
            self._active_by_fingerprint.pop(incident.alert_fingerprint, None)
