"""Deduplicate only active incidents while preserving recurring history."""

import sqlalchemy as sa
from alembic import op

revision = "0002_active_fingerprint"
down_revision = "0001_initial_schema"
branch_labels = None
depends_on = None

NAMING_CONVENTION = {"uq": "uq_%(table_name)s_%(column_0_name)s"}


def upgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table(
            "incidents", naming_convention=NAMING_CONVENTION
        ) as batch_op:
            batch_op.add_column(sa.Column("active_fingerprint", sa.String(255)))
            batch_op.drop_constraint(
                "uq_incidents_alert_fingerprint", type_="unique"
            )
            batch_op.create_index(
                "ix_incidents_alert_fingerprint", ["alert_fingerprint"]
            )
            batch_op.create_unique_constraint(
                "uq_incidents_active_fingerprint", ["active_fingerprint"]
            )
    else:
        constraints = sa.inspect(bind).get_unique_constraints("incidents")
        legacy = next(
            (
                constraint
                for constraint in constraints
                if constraint.get("column_names") == ["alert_fingerprint"]
            ),
            None,
        )
        if legacy is None or not legacy.get("name"):
            raise RuntimeError("legacy alert_fingerprint unique constraint not found")
        op.add_column(
            "incidents", sa.Column("active_fingerprint", sa.String(255))
        )
        op.drop_constraint(legacy["name"], "incidents", type_="unique")
        op.create_index(
            "ix_incidents_alert_fingerprint",
            "incidents",
            ["alert_fingerprint"],
        )
        op.create_unique_constraint(
            "uq_incidents_active_fingerprint",
            "incidents",
            ["active_fingerprint"],
        )

    op.execute(
        sa.text(
            "UPDATE incidents SET active_fingerprint = alert_fingerprint "
            "WHERE status NOT IN ('resolved', 'closed')"
        )
    )


def downgrade() -> None:
    bind = op.get_bind()
    if bind.dialect.name == "sqlite":
        with op.batch_alter_table(
            "incidents", naming_convention=NAMING_CONVENTION
        ) as batch_op:
            batch_op.drop_constraint(
                "uq_incidents_active_fingerprint", type_="unique"
            )
            batch_op.drop_index("ix_incidents_alert_fingerprint")
            batch_op.drop_column("active_fingerprint")
            batch_op.create_unique_constraint(
                "uq_incidents_alert_fingerprint", ["alert_fingerprint"]
            )
    else:
        op.drop_constraint(
            "uq_incidents_active_fingerprint", "incidents", type_="unique"
        )
        op.drop_index("ix_incidents_alert_fingerprint", table_name="incidents")
        op.drop_column("incidents", "active_fingerprint")
        op.create_unique_constraint(
            "uq_incidents_alert_fingerprint",
            "incidents",
            ["alert_fingerprint"],
        )
