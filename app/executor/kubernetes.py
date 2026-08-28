from __future__ import annotations

from typing import Protocol


class AppsRollbackApi(Protocol):
    async def read_namespaced_deployment(self, name: str, namespace: str) -> object: ...

    async def list_namespaced_replica_set(self, namespace: str) -> object: ...

    async def patch_namespaced_deployment(
        self, name: str, namespace: str, body: object
    ) -> object: ...


class RollbackUnavailableError(RuntimeError):
    """当前 Deployment 没有可用的前一版本时抛出。"""


class KubernetesRollbackClient:
    """通过当前 AppsV1 API 回滚 Deployment，不调用 kubectl。

    Kubernetes 已移除旧的 DeploymentRollback API。此实现读取 Deployment 拥有的
    ReplicaSet，选择前一 revision 的 Pod 模板，再以 patch 更新 Deployment。
    """

    def __init__(self, apps_api: AppsRollbackApi) -> None:
        self._apps_api = apps_api

    async def rollback_deployment(self, *, namespace: str, deployment: str, dry_run: bool) -> str:
        if dry_run:
            return f"dry-run: rollback deployment/{deployment} in namespace/{namespace}"
        current = await self._apps_api.read_namespaced_deployment(
            name=deployment, namespace=namespace
        )
        replica_sets = await self._apps_api.list_namespaced_replica_set(namespace=namespace)
        previous = self._previous_replica_set(current, replica_sets.items)
        template = previous.spec.template.to_dict()
        template.get("metadata", {}).get("labels", {}).pop("pod-template-hash", None)
        await self._apps_api.patch_namespaced_deployment(
            name=deployment,
            namespace=namespace,
            body={"spec": {"template": template}},
        )
        return f"rollback requested for deployment/{deployment} in namespace/{namespace}"

    @staticmethod
    def _previous_replica_set(deployment: object, replica_sets: list[object]) -> object:
        deployment_uid = deployment.metadata.uid
        owned = [
            replica_set
            for replica_set in replica_sets
            if any(
                reference.uid == deployment_uid and getattr(reference, "controller", False)
                for reference in (replica_set.metadata.owner_references or [])
            )
        ]
        if len(owned) < 2:
            raise RollbackUnavailableError("no previous ReplicaSet is available for rollback")
        owned.sort(
            key=lambda replica_set: int(
                replica_set.metadata.annotations.get("deployment.kubernetes.io/revision", "0")
            ),
            reverse=True,
        )
        return owned[1]
