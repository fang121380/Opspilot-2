from __future__ import annotations

import argparse
import json
import os
from collections.abc import Sequence
from dataclasses import asdict, dataclass
from typing import Protocol

from app.domain.incidents import Incident, IncidentStatus
from app.storage.jobs import InvestigationJobRepository
from app.storage.sql import SqlAlchemyStore

INTERRUPTED_JOB_ERROR = "ProcessRestarted"


@dataclass(frozen=True)
class JobRecoveryResult:
    candidates: int
    failed_jobs: int
    reset_incidents: int


class IncidentTransitionRepository(Protocol):
    def transition_status(
        self,
        incident_id: str,
        *,
        expected: IncidentStatus,
        target: IncidentStatus,
    ) -> Incident | None: ...


def recover_active_jobs(
    jobs: InvestigationJobRepository,
    incidents: IncidentTransitionRepository,
) -> JobRecoveryResult:
    """Mark persisted interrupted jobs failed without restarting their work."""

    candidates = jobs.list_active_jobs()
    failed_jobs = 0
    reset_incidents = 0
    for candidate in candidates:
        failed = jobs.fail_active_job(candidate.id, INTERRUPTED_JOB_ERROR)
        if failed is None:
            continue
        failed_jobs += 1
        transitioned = incidents.transition_status(
            str(failed.incident_id),
            expected=IncidentStatus.INVESTIGATING,
            target=IncidentStatus.RECEIVED,
        )
        if transitioned is not None:
            reset_incidents += 1
    return JobRecoveryResult(
        candidates=len(candidates),
        failed_jobs=failed_jobs,
        reset_incidents=reset_incidents,
    )


def main(argv: Sequence[str] | None = None) -> int:
    parser = argparse.ArgumentParser(
        description="Safely recover persisted Opspilot investigation Job snapshots."
    )
    parser.add_argument("--database-url", default=os.getenv("OPSPILOT_DATABASE_URL"))
    parser.add_argument(
        "--confirm",
        action="store_true",
        help="mark all currently active snapshots as ProcessRestarted",
    )
    args = parser.parse_args(argv)
    if not args.database_url:
        parser.error("--database-url or OPSPILOT_DATABASE_URL is required")

    store = SqlAlchemyStore(args.database_url, create_schema=False)
    candidates = store.list_active_jobs()
    if not args.confirm:
        print(
            json.dumps(
                {
                    "dry_run": True,
                    "active_job_ids": [str(job.id) for job in candidates],
                    "message": "re-run with --confirm only after all API and worker processes stop",
                },
                ensure_ascii=False,
            )
        )
        return 0

    result = recover_active_jobs(store, store)
    print(json.dumps(asdict(result), ensure_ascii=False))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
