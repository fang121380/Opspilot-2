"""Allow only one active investigation job per incident."""

import sqlalchemy as sa
from alembic import op

revision = "0004_deduplicate_active_jobs"
down_revision = "0003_persist_investigation_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    duplicates = bind.execute(
        sa.text(
            "SELECT incident_id FROM investigation_jobs "
            "WHERE status IN ('queued', 'running') "
            "GROUP BY incident_id HAVING COUNT(*) > 1"
        )
    ).all()
    if duplicates:
        raise RuntimeError(
            "cannot enforce active job uniqueness while duplicate active jobs exist"
        )

    op.add_column(
        "investigation_jobs",
        sa.Column("active_incident_id", sa.String(length=36), nullable=True),
    )
    op.execute(
        sa.text(
            "UPDATE investigation_jobs SET active_incident_id = incident_id "
            "WHERE status IN ('queued', 'running')"
        )
    )
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("investigation_jobs") as batch_op:
            batch_op.create_unique_constraint(
                "uq_investigation_jobs_active_incident_id", ["active_incident_id"]
            )
    else:
        op.create_unique_constraint(
            "uq_investigation_jobs_active_incident_id",
            "investigation_jobs",
            ["active_incident_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("investigation_jobs") as batch_op:
            batch_op.drop_constraint(
                "uq_investigation_jobs_active_incident_id", type_="unique"
            )
            batch_op.drop_column("active_incident_id")
    else:
        op.drop_constraint(
            "uq_investigation_jobs_active_incident_id",
            "investigation_jobs",
            type_="unique",
        )
        op.drop_column("investigation_jobs", "active_incident_id")
