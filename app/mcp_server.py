from __future__ import annotations

from typing import Protocol

from mcp.server import MCPServer

from app.adapters.kubernetes import DeploymentStatus, PodSummary
from app.adapters.prometheus import MetricQueryResult


class KubernetesTools(Protocol):
    async def deployment_status(self, *, namespace: str, name: str) -> DeploymentStatus: ...

    async def list_pods(self, *, namespace: str, label_selector: str) -> list[PodSummary]: ...


class PrometheusTools(Protocol):
    async def instant_query(self, query: str) -> MetricQueryResult: ...


def create_mcp_server(
    *,
    kubernetes: KubernetesTools,
    prometheus: PrometheusTools,
) -> MCPServer:
    """创建只读 MCP Server；不注册任何变更工具。"""

    server = MCPServer(
        name="opspilot-2-diagnostics",
        version="0.1.0",
        description="Opspilot 2 的 Kubernetes 和 Prometheus 只读诊断工具。",
    )

    @server.tool()
    async def get_deployment_status(namespace: str, name: str) -> DeploymentStatus:
        """读取 Deployment 副本和 rollout 条件。"""

        return await kubernetes.deployment_status(namespace=namespace, name=name)

    @server.tool()
    async def list_service_pods(namespace: str, service: str) -> list[PodSummary]:
        """按 app 标签读取服务 Pod 摘要。"""

        return await kubernetes.list_pods(namespace=namespace, label_selector=f"app={service}")

    @server.tool()
    async def query_http_error_rate(namespace: str, service: str) -> MetricQueryResult:
        """查询服务 HTTP 5xx rate；只允许构造固定查询模板。"""

        query = (
            "sum(rate(http_requests_total{"
            f'namespace="{_escape_label(namespace)}",'
            f'service="{_escape_label(service)}",code=~"5.."'
            "}[5m]))"
        )
        return await prometheus.instant_query(query)

    return server


def _escape_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
