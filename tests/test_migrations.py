from datetime import UTC, datetime
from pathlib import Path

import pytest
import sqlalchemy as sa
from alembic import command

from app.domain.incidents import Incident
from app.migrate import INITIAL_REVISION, _alembic_config, run_migrations
from app.storage.sql import Base, SqlAlchemyStore


def database_url(path: Path) -> str:
    return f"sqlite:///{path}"


def current_revision(engine: sa.Engine) -> str:
    with engine.connect() as connection:
        return connection.scalar(sa.text("SELECT version_num FROM alembic_version"))


def test_migrations_initialize_fresh_database(tmp_path: Path) -> None:
    url = database_url(tmp_path / "fresh.db")

    action = run_migrations(url)

    engine = sa.create_engine(url)
    inspector = sa.inspect(engine)
    assert action == "initialized"
    assert current_revision(engine) == "0004_deduplicate_active_jobs"
    assert "active_fingerprint" in {
        column["name"] for column in inspector.get_columns("incidents")
    }
    unique_columns = {
        tuple(item["column_names"])
        for item in inspector.get_unique_constraints("incidents")
    }
    assert unique_columns == {("active_fingerprint",)}
    assert "investigation_jobs" in inspector.get_table_names()
    assert run_migrations(url) == "upgraded"


def test_migrations_adopt_current_unversioned_schema(tmp_path: Path) -> None:
    url = database_url(tmp_path / "current.db")
    engine = sa.create_engine(url)
    Base.metadata.create_all(engine)

    action = run_migrations(url)

    assert action == "adopted-current"
    assert current_revision(engine) == "0004_deduplicate_active_jobs"


def test_migrations_upgrade_legacy_unversioned_schema_without_losing_history(
    tmp_path: Path,
) -> None:
    url = database_url(tmp_path / "legacy.db")
    configuration = _alembic_config(url, None)
    command.upgrade(configuration, INITIAL_REVISION)
    engine = sa.create_engine(url)
    timestamp = datetime(2026, 8, 28, tzinfo=UTC)
    with engine.begin() as connection:
        connection.execute(sa.text("DROP TABLE alembic_version"))
        connection.execute(
            sa.text(
                "INSERT INTO incidents "
                "(id, status, alert_name, alert_fingerprint, severity, started_at, "
                "created_at, updated_at) VALUES "
                "(:id, :status, 'HighErrorRate', :fingerprint, 'critical', :timestamp, "
                ":timestamp, :timestamp)"
            ),
            [
                {
                    "id": "00000000-0000-0000-0000-000000000001",
                    "status": "received",
                    "fingerprint": "active-before-migration",
                    "timestamp": timestamp.isoformat(),
                },
                {
                    "id": "00000000-0000-0000-0000-000000000002",
                    "status": "resolved",
                    "fingerprint": "resolved-before-migration",
                    "timestamp": timestamp.isoformat(),
                },
            ],
        )

    action = run_migrations(url)

    with engine.connect() as connection:
        rows = connection.execute(
            sa.text(
                "SELECT alert_fingerprint, active_fingerprint FROM incidents "
                "ORDER BY alert_fingerprint"
            )
        ).all()
    assert action == "adopted-legacy"
    assert rows == [
        ("active-before-migration", "active-before-migration"),
        ("resolved-before-migration", None),
    ]
    store = SqlAlchemyStore(url, create_schema=False)
    repeated, deduplicated = store.create_or_get_active(
        Incident(
            alert_name="HighErrorRate",
            alert_fingerprint="resolved-before-migration",
            service="checkout",
            namespace="demo",
            started_at=timestamp,
        )
    )
    assert deduplicated is False
    assert str(repeated.id) != "00000000-0000-0000-0000-000000000002"


def test_migrations_refuse_partial_unversioned_schema(tmp_path: Path) -> None:
    url = database_url(tmp_path / "partial.db")
    engine = sa.create_engine(url)
    with engine.begin() as connection:
        connection.execute(sa.text("CREATE TABLE incidents (id VARCHAR(36) PRIMARY KEY)"))

    with pytest.raises(RuntimeError, match="partial Opspilot schema"):
        run_migrations(url)


def test_migrations_require_database_url(monkeypatch: pytest.MonkeyPatch) -> None:
    monkeypatch.delenv("OPSPILOT_DATABASE_URL", raising=False)

    with pytest.raises(RuntimeError, match="OPSPILOT_DATABASE_URL is required"):
        run_migrations()


def test_active_job_migration_refuses_ambiguous_duplicates(tmp_path: Path) -> None:
    url = database_url(tmp_path / "duplicate-jobs.db")
    configuration = _alembic_config(url, None)
    command.upgrade(configuration, "0003_persist_investigation_jobs")
    engine = sa.create_engine(url)
    timestamp = datetime(2026, 8, 28, tzinfo=UTC).isoformat()
    incident_id = "00000000-0000-0000-0000-000000000031"
    with engine.begin() as connection:
        connection.execute(
            sa.text(
                "INSERT INTO incidents "
                "(id, status, alert_name, alert_fingerprint, active_fingerprint, "
                "severity, started_at, created_at, updated_at) VALUES "
                "(:id, 'received', 'HighErrorRate', 'duplicate-jobs', "
                "'duplicate-jobs', 'critical', :timestamp, :timestamp, :timestamp)"
            ),
            {"id": incident_id, "timestamp": timestamp},
        )
        connection.execute(
            sa.text(
                "INSERT INTO investigation_jobs "
                "(id, incident_id, status, created_at) VALUES "
                "('00000000-0000-0000-0000-000000000032', :incident_id, "
                "'queued', :timestamp), "
                "('00000000-0000-0000-0000-000000000033', :incident_id, "
                "'running', :timestamp)"
            ),
            {"incident_id": incident_id, "timestamp": timestamp},
        )

    with pytest.raises(RuntimeError, match="duplicate active jobs"):
        run_migrations(url)

    assert "active_incident_id" not in {
        column["name"] for column in sa.inspect(engine).get_columns("investigation_jobs")
    }
