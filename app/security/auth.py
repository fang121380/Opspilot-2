from __future__ import annotations

from dataclasses import dataclass
from hmac import compare_digest


class BearerAuthenticationError(PermissionError):
    """Raised when a request lacks the configured bearer credential."""


@dataclass(frozen=True)
class AuthenticatedPrincipal:
    subject: str


class BearerTokenAuthenticator:
    """Map one deployment-managed bearer secret to a trusted operator identity."""

    def __init__(self, *, token: str, subject: str) -> None:
        normalized_token = token.strip()
        if not normalized_token:
            raise ValueError("bearer token must not be empty")
        if not subject.strip():
            raise ValueError("bearer subject must not be empty")
        self._token = normalized_token
        self._principal = AuthenticatedPrincipal(subject=subject.strip())

    def authenticate(self, authorization: str | None) -> AuthenticatedPrincipal:
        if authorization is None:
            raise BearerAuthenticationError("bearer token is required")
        scheme, separator, credentials = authorization.partition(" ")
        if (
            not separator
            or scheme.lower() != "bearer"
            or not credentials
            or not compare_digest(credentials, self._token)
        ):
            raise BearerAuthenticationError("bearer token is invalid")
        return self._principal
