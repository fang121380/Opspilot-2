"""Persist asynchronous investigation job snapshots."""

import sqlalchemy as sa
from alembic import op

revision = "0003_persist_investigation_jobs"
down_revision = "0002_active_fingerprint"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "investigation_jobs",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("incident_id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("analysis_json", sa.Text(), nullable=True),
        sa.Column("error", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("finished_at", sa.DateTime(timezone=True), nullable=True),
        sa.ForeignKeyConstraint(
            ["incident_id"],
            ["incidents.id"],
            name="fk_investigation_jobs_incident_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_investigation_jobs"),
    )


def downgrade() -> None:
    op.drop_table("investigation_jobs")
