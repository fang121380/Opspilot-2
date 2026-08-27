from types import SimpleNamespace

import pytest

from app.adapters.kubernetes import KubernetesDiagnosticsAdapter


class FakeAppsApi:
    async def read_namespaced_deployment_status(self, name: str, namespace: str) -> object:
        assert name == "checkout"
        assert namespace == "demo"
        return SimpleNamespace(
            metadata=SimpleNamespace(name="checkout", generation=7),
            spec=SimpleNamespace(replicas=3),
            status=SimpleNamespace(
                observed_generation=7,
                available_replicas=2,
                updated_replicas=2,
                conditions=[
                    SimpleNamespace(
                        type="Progressing",
                        status="True",
                        reason="NewReplicaSetAvailable",
                        message="ReplicaSet checkout-v2 has successfully progressed.",
                    )
                ],
            ),
        )


class FakeCoreApi:
    def __init__(self) -> None:
        self.log_tail_lines: int | None = None

    async def list_namespaced_pod(self, namespace: str, label_selector: str) -> object:
        assert namespace == "demo"
        assert label_selector == "app=checkout"
        return SimpleNamespace(
            items=[
                SimpleNamespace(
                    metadata=SimpleNamespace(name="checkout-7f6bc", creation_timestamp=None),
                    status=SimpleNamespace(
                        phase="Running",
                        pod_ip="10.0.0.2",
                        container_statuses=[
                            SimpleNamespace(
                                name="checkout",
                                ready=True,
                                restart_count=1,
                                state=SimpleNamespace(
                                    running=SimpleNamespace(started_at=None),
                                    waiting=None,
                                    terminated=None,
                                ),
                            )
                        ],
                    ),
                )
            ]
        )

    async def read_namespaced_pod_log(
        self,
        name: str,
        namespace: str,
        *,
        container: str | None,
        tail_lines: int,
        timestamps: bool,
    ) -> str:
        assert (name, namespace, container, timestamps) == (
            "checkout-7f6bc",
            "demo",
            "checkout",
            True,
        )
        self.log_tail_lines = tail_lines
        return "2026-08-27T08:00:00Z ERROR request failed\n"


@pytest.mark.asyncio
async def test_returns_typed_deployment_status_without_raw_kubernetes_object() -> None:
    adapter = KubernetesDiagnosticsAdapter(apps_api=FakeAppsApi(), core_api=FakeCoreApi())

    deployment = await adapter.deployment_status(namespace="demo", name="checkout")

    assert deployment.model_dump() == {
        "name": "checkout",
        "namespace": "demo",
        "generation": 7,
        "observed_generation": 7,
        "desired_replicas": 3,
        "available_replicas": 2,
        "updated_replicas": 2,
        "conditions": [
            {
                "type": "Progressing",
                "status": "True",
                "reason": "NewReplicaSetAvailable",
                "message": "ReplicaSet checkout-v2 has successfully progressed.",
            }
        ],
    }


@pytest.mark.asyncio
async def test_returns_pod_summaries_and_bounded_logs() -> None:
    core_api = FakeCoreApi()
    adapter = KubernetesDiagnosticsAdapter(apps_api=FakeAppsApi(), core_api=core_api)

    pods = await adapter.list_pods(namespace="demo", label_selector="app=checkout")
    logs = await adapter.tail_pod_logs(
        namespace="demo", pod_name="checkout-7f6bc", container="checkout", tail_lines=10_000
    )

    assert pods[0].model_dump() == {
        "name": "checkout-7f6bc",
        "phase": "Running",
        "pod_ip": "10.0.0.2",
        "containers": [
            {
                "name": "checkout",
                "ready": True,
                "restart_count": 1,
                "state": "running",
            }
        ],
    }
    assert core_api.log_tail_lines == 500
    assert logs == "2026-08-27T08:00:00Z ERROR request failed\n"
