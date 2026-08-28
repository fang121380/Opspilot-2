from __future__ import annotations

from dataclasses import dataclass
from hmac import compare_digest


class OperatorAuthenticationError(PermissionError):
    """Raised when a privileged request lacks valid operator credentials."""


@dataclass(frozen=True)
class OperatorPrincipal:
    subject: str


class BearerTokenAuthenticator:
    """Map one deployment-managed bearer secret to a trusted operator identity."""

    def __init__(self, *, token: str, subject: str) -> None:
        if not token:
            raise ValueError("operator token must not be empty")
        if not subject.strip():
            raise ValueError("operator subject must not be empty")
        self._token = token
        self._principal = OperatorPrincipal(subject=subject.strip())

    def authenticate(self, authorization: str | None) -> OperatorPrincipal:
        if authorization is None:
            raise OperatorAuthenticationError("operator bearer token is required")
        scheme, separator, credentials = authorization.partition(" ")
        if (
            not separator
            or scheme.lower() != "bearer"
            or not credentials
            or not compare_digest(credentials, self._token)
        ):
            raise OperatorAuthenticationError("operator bearer token is invalid")
        return self._principal
