from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient

from app.domain.incidents import Incident
from app.main import create_app
from app.security.auth import (
    BearerTokenAuthenticator,
    OperatorAuthenticationError,
)
from app.storage.incidents import IncidentRepository


def authenticator() -> BearerTokenAuthenticator:
    return BearerTokenAuthenticator(token="correct-secret", subject="on-call@example.com")


@pytest.mark.parametrize(
    ("token", "subject"),
    [("", "operator"), ("token", "   ")],
)
def test_bearer_authenticator_rejects_incomplete_server_configuration(
    token: str,
    subject: str,
) -> None:
    with pytest.raises(ValueError):
        BearerTokenAuthenticator(token=token, subject=subject)


@pytest.mark.parametrize(
    "authorization",
    [None, "Basic correct-secret", "Bearer", "Bearer wrong-secret"],
)
def test_bearer_authenticator_rejects_invalid_credentials(
    authorization: str | None,
) -> None:
    with pytest.raises(OperatorAuthenticationError):
        authenticator().authenticate(authorization)


def test_bearer_authenticator_returns_server_mapped_identity() -> None:
    principal = authenticator().authenticate("Bearer correct-secret")

    assert principal.subject == "on-call@example.com"


def test_approval_is_fail_closed_without_configured_authentication() -> None:
    repository = IncidentRepository()
    incident, _ = repository.create_or_get_active(
        Incident(
            alert_name="HighErrorRate",
            alert_fingerprint="auth-disabled",
            service="checkout",
            namespace="demo",
            started_at=datetime.now(UTC),
        )
    )
    client = TestClient(create_app(incident_repository=repository))
    proposal = client.post(
        "/remediation/proposals",
        json={
            "incident_id": str(incident.id),
            "action": "rollback_deployment",
            "namespace": "demo",
            "deployment": "checkout",
        },
    ).json()

    response = client.post(
        f"/remediation/proposals/{proposal['id']}/approval",
        json={"expires_in_minutes": 10},
    )

    assert response.status_code == 503


def test_approval_requires_bearer_token_and_rejects_claimed_identity() -> None:
    repository = IncidentRepository()
    incident, _ = repository.create_or_get_active(
        Incident(
            alert_name="HighErrorRate",
            alert_fingerprint="auth-required",
            service="checkout",
            namespace="demo",
            started_at=datetime.now(UTC),
        )
    )
    client = TestClient(
        create_app(
            incident_repository=repository,
            operator_authenticator=authenticator(),
        )
    )
    proposal = client.post(
        "/remediation/proposals",
        json={
            "incident_id": str(incident.id),
            "action": "rollback_deployment",
            "namespace": "demo",
            "deployment": "checkout",
        },
    ).json()

    missing = client.post(
        f"/remediation/proposals/{proposal['id']}/approval",
        json={"expires_in_minutes": 10},
    )
    wrong = client.post(
        f"/remediation/proposals/{proposal['id']}/approval",
        headers={"Authorization": "Bearer wrong-secret"},
        json={"expires_in_minutes": 10},
    )
    spoofed = client.post(
        f"/remediation/proposals/{proposal['id']}/approval",
        headers={"Authorization": "Bearer correct-secret"},
        json={"approved_by": "attacker", "expires_in_minutes": 10},
    )
    approved = client.post(
        f"/remediation/proposals/{proposal['id']}/approval",
        headers={"Authorization": "Bearer correct-secret"},
        json={"expires_in_minutes": 10},
    )

    assert missing.status_code == 401
    assert missing.headers["www-authenticate"] == "Bearer"
    assert wrong.status_code == 401
    assert spoofed.status_code == 422
    assert approved.status_code == 201
    assert approved.json()["approved_by"] == "on-call@example.com"
