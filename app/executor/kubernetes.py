from __future__ import annotations

from typing import Protocol


class AppsRollbackApi(Protocol):
    async def create_namespaced_deployment_rollback(
        self, name: str, namespace: str, body: object
    ) -> object: ...


class KubernetesRollbackClient:
    """通过 Kubernetes API 执行单一 Deployment 回滚，不调用 kubectl。"""

    def __init__(self, apps_api: AppsRollbackApi) -> None:
        self._apps_api = apps_api

    async def rollback_deployment(self, *, namespace: str, deployment: str, dry_run: bool) -> str:
        if dry_run:
            return f"dry-run: rollback deployment/{deployment} in namespace/{namespace}"
        body = {"kind": "DeploymentRollback", "apiVersion": "apps/v1", "name": deployment}
        await self._apps_api.create_namespaced_deployment_rollback(
            name=deployment, namespace=namespace, body=body
        )
        return f"rollback requested for deployment/{deployment} in namespace/{namespace}"
