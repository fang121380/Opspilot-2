from fastapi import FastAPI

from app.agent.orchestrator import IncidentInvestigator
from app.api.investigation import router as investigation_router
from app.api.prometheus import router as prometheus_router
from app.observability.metrics import metrics_app
from app.storage.audit import AuditRepository
from app.storage.incidents import IncidentRepository


def create_app(
    *,
    incident_repository: IncidentRepository | None = None,
    audit_repository: AuditRepository | None = None,
    investigator: IncidentInvestigator | None = None,
) -> FastAPI:
    app = FastAPI(
        title="Opspilot 2",
        description="Safety-first AI incident response for Kubernetes workloads.",
        version="0.1.0",
    )
    app.state.incident_repository = incident_repository or IncidentRepository()
    app.state.audit_repository = audit_repository or AuditRepository()
    app.state.investigator = investigator

    @app.get("/health", tags=["system"])
    async def health() -> dict[str, str]:
        """Return a lightweight liveness response."""

        return {"status": "ok", "service": "opspilot-2"}

    app.include_router(prometheus_router)
    app.include_router(investigation_router)
    app.mount("/metrics", metrics_app)
    return app


app = create_app()
