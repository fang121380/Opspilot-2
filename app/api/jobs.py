from __future__ import annotations

from typing import Annotated
from uuid import UUID

from fastapi import APIRouter, Depends, HTTPException, Request, status

from app.agent.jobs import InvestigationJob, InvestigationJobManager
from app.storage.incidents import IncidentRepository

router = APIRouter(tags=["jobs"])


def job_manager_from_request(request: Request) -> InvestigationJobManager:
    manager = request.app.state.job_manager
    if manager is None:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="investigation job manager is not configured",
        )
    return manager


def repository_from_request(request: Request) -> IncidentRepository:
    return request.app.state.incident_repository


JobDependency = Annotated[InvestigationJobManager, Depends(job_manager_from_request)]
RepositoryDependency = Annotated[IncidentRepository, Depends(repository_from_request)]


@router.post(
    "/incidents/{incident_id}/investigate/jobs", response_model=InvestigationJob, status_code=202
)
async def enqueue_investigation(
    incident_id: UUID,
    repository: RepositoryDependency,
    manager: JobDependency,
) -> InvestigationJob:
    incident = repository.get(str(incident_id))
    if incident is None:
        raise HTTPException(status_code=404, detail="incident not found")
    return manager.enqueue(incident)


@router.get("/investigation/jobs/{job_id}", response_model=InvestigationJob)
async def get_investigation_job(job_id: UUID, manager: JobDependency) -> InvestigationJob:
    job = manager.get(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="investigation job not found")
    return job
