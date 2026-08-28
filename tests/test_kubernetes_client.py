from app.adapters.kubernetes_client import from_kubeconfig


def test_kubernetes_client_factory_is_async_callable() -> None:
    assert from_kubeconfig.__name__ == "from_kubeconfig"
    assert hasattr(from_kubeconfig, "__await__") is False
