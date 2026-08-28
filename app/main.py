import logging
from collections.abc import AsyncIterator
from contextlib import asynccontextmanager

import httpx
from fastapi import FastAPI, HTTPException
from kubernetes_asyncio import client

from app.adapters.kubernetes_client import from_kubeconfig
from app.adapters.prometheus import PrometheusMetricsAdapter
from app.agent.jobs import InvestigationJobManager
from app.agent.orchestrator import IncidentInvestigator
from app.agent.verification import IncidentVerifier
from app.api.investigation import router as investigation_router
from app.api.jobs import router as jobs_router
from app.api.prometheus import router as prometheus_router
from app.api.remediation import router as remediation_router
from app.api.verification import router as verification_router
from app.config import settings
from app.executor.kubernetes import KubernetesRollbackClient
from app.observability.metrics import metrics_app
from app.policy.remediation import RemediationExecutor, RemediationPolicy
from app.security.auth import BearerTokenAuthenticator
from app.storage.audit import AuditRepository
from app.storage.incidents import IncidentRepository
from app.storage.remediation import RemediationRepository
from app.storage.sql import SqlAlchemyStore

logger = logging.getLogger(__name__)


def create_app(
    *,
    incident_repository: IncidentRepository | None = None,
    audit_repository: AuditRepository | None = None,
    investigator: IncidentInvestigator | None = None,
    remediation_executor: object | None = None,
    remediation_repository: RemediationRepository | None = None,
    job_manager: object | None = None,
    verifier: object | None = None,
    operator_authenticator: BearerTokenAuthenticator | None = None,
    alert_authenticator: BearerTokenAuthenticator | None = None,
    database_url: str | None = None,
) -> FastAPI:
    relational_store = (
        SqlAlchemyStore(database_url or settings.database_url)
        if (database_url or settings.database_url)
        else None
    )

    @asynccontextmanager
    async def lifespan(runtime_app: FastAPI) -> AsyncIterator[None]:
        http_client: httpx.AsyncClient | None = None
        kubernetes_client = None
        if runtime_app.state.investigator is None and settings.prometheus_url:
            try:
                kubernetes, kubernetes_client = await from_kubeconfig()
                http_client = httpx.AsyncClient()
                prometheus = PrometheusMetricsAdapter(settings.prometheus_url, client=http_client)
                runtime_app.state.investigator = IncidentInvestigator(
                    kubernetes=kubernetes,
                    prometheus=prometheus,
                    audit_repository=runtime_app.state.audit_repository,
                )
                if runtime_app.state.remediation_executor is None:
                    runtime_app.state.remediation_executor = runtime_remediation_executor(
                        client.AppsV1Api(kubernetes_client), settings.remediation_namespaces()
                    )
                if runtime_app.state.job_manager is None:
                    runtime_app.state.job_manager = InvestigationJobManager(
                        runtime_app.state.investigator,
                        runtime_app.state.incident_repository,
                        runtime_app.state.audit_repository,
                    )
                if runtime_app.state.verifier is None:
                    runtime_app.state.verifier = IncidentVerifier(prometheus)
                logger.info("已配置 Kubernetes 和 Prometheus 调查依赖")
            except Exception as error:  # noqa: BLE001 - 运行时依赖应保持 API 可用
                logger.warning(
                    "无法配置调查依赖，调查接口将返回 503（%s）",
                    type(error).__name__,
                )
                if http_client is not None:
                    await http_client.aclose()
                    http_client = None
        yield
        if http_client is not None:
            await http_client.aclose()
        if kubernetes_client is not None:
            await kubernetes_client.close()

    app = FastAPI(
        title="Opspilot 2",
        description="Safety-first AI incident response for Kubernetes workloads.",
        version="0.1.0",
        lifespan=lifespan,
    )
    app.state.incident_repository = incident_repository or relational_store or IncidentRepository()
    app.state.audit_repository = audit_repository or relational_store or AuditRepository()
    app.state.investigator = investigator
    app.state.remediation_executor = remediation_executor
    app.state.remediation_repository = (
        remediation_repository or relational_store or RemediationRepository()
    )
    app.state.job_manager = job_manager or (
        InvestigationJobManager(
            investigator,
            app.state.incident_repository,
            app.state.audit_repository,
        )
        if investigator is not None
        else None
    )
    app.state.verifier = verifier
    app.state.operator_authenticator = (
        operator_authenticator
        if operator_authenticator is not None
        else runtime_operator_authenticator()
    )
    app.state.alert_authenticator = (
        alert_authenticator
        if alert_authenticator is not None
        else runtime_alert_authenticator()
    )

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        """Return a lightweight liveness response."""

        return {"status": "ok", "service": "opspilot-2"}

    @app.get("/ready", tags=["system"])
    async def ready() -> dict[str, str]:
        """Return ready only after all incident workflow dependencies are wired."""

        dependencies = {
            "alert_authenticator": app.state.alert_authenticator,
            "investigator": app.state.investigator,
            "job_manager": app.state.job_manager,
            "operator_authenticator": app.state.operator_authenticator,
            "remediation_executor": app.state.remediation_executor,
            "verifier": app.state.verifier,
        }
        missing = sorted(name for name, dependency in dependencies.items() if dependency is None)
        if missing:
            raise HTTPException(
                status_code=503,
                detail={"status": "not_ready", "missing_dependencies": missing},
            )
        return {"status": "ready", "service": "opspilot-2"}

    app.include_router(prometheus_router)
    app.include_router(investigation_router)
    app.include_router(remediation_router)
    app.include_router(jobs_router)
    app.include_router(verification_router)
    app.mount("/metrics", metrics_app)
    return app


def runtime_remediation_executor(
    apps_api: client.AppsV1Api, allowed_namespaces: set[str]
) -> RemediationExecutor:
    """构造运行时唯一允许的、审批门控的 Kubernetes 回滚执行器。"""

    return RemediationExecutor(
        policy=RemediationPolicy(allowed_namespaces=allowed_namespaces),
        rollback_client=KubernetesRollbackClient(apps_api),
    )


def runtime_operator_authenticator() -> BearerTokenAuthenticator | None:
    """Build fail-closed operator authentication from deployment secrets."""

    if not settings.operator_token and not settings.operator_id:
        return None
    if not settings.operator_token or not settings.operator_id:
        raise RuntimeError(
            "OPSPILOT_OPERATOR_TOKEN and OPSPILOT_OPERATOR_ID must be configured together"
        )
    return BearerTokenAuthenticator(
        token=settings.operator_token,
        subject=settings.operator_id,
    )


def runtime_alert_authenticator() -> BearerTokenAuthenticator | None:
    """Build fail-closed Alertmanager source authentication."""

    if not settings.alertmanager_token:
        return None
    return BearerTokenAuthenticator(
        token=settings.alertmanager_token,
        subject="alertmanager",
    )


app = create_app()
