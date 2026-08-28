from __future__ import annotations

from app.domain.incidents import Incident, IncidentStatus


class IncidentRepository:
    """In-memory incident storage for the first vertical slice.

    A database-backed repository will replace this implementation once the incident
    workflow includes audit records and approval persistence.
    """

    def __init__(self) -> None:
        self._incidents: dict[str, Incident] = {}
        self._active_by_fingerprint: dict[str, str] = {}

    def create_or_get_active(self, incident: Incident) -> tuple[Incident, bool]:
        existing_id = self._active_by_fingerprint.get(incident.alert_fingerprint)
        if existing_id is not None:
            return self._incidents[existing_id], True

        incident_id = str(incident.id)
        self._incidents[incident_id] = incident
        self._active_by_fingerprint[incident.alert_fingerprint] = incident_id
        return incident, False

    def list(self) -> list[Incident]:
        return list(self._incidents.values())

    def get(self, incident_id: str) -> Incident | None:
        return self._incidents.get(incident_id)

    def close(self, incident_id: str) -> None:
        incident = self._incidents[incident_id]
        incident.status = IncidentStatus.CLOSED
        self._active_by_fingerprint.pop(incident.alert_fingerprint, None)
