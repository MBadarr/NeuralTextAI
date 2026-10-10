"""Verify Neon-issued access tokens before handling workspace requests."""

from functools import lru_cache
from typing import Annotated
from urllib.parse import urlsplit

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
    jwks_url = settings.neon_auth_jwks_url
    try:
        parts = urlsplit(jwks_url)
        valid = (
            parts.scheme in {"https", "http"}
            and bool(parts.hostname)
            and not (parts.username or parts.password or parts.query or parts.fragment)
        )
    except ValueError:
        valid = False
    if not valid:
        logger.error("NEON_AUTH_JWKS_URL must be a plain HTTP(S) signing-key URL")
        raise HTTPException(
            503,
            "Authentication signing-key URL is not configured correctly",
            headers={"X-Auth-Error": "invalid_jwks_url"},
        )
    if settings.neon_auth_base_url and jwks_url.rstrip("/") != (
        f"{settings.neon_auth_base_url.rstrip('/')}/.well-known/jwks.json"
    ):
        logger.error(
            "Neon configuration mismatch: set NEON_AUTH_JWKS_URL to "
            "NEON_AUTH_BASE_URL + /.well-known/jwks.json, or remove the override"
        )
        raise HTTPException(
            503,
            "Authentication signing-key configuration mismatch",
            headers={"X-Auth-Error": "jwks_configuration_mismatch"},
        )
    return jwt.PyJWKClient(jwks_url, timeout=10, lifespan=300)


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
        raise HTTPException(
            503,
            "Authentication service unavailable",
            headers={"X-Auth-Error": "jwks_unavailable"},
        ) from error
    except jwt.PyJWKClientError as error:
        if str(error).startswith("Unable to find a signing key that matches"):
            # Do not log PyJWT's raw message: it includes the token's key ID.
            logger.warning(
                "Neon signing key not found: compare Vercel and backend "
                "NEON_AUTH_BASE_URL values and branches; sign in again after key rotation"
            )
            raise HTTPException(
                401,
                "Session signing key not found",
                headers={
                    "WWW-Authenticate": "Bearer",
                    "X-Auth-Error": "signing_key_not_found",
                },
            ) from error
        logger.error("Neon JWKS endpoint returned no usable signing keys")
        raise HTTPException(
            503,
            "Authentication signing keys unavailable",
            headers={"X-Auth-Error": "invalid_jwks_response"},
        ) from error
    except jwt.PyJWKSetError as error:
        logger.error("Neon JWKS endpoint returned an invalid signing-key set")
        raise HTTPException(
            503,
            "Authentication signing keys unavailable",
            headers={"X-Auth-Error": "invalid_jwks_response"},
        ) from error
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
