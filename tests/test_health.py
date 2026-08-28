from fastapi.testclient import TestClient

from app.main import app, create_app

client = TestClient(app)


def test_health_endpoint() -> None:
    response = client.get("/health")

    assert response.status_code == 200
    assert response.json() == {"status": "ok", "service": "opspilot-2"}


def test_readiness_reports_missing_workflow_dependencies() -> None:
    client = TestClient(create_app())

    response = client.get("/ready")

    assert response.status_code == 503
    assert response.json()["detail"] == {
        "status": "not_ready",
        "missing_dependencies": [
            "investigator",
            "job_manager",
            "remediation_executor",
            "verifier",
        ],
    }


def test_readiness_succeeds_when_workflow_dependencies_are_wired() -> None:
    dependency = object()
    client = TestClient(
        create_app(
            investigator=dependency,
            job_manager=dependency,
            remediation_executor=dependency,
            verifier=dependency,
        )
    )

    response = client.get("/ready")

    assert response.status_code == 200
    assert response.json() == {"status": "ready", "service": "opspilot-2"}


def test_metrics_endpoint_is_mounted() -> None:
    response = client.get("/metrics")

    assert response.status_code == 200
    assert "opspilot_alerts_received_total" in response.text
