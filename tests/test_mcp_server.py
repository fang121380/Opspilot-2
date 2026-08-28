
import pytest
from mcp import Client

from app.adapters.kubernetes import DeploymentStatus, PodSummary
from app.adapters.prometheus import MetricQueryResult
from app.mcp_server import create_mcp_server


class FakeKubernetes:
    async def deployment_status(self, *, namespace: str, name: str) -> DeploymentStatus:
        return DeploymentStatus(name=name, namespace=namespace, desired_replicas=2)

    async def list_pods(self, *, namespace: str, label_selector: str) -> list[PodSummary]:
        return [PodSummary(name="checkout-1", phase="Running")]


class FakePrometheus:
    async def instant_query(self, query: str) -> MetricQueryResult:
        return MetricQueryResult(query=query)


@pytest.mark.anyio
async def test_mcp_server_exposes_only_readonly_diagnostic_tools() -> None:
    server = create_mcp_server(kubernetes=FakeKubernetes(), prometheus=FakePrometheus())

    async with Client(server) as client:
        tools = await client.list_tools()
        names = {tool.name for tool in tools.tools}
        result = await client.call_tool(
            "query_http_error_rate", {"namespace": "demo", "service": "checkout"}
        )

    assert names == {"get_deployment_status", "list_service_pods", "query_http_error_rate"}
    assert result.structured_content["query"] == (
        'sum(rate(http_requests_total{namespace="demo",service="checkout",code=~"5.."}[5m]))'
    )


@pytest.mark.anyio
async def test_mcp_tools_return_structured_deployment_and_pod_data() -> None:
    server = create_mcp_server(kubernetes=FakeKubernetes(), prometheus=FakePrometheus())

    async with Client(server) as client:
        deployment = await client.call_tool(
            "get_deployment_status", {"namespace": "demo", "name": "checkout"}
        )
        pods = await client.call_tool(
            "list_service_pods", {"namespace": "demo", "service": "checkout"}
        )

    assert deployment.structured_content["name"] == "checkout"
    assert pods.structured_content["result"][0]["phase"] == "Running"
