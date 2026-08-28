from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "opspilot-2"}


def test_metrics_endpoint_is_mounted() -> None:
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "opspilot_alerts_received_total" in response.text
