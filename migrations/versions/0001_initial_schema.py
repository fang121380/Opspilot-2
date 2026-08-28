"""Create the initial Opspilot relational schema."""

import sqlalchemy as sa
from alembic import op

revision = "0001_initial_schema"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "incidents",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False),
        sa.Column("alert_name", sa.String(length=255), nullable=False),
        sa.Column("alert_fingerprint", sa.String(length=255), nullable=False),
        sa.Column("service", sa.String(length=255), nullable=True),
        sa.Column("namespace", sa.String(length=255), nullable=True),
        sa.Column("severity", sa.String(length=32), nullable=False),
        sa.Column("summary", sa.Text(), nullable=True),
        sa.Column("started_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), nullable=False),
        sa.PrimaryKeyConstraint("id", name="pk_incidents"),
        sa.UniqueConstraint(
            "alert_fingerprint", name="uq_incidents_alert_fingerprint"
        ),
    )
    op.create_table(
        "audit_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("incident_id", sa.String(length=36), nullable=True),
        sa.Column("event_type", sa.String(length=64), nullable=False),
        sa.Column("payload_json", sa.Text(), nullable=False),
        sa.Column("trace_id", sa.String(length=64), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["incident_id"], ["incidents.id"], name="fk_audit_events_incident_id"
        ),
        sa.PrimaryKeyConstraint("id", name="pk_audit_events"),
    )
    op.create_table(
        "remediation_proposals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("incident_id", sa.String(length=36), nullable=False),
        sa.Column("action", sa.String(length=64), nullable=False),
        sa.Column("namespace", sa.String(length=255), nullable=False),
        sa.Column("deployment", sa.String(length=255), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["incident_id"],
            ["incidents.id"],
            name="fk_remediation_proposals_incident_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_remediation_proposals"),
    )
    op.create_table(
        "remediation_approvals",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("proposal_id", sa.String(length=36), nullable=False),
        sa.Column("approved_by", sa.String(length=255), nullable=False),
        sa.Column("approved_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.ForeignKeyConstraint(
            ["proposal_id"],
            ["remediation_proposals.id"],
            name="fk_remediation_approvals_proposal_id",
        ),
        sa.PrimaryKeyConstraint("id", name="pk_remediation_approvals"),
    )


def downgrade() -> None:
    op.drop_table("remediation_approvals")
    op.drop_table("remediation_proposals")
    op.drop_table("audit_events")
    op.drop_table("incidents")
