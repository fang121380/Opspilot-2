"""Ensure each incident has at most one remediation proposal."""

import sqlalchemy as sa
from alembic import op

revision = "0005_unique_proposals"
down_revision = "0004_deduplicate_active_jobs"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    duplicates = bind.execute(
        sa.text(
            "SELECT incident_id FROM remediation_proposals "
            "GROUP BY incident_id HAVING COUNT(*) > 1"
        )
    ).all()
    if duplicates:
        raise RuntimeError(
            "cannot enforce proposal uniqueness while duplicate incident proposals exist"
        )
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("remediation_proposals") as batch_op:
            batch_op.create_unique_constraint(
                "uq_remediation_proposals_incident_id", ["incident_id"]
            )
    else:
        op.create_unique_constraint(
            "uq_remediation_proposals_incident_id",
            "remediation_proposals",
            ["incident_id"],
        )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table("remediation_proposals") as batch_op:
            batch_op.drop_constraint(
                "uq_remediation_proposals_incident_id", type_="unique"
            )
    else:
        op.drop_constraint(
            "uq_remediation_proposals_incident_id",
            "remediation_proposals",
            type_="unique",
        )
