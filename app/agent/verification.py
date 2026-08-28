from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel

from app.adapters.prometheus import MetricQueryResult
from app.domain.incidents import Incident


class PrometheusDiagnostics(Protocol):
    async def instant_query(self, query: str) -> MetricQueryResult: ...


class VerificationOutcome(BaseModel):
    resolved: bool
    observed_error_rate: float | None
    threshold: float
    reason: str


class IncidentVerifier:
    """用只读 Prometheus 信号验证修复结果，不触发任何二次写操作。"""

    def __init__(self, prometheus: PrometheusDiagnostics, *, threshold: float = 0.01) -> None:
        self._prometheus = prometheus
        self._threshold = threshold

    async def verify(self, incident: Incident) -> VerificationOutcome:
        if not incident.service or not incident.namespace:
            raise ValueError("incident must contain service and namespace")
        query = (
            "sum(rate(http_requests_total{"
            f'namespace="{_escape_label(incident.namespace)}",'
            f'service="{_escape_label(incident.service)}",code=~"5.."'
            "}[1m])) or vector(0)"
        )
        result = await self._prometheus.instant_query(query)
        if not result.samples:
            return VerificationOutcome(
                resolved=False,
                observed_error_rate=None,
                threshold=self._threshold,
                reason="Prometheus returned no verification sample",
            )
        observed = max(sample.value for sample in result.samples)
        resolved = observed <= self._threshold
        return VerificationOutcome(
            resolved=resolved,
            observed_error_rate=observed,
            threshold=self._threshold,
            reason=(
                "HTTP 5xx rate is below the verification threshold"
                if resolved
                else "HTTP 5xx rate remains above the verification threshold"
            ),
        )


def _escape_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
