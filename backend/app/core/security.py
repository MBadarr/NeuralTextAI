"""Verify Neon-issued access tokens before handling workspace requests."""

from functools import lru_cache
from typing import Annotated

import jwt
from fastapi import Depends, HTTPException
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer

from app.core.config import settings
from app.core.logging import get_logger

bearer = HTTPBearer(auto_error=False)
logger = get_logger(__name__)


@lru_cache(maxsize=1)
def get_jwks_client() -> jwt.PyJWKClient:
    if not settings.neon_auth_jwks_url or not settings.neon_auth_issuer:
        raise HTTPException(503, "Authentication is not configured")
    return jwt.PyJWKClient(settings.neon_auth_jwks_url, timeout=10, lifespan=300)


def require_user(
    credentials: Annotated[HTTPAuthorizationCredentials | None, Depends(bearer)],
) -> str:
    if credentials is None:
        raise HTTPException(
            401,
            "Sign in to continue",
            headers={"WWW-Authenticate": "Bearer", "X-Auth-Error": "missing_token"},
        )
    try:
        key = get_jwks_client().get_signing_key_from_jwt(credentials.credentials)
        claims = jwt.decode(
            credentials.credentials,
            key.key,
            algorithms=["EdDSA", "RS256", "ES256"],
            issuer=settings.neon_auth_issuer,
            audience=settings.neon_auth_audience,
            leeway=30,
            options={"require": ["sub", "exp", "iat", "iss", "aud"]},
        )
    except jwt.PyJWKClientConnectionError as error:
        logger.warning("Neon signing keys unavailable (%s)", type(error).__name__)
        raise HTTPException(503, "Authentication service unavailable") from error
    except jwt.PyJWTError as error:
        # Log the failure category, never the token, cookies, or user claims.
        logger.warning("Neon access token rejected (%s)", type(error).__name__)
        raise HTTPException(
            401,
            "Invalid or expired session",
            headers={
                "WWW-Authenticate": "Bearer",
                "X-Auth-Error": type(error).__name__,
            },
        ) from error
    if (
        not isinstance(claims.get("sub"), str)
        or not claims["sub"]
        or claims.get("role") == "anonymous"
    ):
        raise HTTPException(
            401, "Sign in to continue", headers={"X-Auth-Error": "invalid_identity"}
        )
    if claims.get("emailVerified") is False or claims.get("email_verified") is False:
        raise HTTPException(
            403,
            "Verify your email to continue",
            headers={"X-Auth-Error": "email_unverified"},
        )
    return claims["sub"]


def require_internal_access() -> None:
    """Placeholder dependency for protected internal routes."""
