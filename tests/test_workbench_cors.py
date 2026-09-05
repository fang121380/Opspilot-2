from fastapi.testclient import TestClient

from app.main import create_app


def test_workbench_origin_can_read_health() -> None:
    client = TestClient(create_app())
    response = client.get(
        "/health",
        headers={"Origin": "http://127.0.0.1:5173"},
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:5173"


def test_unknown_origin_is_not_granted_cors_access() -> None:
    client = TestClient(create_app())
    response = client.get(
        "/health",
        headers={"Origin": "https://example.com"},
    )

    assert response.status_code == 200
    assert "access-control-allow-origin" not in response.headers
