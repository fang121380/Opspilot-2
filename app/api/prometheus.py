from __future__ import annotations

import hashlib
import json
from datetime import datetime
from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status
from pydantic import BaseModel, Field, field_validator

from app.domain.incidents import Incident
from app.observability.metrics import ALERTS_RECEIVED
from app.observability.tracing import current_trace_id, traced
from app.storage.audit import AuditEvent, AuditEventType, AuditRepository
from app.storage.incidents import IncidentRepository

router = APIRouter(tags=["alerts"])


class AlertmanagerAlert(BaseModel):
    status: str
    labels: dict[str, str] = Field(default_factory=dict)
    annotations: dict[str, str] = Field(default_factory=dict)
    starts_at: datetime = Field(alias="startsAt")
    fingerprint: str = ""

    model_config = {"populate_by_name": True}


class AlertmanagerWebhook(BaseModel):
    status: str
    alerts: list[AlertmanagerAlert]

    @field_validator("alerts")
    @classmethod
    def requires_alerts_for_firing(cls, alerts: list[AlertmanagerAlert]) -> list[AlertmanagerAlert]:
        if not alerts:
            raise ValueError("a webhook must contain at least one alert")
        return alerts


class IncidentReceipt(BaseModel):
    incident: Incident
    deduplicated: bool


def repository_from_request(request: Request) -> IncidentRepository:
    return request.app.state.incident_repository


def audit_repository_from_request(request: Request) -> AuditRepository:
    return request.app.state.audit_repository


RepositoryDependency = Annotated[IncidentRepository, Depends(repository_from_request)]
AuditDependency = Annotated[AuditRepository, Depends(audit_repository_from_request)]


def alert_fingerprint(alert: AlertmanagerAlert) -> str:
    if alert.fingerprint:
        return alert.fingerprint

    stable_fields = {
        "alertname": alert.labels.get("alertname", "unknown-alert"),
        "namespace": alert.labels.get("namespace", ""),
        "service": alert.labels.get("service", ""),
        "severity": alert.labels.get("severity", "warning"),
    }
    encoded = json.dumps(stable_fields, sort_keys=True, separators=(",", ":")).encode()
    return f"sha256:{hashlib.sha256(encoded).hexdigest()}"


def normalize_incident(alert: AlertmanagerAlert) -> Incident:
    labels = alert.labels
    return Incident(
        alert_name=labels.get("alertname", "unknown-alert"),
        alert_fingerprint=alert_fingerprint(alert),
        service=labels.get("service"),
        namespace=labels.get("namespace"),
        severity=labels.get("severity", "warning"),
        summary=alert.annotations.get("summary"),
        started_at=alert.starts_at,
    )


@router.post(
    "/webhooks/prometheus",
    response_model=IncidentReceipt,
    status_code=status.HTTP_202_ACCEPTED,
)
async def receive_prometheus_webhook(
    webhook: AlertmanagerWebhook,
    repository: RepositoryDependency,
    audit_repository: AuditDependency,
) -> IncidentReceipt:
    with traced("alertmanager.webhook"):
        ALERTS_RECEIVED.inc()
        firing_alerts = [alert for alert in webhook.alerts if alert.status == "firing"]
        if not firing_alerts:
            raise HTTPException(
                status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
                detail="webhook contains no firing alerts",
            )

        incident = normalize_incident(firing_alerts[0])
        trace_id = current_trace_id()
        stored_incident, deduplicated = repository.create_or_get_active(incident)
        audit_repository.append(
            event_type=AuditEventType.ALERT_RECEIVED,
            incident_id=stored_incident.id,
            trace_id=trace_id,
            payload={
                "alert_name": stored_incident.alert_name,
                "fingerprint": stored_incident.alert_fingerprint,
            },
        )
        audit_repository.append(
            event_type=(
                AuditEventType.INCIDENT_DEDUPLICATED
                if deduplicated
                else AuditEventType.INCIDENT_CREATED
            ),
            incident_id=stored_incident.id,
            trace_id=trace_id,
            payload={"status": stored_incident.status.value},
        )
        return IncidentReceipt(incident=stored_incident, deduplicated=deduplicated)


@router.get("/incidents", response_model=list[Incident])
async def list_incidents(repository: RepositoryDependency) -> list[Incident]:
    return repository.list()


@router.get("/incidents/{incident_id}/audit", response_model=list[AuditEvent])
async def list_incident_audit(
    incident_id: UUID,
    repository: RepositoryDependency,
    audit_repository: AuditDependency,
) -> list[AuditEvent]:
    if not any(incident.id == incident_id for incident in repository.list()):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="incident not found")
    return audit_repository.list_for_incident(incident_id)
