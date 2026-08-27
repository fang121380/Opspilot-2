from datetime import UTC, datetime

import httpx
import pytest

from app.adapters.prometheus import PrometheusMetricsAdapter, PrometheusQueryError


@pytest.mark.asyncio
async def test_queries_prometheus_and_returns_typed_vector_samples() -> None:
    captured_request: httpx.Request | None = None

    async def handler(request: httpx.Request) -> httpx.Response:
        nonlocal captured_request
        captured_request = request
        return httpx.Response(
            200,
            json={
                "status": "success",
                "data": {
                    "resultType": "vector",
                    "result": [
                        {
                            "metric": {"service": "checkout", "code": "500"},
                            "value": [1787817600, "0.42"],
                        }
                    ],
                },
            },
        )

    client = httpx.AsyncClient(transport=httpx.MockTransport(handler))
    adapter = PrometheusMetricsAdapter("http://prometheus:9090", client=client)

    result = await adapter.instant_query('sum(rate(http_requests_total{code=~"5.."}[5m]))')

    assert captured_request is not None
    assert captured_request.method == "GET"
    assert captured_request.url.path == "/api/v1/query"
    assert captured_request.url.params["query"] == 'sum(rate(http_requests_total{code=~"5.."}[5m]))'
    assert result.source == "prometheus"
    assert result.query == 'sum(rate(http_requests_total{code=~"5.."}[5m]))'
    assert [sample.model_dump() for sample in result.samples] == [
        {
            "labels": {"service": "checkout", "code": "500"},
            "timestamp": datetime(2026, 8, 27, 8, 0, tzinfo=UTC),
            "value": 0.42,
        }
    ]

    await client.aclose()


@pytest.mark.asyncio
async def test_rejects_non_success_http_response() -> None:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(lambda request: httpx.Response(503, text="unavailable"))
    )
    adapter = PrometheusMetricsAdapter("http://prometheus:9090", client=client)

    with pytest.raises(PrometheusQueryError, match="HTTP 503"):
        await adapter.instant_query("up")

    await client.aclose()


@pytest.mark.asyncio
async def test_rejects_prometheus_error_payload() -> None:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                422,
                json={"status": "error", "errorType": "bad_data", "error": "parse error"},
            )
        )
    )
    adapter = PrometheusMetricsAdapter("http://prometheus:9090", client=client)

    with pytest.raises(PrometheusQueryError, match="HTTP 422"):
        await adapter.instant_query("not valid promql")

    await client.aclose()


@pytest.mark.asyncio
async def test_rejects_unsupported_matrix_response() -> None:
    client = httpx.AsyncClient(
        transport=httpx.MockTransport(
            lambda request: httpx.Response(
                200,
                json={"status": "success", "data": {"resultType": "matrix", "result": []}},
            )
        )
    )
    adapter = PrometheusMetricsAdapter("http://prometheus:9090", client=client)

    with pytest.raises(PrometheusQueryError, match="unsupported result type"):
        await adapter.instant_query("up")

    await client.aclose()
