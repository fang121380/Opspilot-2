from datetime import UTC, datetime

import pytest

from app.adapters.prometheus import MetricQueryResult, MetricSample
from app.agent.verification import IncidentVerifier
from app.domain.incidents import Incident


class FakePrometheus:
    def __init__(self, value: float | None) -> None:
        self.value = value
        self.query = ""

    async def instant_query(self, query: str) -> MetricQueryResult:
        self.query = query
        samples = (
            [
                MetricSample(
                    labels={}, timestamp=datetime(2026, 8, 28, tzinfo=UTC), value=self.value
                )
            ]
            if self.value is not None
            else []
        )
        return MetricQueryResult(query=query, samples=samples)


def incident() -> Incident:
    return Incident(
        alert_name="HighErrorRate",
        alert_fingerprint="verification-test",
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, tzinfo=UTC),
    )


@pytest.mark.asyncio
async def test_verifier_resolves_only_below_threshold() -> None:
    healthy = FakePrometheus(0.0)
    unhealthy = FakePrometheus(0.2)

    assert (await IncidentVerifier(healthy).verify(incident())).resolved is True
    assert (await IncidentVerifier(unhealthy).verify(incident())).resolved is False
    assert 'namespace="demo"' in healthy.query
    assert "or vector(0)" in healthy.query


@pytest.mark.asyncio
async def test_verifier_does_not_resolve_without_a_metric_sample() -> None:
    outcome = await IncidentVerifier(FakePrometheus(None)).verify(incident())

    assert outcome.resolved is False
    assert outcome.observed_error_rate is None
