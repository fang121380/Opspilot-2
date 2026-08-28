import pytest

from app.executor.kubernetes import KubernetesRollbackClient


class FakeAppsApi:
    def __init__(self) -> None:
        self.request: tuple[str, str, object] | None = None

    async def create_namespaced_deployment_rollback(self, name: str, namespace: str, body: object):
        self.request = (name, namespace, body)


@pytest.mark.asyncio
async def test_rollback_client_uses_typed_kubernetes_api() -> None:
    api = FakeAppsApi()
    client = KubernetesRollbackClient(api)

    result = await client.rollback_deployment(
        namespace="demo", deployment="checkout", dry_run=False
    )

    assert result.startswith("rollback requested")
    assert api.request == (
        "checkout",
        "demo",
        {"kind": "DeploymentRollback", "apiVersion": "apps/v1", "name": "checkout"},
    )


@pytest.mark.asyncio
async def test_rollback_client_dry_run_does_not_call_api() -> None:
    api = FakeAppsApi()
    client = KubernetesRollbackClient(api)

    result = await client.rollback_deployment(namespace="demo", deployment="checkout", dry_run=True)

    assert result.startswith("dry-run")
    assert api.request is None
