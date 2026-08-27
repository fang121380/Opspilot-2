from __future__ import annotations

from typing import Protocol

from pydantic import BaseModel, Field


class AppsApi(Protocol):
    async def read_namespaced_deployment_status(self, name: str, namespace: str) -> object: ...


class CoreApi(Protocol):
    async def list_namespaced_pod(self, namespace: str, label_selector: str) -> object: ...

    async def read_namespaced_pod_log(
        self,
        name: str,
        namespace: str,
        *,
        container: str | None,
        tail_lines: int,
        timestamps: bool,
    ) -> str: ...


class DeploymentCondition(BaseModel):
    type: str
    status: str
    reason: str | None = None
    message: str | None = None


class DeploymentStatus(BaseModel):
    name: str
    namespace: str
    generation: int | None = None
    observed_generation: int | None = None
    desired_replicas: int = 0
    available_replicas: int = 0
    updated_replicas: int = 0
    conditions: list[DeploymentCondition] = Field(default_factory=list)


class ContainerSummary(BaseModel):
    name: str
    ready: bool
    restart_count: int
    state: str


class PodSummary(BaseModel):
    name: str
    phase: str
    pod_ip: str | None = None
    containers: list[ContainerSummary] = Field(default_factory=list)


class KubernetesDiagnosticsAdapter:
    """Bounded, read-only Kubernetes diagnostics.

    The adapter speaks directly to injected Kubernetes API clients. No method shells
    out, accepts a raw command, reads Secrets, or changes cluster resources.
    """

    max_log_lines = 500

    def __init__(self, *, apps_api: AppsApi, core_api: CoreApi) -> None:
        self._apps_api = apps_api
        self._core_api = core_api

    async def deployment_status(self, *, namespace: str, name: str) -> DeploymentStatus:
        deployment = await self._apps_api.read_namespaced_deployment_status(
            name=name, namespace=namespace
        )
        metadata = deployment.metadata
        spec = deployment.spec
        status = deployment.status

        conditions = [
            DeploymentCondition(
                type=condition.type,
                status=condition.status,
                reason=getattr(condition, "reason", None),
                message=getattr(condition, "message", None),
            )
            for condition in (getattr(status, "conditions", None) or [])
        ]
        return DeploymentStatus(
            name=metadata.name,
            namespace=namespace,
            generation=getattr(metadata, "generation", None),
            observed_generation=getattr(status, "observed_generation", None),
            desired_replicas=getattr(spec, "replicas", None) or 0,
            available_replicas=getattr(status, "available_replicas", None) or 0,
            updated_replicas=getattr(status, "updated_replicas", None) or 0,
            conditions=conditions,
        )

    async def list_pods(self, *, namespace: str, label_selector: str) -> list[PodSummary]:
        response = await self._core_api.list_namespaced_pod(
            namespace=namespace, label_selector=label_selector
        )
        return [self._pod_summary(pod) for pod in response.items]

    async def tail_pod_logs(
        self,
        *,
        namespace: str,
        pod_name: str,
        container: str | None = None,
        tail_lines: int = 200,
    ) -> str:
        bounded_tail_lines = max(1, min(tail_lines, self.max_log_lines))
        return await self._core_api.read_namespaced_pod_log(
            name=pod_name,
            namespace=namespace,
            container=container,
            tail_lines=bounded_tail_lines,
            timestamps=True,
        )

    @staticmethod
    def _pod_summary(pod: object) -> PodSummary:
        status = pod.status
        containers = [
            ContainerSummary(
                name=container.name,
                ready=container.ready,
                restart_count=container.restart_count,
                state=KubernetesDiagnosticsAdapter._container_state(container),
            )
            for container in (getattr(status, "container_statuses", None) or [])
        ]
        return PodSummary(
            name=pod.metadata.name,
            phase=status.phase,
            pod_ip=getattr(status, "pod_ip", None),
            containers=containers,
        )

    @staticmethod
    def _container_state(container: object) -> str:
        state = container.state
        for name in ("running", "waiting", "terminated"):
            if getattr(state, name, None) is not None:
                return name
        return "unknown"
