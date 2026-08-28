from datetime import UTC, datetime
from pathlib import Path
from threading import Barrier, Thread

from app.domain.incidents import Incident, IncidentStatus
from app.policy.remediation import Approval, RemediationProposal
from app.storage.audit import AuditEventType
from app.storage.sql import SqlAlchemyStore


def make_incident(fingerprint: str = "db-test") -> Incident:
    return Incident(
        alert_name="HighErrorRate",
        alert_fingerprint=fingerprint,
        service="checkout",
        namespace="demo",
        started_at=datetime(2026, 8, 28, 0, 0, tzinfo=UTC),
    )


def test_sql_store_persists_incidents_after_reopening(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'opspilot.db'}"
    incident = make_incident()

    first_store = SqlAlchemyStore(database_url)
    stored, deduplicated = first_store.create_or_get_active(incident)
    assert stored.id == incident.id
    assert deduplicated is False
    first_store.append_audit(
        incident_id=incident.id,
        event_type=AuditEventType.INCIDENT_CREATED,
        payload={"source": "test"},
        trace_id="trace-db",
    )

    reopened = SqlAlchemyStore(database_url)
    duplicate, is_duplicate = reopened.create_or_get_active(make_incident())

    assert is_duplicate is True
    assert duplicate.id == incident.id
    assert reopened.get(str(incident.id)).service == "checkout"
    assert reopened.list_audit(incident.id)[0].payload == {"source": "test"}


def test_sql_store_does_not_confuse_distinct_fingerprints(tmp_path: Path) -> None:
    store = SqlAlchemyStore(f"sqlite:///{tmp_path / 'opspilot.db'}")

    first, _ = store.create_or_get_active(make_incident("one"))
    second, duplicate = store.create_or_get_active(make_incident("two"))

    assert duplicate is False
    assert first.id != second.id
    assert len(store.list()) == 2


def test_sql_store_updates_incident_status_and_timestamp(tmp_path: Path) -> None:
    store = SqlAlchemyStore(f"sqlite:///{tmp_path / 'status.db'}")
    incident, _ = store.create_or_get_active(make_incident())

    updated = store.update_status(str(incident.id), IncidentStatus.AWAITING_APPROVAL)

    assert updated.status == IncidentStatus.AWAITING_APPROVAL
    assert updated.updated_at >= incident.updated_at
    assert store.get(str(incident.id)).status == IncidentStatus.AWAITING_APPROVAL


def test_sql_store_allows_only_one_concurrent_status_claim(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'status-claim.db'}"
    stores = [SqlAlchemyStore(database_url), SqlAlchemyStore(database_url)]
    incident, _ = stores[0].create_or_get_active(make_incident())
    stores[0].update_status(str(incident.id), IncidentStatus.AWAITING_APPROVAL)
    barrier = Barrier(2)
    results: list[Incident | None] = []

    def claim(store: SqlAlchemyStore) -> None:
        barrier.wait(timeout=5)
        results.append(
            store.transition_status(
                str(incident.id),
                expected=IncidentStatus.AWAITING_APPROVAL,
                target=IncidentStatus.EXECUTING,
            )
        )

    threads = [Thread(target=claim, args=(store,)) for store in stores]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)

    assert all(not thread.is_alive() for thread in threads)
    assert sum(result is not None for result in results) == 1
    assert stores[0].get(str(incident.id)).status == IncidentStatus.EXECUTING


def test_sql_store_allows_new_incident_after_previous_one_resolves(tmp_path: Path) -> None:
    store = SqlAlchemyStore(f"sqlite:///{tmp_path / 'lifecycle.db'}")
    first, _ = store.create_or_get_active(make_incident("recurring-alert"))
    store.update_status(str(first.id), IncidentStatus.RESOLVED)

    second, deduplicated = store.create_or_get_active(make_incident("recurring-alert"))

    assert deduplicated is False
    assert second.id != first.id
    assert len(store.list()) == 2


def test_sql_store_keeps_only_one_active_fingerprint(tmp_path: Path) -> None:
    store = SqlAlchemyStore(f"sqlite:///{tmp_path / 'active-fingerprint.db'}")

    first, _ = store.create_or_get_active(make_incident("active-alert"))
    second, deduplicated = store.create_or_get_active(make_incident("active-alert"))

    assert deduplicated is True
    assert second.id == first.id


def test_sql_store_deduplicates_concurrent_active_fingerprints(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'concurrent-fingerprint.db'}"
    stores = [SqlAlchemyStore(database_url), SqlAlchemyStore(database_url)]
    barrier = Barrier(2)
    results: list[tuple[Incident, bool]] = []

    for store in stores:
        original = store._incident_row

        def synchronized_row(
            incident: Incident, *, _original=original
        ):  # pragma: no branch
            barrier.wait(timeout=5)
            return _original(incident)

        store._incident_row = synchronized_row  # type: ignore[method-assign]

    threads = [
        Thread(
            target=lambda current=store: results.append(
                current.create_or_get_active(make_incident("concurrent-alert"))
            )
        )
        for store in stores
    ]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join(timeout=5)

    assert all(not thread.is_alive() for thread in threads)
    assert len(results) == 2
    assert {str(incident.id) for incident, _ in results} == {str(stores[0].list()[0].id)}
    assert sorted(deduplicated for _, deduplicated in results) == [False, True]


def test_sql_store_persists_proposal_and_approval_after_reopening(tmp_path: Path) -> None:
    database_url = f"sqlite:///{tmp_path / 'opspilot.db'}"
    store = SqlAlchemyStore(database_url)
    incident, _ = store.create_or_get_active(make_incident())
    proposal = RemediationProposal(
        incident_id=incident.id,
        action="rollback_deployment",
        namespace="demo",
        deployment="checkout",
    )
    approval = Approval(
        proposal_id=proposal.id,
        approved_by="operator",
        approved_at=datetime(2026, 8, 28, tzinfo=UTC),
        expires_at=datetime(2026, 8, 28, 1, tzinfo=UTC),
    )
    store.add_proposal(proposal)
    store.add_approval(approval)

    reopened = SqlAlchemyStore(database_url)

    assert reopened.get_proposal(proposal.id).deployment == "checkout"
    assert reopened.get_approval(approval.id).approved_by == "operator"
