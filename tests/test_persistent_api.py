from pathlib import Path

from fastapi.testclient import TestClient

from app.main import create_app


def test_api_can_reopen_persisted_incident_and_audit(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'opspilot.db'}"
    client = TestClient(create_app(database_url=database_url))
    payload = {
        "status": "firing",
        "alerts": [
            {
                "status": "firing",
                "labels": {
                    "alertname": "HighErrorRate",
                    "namespace": "demo",
                    "service": "checkout",
                },
                "annotations": {},
                "startsAt": "2026-08-28T00:00:00Z",
                "fingerprint": "persistent-api-test",
            }
        ],
    }

    created = client.post("/webhooks/prometheus", json=payload)
    incident_id = created.json()["incident"]["id"]

    reopened = TestClient(create_app(database_url=database_url))
    incidents = reopened.get("/incidents")
    audit = reopened.get(f"/incidents/{incident_id}/audit")

    assert incidents.status_code == 200
    assert incidents.json()[0]["id"] == incident_id
    assert audit.status_code == 200
    assert [event["event_type"] for event in audit.json()] == [
        "alert.received",
        "incident.created",
    ]
