from __future__ import annotations

from typing import Protocol

from app.adapters.kubernetes import DeploymentStatus, PodSummary
from app.adapters.prometheus import MetricQueryResult
from app.agent.analysis import AnalysisOutcome, IncidentEvidence, analyze_deployment_regression
from app.domain.incidents import Incident
from app.observability.tracing import current_trace_id, traced
from app.storage.audit import AuditEventType, AuditRepository


class KubernetesDiagnostics(Protocol):
    async def deployment_status(self, *, namespace: str, name: str) -> DeploymentStatus: ...

    async def list_pods(self, *, namespace: str, label_selector: str) -> list[PodSummary]: ...

    async def tail_pod_logs(
        self, *, namespace: str, pod_name: str, container: str | None = None
    ) -> str: ...


class PrometheusDiagnostics(Protocol):
    async def instant_query(self, query: str) -> MetricQueryResult: ...


class IncidentInvestigator:
    """按照固定顺序收集证据并运行 MVP 分析器。"""

    def __init__(
        self,
        *,
        kubernetes: KubernetesDiagnostics,
        prometheus: PrometheusDiagnostics,
        audit_repository: AuditRepository,
    ) -> None:
        self._kubernetes = kubernetes
        self._prometheus = prometheus
        self._audit = audit_repository

    async def investigate(self, incident: Incident) -> AnalysisOutcome:
        if not incident.service or not incident.namespace:
            raise ValueError("incident must contain service and namespace")

        with traced("incident.investigation"):
            deployment = await self._kubernetes.deployment_status(
                namespace=incident.namespace, name=incident.service
            )
            pods = await self._kubernetes.list_pods(
                namespace=incident.namespace, label_selector=f"app={incident.service}"
            )
            # 单个正常副本可能恰好没有承接失败请求；最多采集三个匹配 Pod 的
            # 有界日志，既保留证据覆盖面，又不会把日志读取扩展成无界操作。
            log_chunks: list[str] = []
            for pod in pods[:3]:
                log_chunks.append(
                    await self._kubernetes.tail_pod_logs(
                        namespace=incident.namespace, pod_name=pod.name
                    )
                )
            recent_logs = "\n".join(log_chunks)

            query = (
                "sum(rate(http_requests_total{"
                f'namespace="{_escape_label(incident.namespace)}",'
                f'service="{_escape_label(incident.service)}",code=~"5.."'
                "}[5m]))"
            )
            error_rate = await self._prometheus.instant_query(query)
            trace_id = current_trace_id()
            self._audit.append(
                event_type=AuditEventType.DIAGNOSTIC_COMPLETED,
                incident_id=incident.id,
                trace_id=trace_id,
                payload={"pod_count": len(pods), "prometheus_query": query},
            )
            outcome = analyze_deployment_regression(
                incident,
                IncidentEvidence(
                    deployment=deployment,
                    error_rate=error_rate,
                    recent_logs=recent_logs,
                ),
            )
            self._audit.append(
                event_type=AuditEventType.ANALYSIS_COMPLETED,
                incident_id=incident.id,
                trace_id=trace_id,
                payload={
                    "confidence": outcome.confidence,
                    "recommendation_count": len(outcome.recommended_actions),
                },
            )
            return outcome


def _escape_label(value: str) -> str:
    return value.replace("\\", "\\\\").replace('"', '\\"').replace("\n", "\\n")
