from __future__ import annotations

import os
from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect
from sqlalchemy.engine.reflection import Inspector

INITIAL_REVISION = "0001_initial_schema"
HEAD_REVISION = "0005_unique_proposals"
CORE_TABLES = {
    "incidents",
    "audit_events",
    "remediation_proposals",
    "remediation_approvals",
}
MANAGED_TABLES = CORE_TABLES | {"investigation_jobs"}
INITIAL_INCIDENT_COLUMNS = {
    "id",
    "status",
    "alert_name",
    "alert_fingerprint",
    "service",
    "namespace",
    "severity",
    "summary",
    "started_at",
    "created_at",
    "updated_at",
}


def run_migrations(
    database_url: str | None = None,
    *,
    config_path: str | Path | None = None,
) -> str:
    """Upgrade a managed database, safely adopting known unversioned schemas."""

    url = database_url or os.getenv("OPSPILOT_DATABASE_URL")
    if not url:
        raise RuntimeError("OPSPILOT_DATABASE_URL is required for database migrations")

    configuration = _alembic_config(url, config_path)
    engine = create_engine(url, future=True)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        if "alembic_version" in tables:
            action = "upgraded"
        else:
            managed = tables & MANAGED_TABLES
            if not managed:
                action = "initialized"
            elif not CORE_TABLES <= managed:
                missing = sorted(CORE_TABLES - managed)
                raise RuntimeError(
                    f"refusing to adopt partial Opspilot schema; missing tables: {missing}"
                )
            else:
                action = _adopt_known_schema(configuration, inspector)
    finally:
        engine.dispose()

    command.upgrade(configuration, "head")
    return action


def _adopt_known_schema(configuration: Config, inspector: Inspector) -> str:
    columns = {column["name"] for column in inspector.get_columns("incidents")}
    unique_columns = {
        tuple(constraint.get("column_names") or ())
        for constraint in inspector.get_unique_constraints("incidents")
    }
    indexes = {
        tuple(index.get("column_names") or ())
        for index in inspector.get_indexes("incidents")
        if not index.get("unique")
    }

    if columns >= INITIAL_INCIDENT_COLUMNS | {"active_fingerprint"}:
        if (
            ("active_fingerprint",) not in unique_columns
            or ("alert_fingerprint",) in unique_columns
            or ("alert_fingerprint",) not in indexes
        ):
            raise RuntimeError("refusing to adopt an unknown active_fingerprint schema")
        tables = set(inspector.get_table_names())
        if "investigation_jobs" in tables:
            job_columns = {
                column["name"]
                for column in inspector.get_columns("investigation_jobs")
            }
            expected_job_columns = {
                "id",
                "incident_id",
                "status",
                "analysis_json",
                "error",
                "created_at",
                "finished_at",
            }
            if not expected_job_columns <= job_columns:
                raise RuntimeError("refusing to adopt an unknown investigation_jobs schema")
            if "active_incident_id" in job_columns:
                job_unique_columns = {
                    tuple(constraint.get("column_names") or ())
                    for constraint in inspector.get_unique_constraints(
                        "investigation_jobs"
                    )
                }
                if ("active_incident_id",) not in job_unique_columns:
                    raise RuntimeError(
                        "refusing to adopt jobs without active incident uniqueness"
                    )
                command.stamp(configuration, HEAD_REVISION)
            else:
                command.stamp(configuration, "0003_persist_investigation_jobs")
        else:
            command.stamp(configuration, "0002_active_fingerprint")
        return "adopted-current"

    if columns >= INITIAL_INCIDENT_COLUMNS and "active_fingerprint" not in columns:
        if ("alert_fingerprint",) not in unique_columns:
            raise RuntimeError("refusing to adopt a legacy schema without fingerprint uniqueness")
        command.stamp(configuration, INITIAL_REVISION)
        return "adopted-legacy"

    raise RuntimeError("refusing to adopt an unknown incidents schema")


def _alembic_config(database_url: str, config_path: str | Path | None) -> Config:
    project_root = Path(__file__).resolve().parents[1]
    path = Path(config_path) if config_path is not None else project_root / "alembic.ini"
    configuration = Config(str(path))
    configuration.set_main_option("script_location", str(project_root / "migrations"))
    configuration.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    return configuration


def main() -> None:
    action = run_migrations()
    print(f"数据库迁移完成: {action} -> {HEAD_REVISION}")


if __name__ == "__main__":
    main()
