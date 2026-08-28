from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """运行时配置；敏感值只从环境变量读取，不写入仓库。"""

    database_url: str | None = os.getenv("OPSPILOT_DATABASE_URL")
    prometheus_url: str | None = os.getenv("OPSPILOT_PROMETHEUS_URL")
    environment: str = os.getenv("OPSPILOT_ENVIRONMENT", "development")
    allowed_remediation_namespaces: str = os.getenv(
        "OPSPILOT_ALLOWED_REMEDIATION_NAMESPACES", "demo"
    )
    operator_token: str | None = os.getenv("OPSPILOT_OPERATOR_TOKEN")
    operator_id: str | None = os.getenv("OPSPILOT_OPERATOR_ID")
    alertmanager_token: str | None = os.getenv("OPSPILOT_ALERTMANAGER_TOKEN")

    def remediation_namespaces(self) -> set[str]:
        """返回去除空值后的显式回滚命名空间集合。"""

        return {
            namespace.strip()
            for namespace in self.allowed_remediation_namespaces.split(",")
            if namespace.strip()
        }


settings = Settings()
