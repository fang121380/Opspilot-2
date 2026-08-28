from __future__ import annotations

import os
from dataclasses import dataclass


@dataclass(frozen=True)
class Settings:
    """运行时配置；敏感值只从环境变量读取，不写入仓库。"""

    database_url: str | None = os.getenv("OPSPILOT_DATABASE_URL")
    prometheus_url: str | None = os.getenv("OPSPILOT_PROMETHEUS_URL")
    environment: str = os.getenv("OPSPILOT_ENVIRONMENT", "development")


settings = Settings()
