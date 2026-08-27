from datetime import UTC, datetime

from app.adapters.kubernetes import DeploymentStatus
from app.adapters.prometheus import MetricQueryResult, MetricSample
from app.agent.analysis import IncidentEvidence, analyze_deployment_regression
from app.domain.incidents import Incident


def incident() -> Incident:
    return Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="alert-123",
        service="checkout",
        namespace="demo",
        severity="critical",
        started_at=datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
    )


def high_error_rate() -> MetricQueryResult:
    return MetricQueryResult(
        query="sum(rate(http_requests_total{code=~'5..'}[5m]))",
        samples=[
            MetricSample(
                labels={"service": "checkout"},
                timestamp=datetime(2026, 8, 27, 8, 5, tzinfo=UTC),
                value=0.42,
            )
        ],
    )


def test_identifies_deployment_regression_from_converging_evidence() -> None:
    outcome = analyze_deployment_regression(
        incident(),
        IncidentEvidence(
            deployment=DeploymentStatus(
                name="checkout",
                namespace="demo",
                desired_replicas=3,
                available_replicas=2,
                updated_replicas=2,
            ),
            error_rate=high_error_rate(),
            recent_logs="ERROR migration connection refused\nERROR request failed\n",
        ),
    )

    assert outcome.confidence == 0.85
    assert outcome.hypotheses[0].title == "Recent deployment regression"
    assert outcome.hypotheses[0].confidence == 0.85
    assert [action.model_dump() for action in outcome.recommended_actions] == [
        {
            "action": "rollback_deployment",
            "namespace": "demo",
            "deployment": "checkout",
            "requires_approval": True,
        }
    ]
    assert [item.id for item in outcome.evidence] == [
        "deployment-availability",
        "http-5xx-rate",
        "recent-error-logs",
    ]


def test_refuses_remediation_when_evidence_is_insufficient() -> None:
    outcome = analyze_deployment_regression(
        incident(),
        IncidentEvidence(
            deployment=DeploymentStatus(
                name="checkout",
                namespace="demo",
                desired_replicas=3,
                available_replicas=3,
                updated_replicas=3,
            ),
            error_rate=MetricQueryResult(query="up"),
            recent_logs="INFO request completed\n",
        ),
    )

    assert outcome.confidence == 0.2
    assert outcome.hypotheses[0].title == "Insufficient evidence for a deployment regression"
    assert outcome.recommended_actions == []
