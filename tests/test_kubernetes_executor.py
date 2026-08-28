from types import SimpleNamespace

import pytest

from app.executor.kubernetes import KubernetesRollbackClient, RollbackUnavailableError


class FakeAppsApi:
    def __init__(self) -> None:
        self.request: tuple[str, str, object] | None = None
        self.deployment = SimpleNamespace(metadata=SimpleNamespace(uid="deployment-uid"))
        self.replica_sets = SimpleNamespace(
            items=[
                _replica_set("checkout-current", "2", "deployment-uid", "new-image"),
                _replica_set("checkout-previous", "1", "deployment-uid", "old-image"),
            ]
        )

    async def read_namespaced_deployment(self, name: str, namespace: str) -> object:
        return self.deployment

    async def list_namespaced_replica_set(self, namespace: str) -> object:
        return self.replica_sets

    async def patch_namespaced_deployment(self, name: str, namespace: str, body: object) -> object:
        self.request = (name, namespace, body)
        return SimpleNamespace()


def _replica_set(name: str, revision: str, owner_uid: str, image: str) -> object:
    template = SimpleNamespace(
        to_dict=lambda: {
            "metadata": {"labels": {"app": "checkout", "pod-template-hash": name}},
            "spec": {"containers": [{"name": "checkout", "image": image}]},
        }
    )
    return SimpleNamespace(
        metadata=SimpleNamespace(
            name=name,
            annotations={"deployment.kubernetes.io/revision": revision},
            owner_references=[SimpleNamespace(uid=owner_uid, controller=True)],
        ),
        spec=SimpleNamespace(template=template),
    )


@pytest.mark.asyncio
async def test_rollback_client_restores_previous_owned_replica_set_template() -> None:
    api = FakeAppsApi()
    client = KubernetesRollbackClient(api)

    result = await client.rollback_deployment(
        namespace="demo", deployment="checkout", dry_run=False
    )

    assert result.startswith("rollback requested")
    assert api.request == (
        "checkout",
        "demo",
        {
            "spec": {
                "template": {
                    "metadata": {"labels": {"app": "checkout"}},
                    "spec": {"containers": [{"name": "checkout", "image": "old-image"}]},
                }
            }
        },
    )


@pytest.mark.asyncio
async def test_rollback_client_dry_run_does_not_call_api() -> None:
    api = FakeAppsApi()
    client = KubernetesRollbackClient(api)

    result = await client.rollback_deployment(namespace="demo", deployment="checkout", dry_run=True)

    assert result.startswith("dry-run")
    assert api.request is None


@pytest.mark.asyncio
async def test_rollback_client_rejects_when_no_previous_revision_exists() -> None:
    api = FakeAppsApi()
    api.replica_sets.items = [api.replica_sets.items[0]]
    client = KubernetesRollbackClient(api)

    with pytest.raises(RollbackUnavailableError, match="no previous ReplicaSet"):
        await client.rollback_deployment(namespace="demo", deployment="checkout", dry_run=False)

    assert api.request is None
