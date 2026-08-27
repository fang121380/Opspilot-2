from __future__ import annotations

from datetime import UTC, datetime
from urllib.parse import urljoin

import httpx
from pydantic import BaseModel, Field


class PrometheusQueryError(RuntimeError):
    """Raised when Prometheus cannot produce a valid instant-query response."""


class MetricSample(BaseModel):
    labels: dict[str, str]
    timestamp: datetime
    value: float


class MetricQueryResult(BaseModel):
    source: str = "prometheus"
    query: str
    samples: list[MetricSample] = Field(default_factory=list)


class PrometheusMetricsAdapter:
    """Minimal read-only Prometheus instant-query client.

    The adapter deliberately exposes only `GET /api/v1/query` for the MVP. It
    does not proxy arbitrary URLs or support Prometheus administrative endpoints.
    """

    def __init__(self, base_url: str, *, client: httpx.AsyncClient) -> None:
        self._base_url = base_url.rstrip("/") + "/"
        self._client = client

    async def instant_query(self, query: str, *, at: datetime | None = None) -> MetricQueryResult:
        params: dict[str, str] = {"query": query}
        if at is not None:
            params["time"] = at.astimezone(UTC).isoformat().replace("+00:00", "Z")

        try:
            response = await self._client.get(
                urljoin(self._base_url, "api/v1/query"), params=params, timeout=10.0
            )
        except httpx.HTTPError as error:
            raise PrometheusQueryError(f"Prometheus request failed: {error}") from error

        if response.status_code != httpx.codes.OK:
            raise PrometheusQueryError(f"Prometheus returned HTTP {response.status_code}")

        try:
            payload = response.json()
        except ValueError as error:
            raise PrometheusQueryError("Prometheus returned invalid JSON") from error

        if payload.get("status") != "success":
            detail = payload.get("error", "unknown Prometheus API error")
            raise PrometheusQueryError(f"Prometheus query failed: {detail}")

        data = payload.get("data", {})
        if data.get("resultType") != "vector":
            raise PrometheusQueryError(
                f"unsupported result type: {data.get('resultType', 'missing')}"
            )

        samples: list[MetricSample] = []
        for result in data.get("result", []):
            try:
                timestamp, value = result["value"]
                samples.append(
                    MetricSample(
                        labels=result.get("metric", {}),
                        timestamp=datetime.fromtimestamp(float(timestamp), tz=UTC),
                        value=float(value),
                    )
                )
            except (KeyError, TypeError, ValueError) as error:
                raise PrometheusQueryError(
                    "Prometheus returned an invalid vector sample"
                ) from error

        return MetricQueryResult(query=query, samples=samples)
