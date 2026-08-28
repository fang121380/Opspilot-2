from __future__ import annotations

import re

DNS_LABEL = re.compile(r"^[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?$")


def is_dns_label(value: str) -> bool:
    """Return whether a value fits the MVP's bounded Kubernetes name contract."""

    return bool(DNS_LABEL.fullmatch(value))
