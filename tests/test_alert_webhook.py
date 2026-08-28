from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.main import create_app
from app.security.auth import BearerTokenAuthenticator

ALERT_HEADERS = {"Authorization": "Bearer alert-test-token"}


@pytest.fixture
def client() -> TestClient:
    client = TestClient(
        create_app(
            alert_authenticator=BearerTokenAuthenticator(
                token="alert-test-token", subject="test-alertmanager"
            )
        )
    )
    client.headers.update(ALERT_HEADERS)
    return client


def alertmanager_payload(*, fingerprint: str = "alert-123") -> dict[str, object]:
    return {
        "receiver": "opspilot",
        "status": "firing",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "HighErrorRate",
                    "namespace": "demo",
                    "service": "checkout",
                    "severity": "critical",
                },
                "annotations": {
                    "summary": "Checkout error rate is above the SLO threshold.",
                },
                "startsAt": "2026-08-27T08:00:00Z",
                "fingerprint": fingerprint,
            }
        ],
        "groupLabels": {"alertname": "HighErrorRate"},
        "commonLabels": {"service": "checkout", "namespace": "demo"},
    }


def test_accepts_firing_alert_and_creates_normalized_incident(client: TestClient) -> None:
    response = client.post("/webhooks/prometheus", json=alertmanager_payload())

    assert response.status_code == 202
    body = response.json()
    assert body["deduplicated"] is False
    assert body["incident"]["status"] == "received"
    assert body["incident"]["alert_name"] == "HighErrorRate"
    assert body["incident"]["namespace"] == "demo"
    assert body["incident"]["service"] == "checkout"
    assert body["incident"]["severity"] == "critical"
    assert body["incident"]["alert_fingerprint"] == "alert-123"
    assert body["incident"]["started_at"] == "2026-08-27T08:00:00Z"
    assert datetime.fromisoformat(body["incident"]["created_at"]).tzinfo == UTC
    audit = client.get(f"/incidents/{body['incident']['id']}/audit").json()
    assert audit[0]["payload"]["source"] == "test-alertmanager"


def test_rejects_unauthenticated_alert_without_creating_incident(
    client: TestClient,
) -> None:
    response = client.post(
        "/webhooks/prometheus",
        headers={"Authorization": ""},
        json=alertmanager_payload(),
    )

    assert response.status_code == 401
    assert response.headers["www-authenticate"] == "Bearer"
    assert client.get("/incidents").json() == []


def test_alert_webhook_is_disabled_without_source_authentication() -> None:
    unauthenticated = TestClient(create_app())

    response = unauthenticated.post(
        "/webhooks/prometheus", json=alertmanager_payload()
    )

    assert response.status_code == 503
    assert unauthenticated.get("/incidents").json() == []


def test_deduplicates_active_alerts_by_fingerprint(client: TestClient) -> None:
    first = client.post("/webhooks/prometheus", json=alertmanager_payload())
    duplicate = client.post("/webhooks/prometheus", json=alertmanager_payload())

    assert first.status_code == 202
    assert duplicate.status_code == 202
    assert duplicate.json()["deduplicated"] is True
    assert duplicate.json()["incident"]["id"] == first.json()["incident"]["id"]

    audit = client.get(f"/incidents/{first.json()['incident']['id']}/audit")
    assert [event["event_type"] for event in audit.json()] == [
        "alert.received",
        "incident.created",
        "alert.received",
        "incident.deduplicated",
    ]
    assert all(event["incident_id"] == first.json()["incident"]["id"] for event in audit.json())


def test_uses_stable_fallback_fingerprint_when_alertmanager_omits_one(client: TestClient) -> None:
    payload = alertmanager_payload(fingerprint="")

    first = client.post("/webhooks/prometheus", json=payload)
    duplicate = client.post("/webhooks/prometheus", json=payload)

    assert first.status_code == 202
    assert first.json()["incident"]["alert_fingerprint"].startswith("sha256:")
    assert duplicate.json()["deduplicated"] is True


def test_rejects_firing_webhook_without_alerts(client: TestClient) -> None:
    response = client.post("/webhooks/prometheus", json={"status": "firing", "alerts": []})

    assert response.status_code == 422


def test_rejects_alert_scope_that_could_broaden_kubernetes_selector(
    client: TestClient,
) -> None:
    payload = alertmanager_payload()
    payload["alerts"][0]["labels"]["service"] = "checkout,app"

    response = client.post("/webhooks/prometheus", json=payload)

    assert response.status_code == 422
    assert client.get("/incidents").json() == []


def test_rejects_alert_without_required_kubernetes_scope(client: TestClient) -> None:
    payload = alertmanager_payload()
    del payload["alerts"][0]["labels"]["namespace"]

    response = client.post("/webhooks/prometheus", json=payload)

    assert response.status_code == 422


def test_lists_created_incidents(client: TestClient) -> None:
    created = client.post("/webhooks/prometheus", json=alertmanager_payload())

    response = client.get("/incidents")

    assert response.status_code == 200
    assert response.json() == [created.json()["incident"]]


def test_lists_audit_events_for_an_incident(client: TestClient) -> None:
    created = client.post("/webhooks/prometheus", json=alertmanager_payload())
    incident_id = created.json()["incident"]["id"]

    response = client.get(f"/incidents/{incident_id}/audit")

    assert response.status_code == 200
    assert [event["event_type"] for event in response.json()] == [
        "alert.received",
        "incident.created",
    ]
    assert all(len(event["trace_id"]) == 32 for event in response.json())


def test_returns_not_found_for_unknown_incident_audit(client: TestClient) -> None:
    response = client.get("/incidents/00000000-0000-0000-0000-000000000000/audit")

    assert response.status_code == 404
