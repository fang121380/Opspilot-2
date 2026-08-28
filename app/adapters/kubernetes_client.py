from __future__ import annotations

from kubernetes_asyncio import client, config
from kubernetes_asyncio.config.config_exception import ConfigException

from app.adapters.kubernetes import KubernetesDiagnosticsAdapter


async def from_kubeconfig() -> tuple[KubernetesDiagnosticsAdapter, client.ApiClient]:
    """从当前用户 kubeconfig 创建只读诊断适配器。

    调用方负责在应用关闭时关闭返回的 ApiClient。集群权限仍由 kubeconfig
    对应的 ServiceAccount/RBAC 决定，适配器本身不扩大权限。
    """

    try:
        config.load_incluster_config()
    except ConfigException:
        await config.load_kube_config()
    api_client = client.ApiClient()
    return (
        KubernetesDiagnosticsAdapter(
            apps_api=client.AppsV1Api(api_client),
            core_api=client.CoreV1Api(api_client),
        ),
        api_client,
    )
