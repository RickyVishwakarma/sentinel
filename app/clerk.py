"""Clerk session verification.

Humans sign in to the dashboard with Clerk; machines keep using API keys.
This module verifies a Clerk session JWT so the gateway can map the signed-in
person onto an existing Tenant/User row — which is what actually carries the
role and the row-level isolation everything else depends on.

Verification is signature-based against Clerk's public JWKS. No secret key is
needed to *verify* a token, so the gateway never has to hold one just to read
who a caller is.
"""

from __future__ import annotations

import base64
import time
from functools import lru_cache

import jwt
from jwt import PyJWKClient

from app.config import get_settings


class ClerkError(Exception):
    """Raised when a Clerk session token cannot be trusted."""


def _frontend_api_host() -> str:
    """Derive the Clerk Frontend API host from the publishable key.

    A publishable key is ``pk_(test|live)_<base64url(host + "$")>`` — the host
    is encoded in the key itself, so there is nothing extra to configure.
    """
    pk = get_settings().clerk_publishable_key
    if not pk:
        raise ClerkError("CLERK_PUBLISHABLE_KEY is not configured")
    try:
        encoded = pk.split("_", 2)[2]
    except IndexError as exc:
        raise ClerkError("malformed publishable key") from exc
    padded = encoded + "=" * (-len(encoded) % 4)
    host = base64.urlsafe_b64decode(padded).decode().rstrip("$")
    if not host:
        raise ClerkError("could not derive Clerk Frontend API host")
    return host


def clerk_enabled() -> bool:
    return bool(get_settings().clerk_publishable_key)


@lru_cache(maxsize=1)
def _jwk_client() -> PyJWKClient:
    # PyJWKClient caches signing keys in-process and refetches on rotation.
    return PyJWKClient(f"https://{_frontend_api_host()}/.well-known/jwks.json")


@lru_cache(maxsize=1)
def _issuer() -> str:
    return f"https://{_frontend_api_host()}"


def verify_session_token(token: str) -> dict:
    """Verify a Clerk session JWT and return its claims.

    Checks the signature against Clerk's JWKS, that the issuer is *our* Clerk
    instance, and that the token is unexpired. Raises ClerkError otherwise.
    """
    if not clerk_enabled():
        raise ClerkError("Clerk is not configured on this gateway")
    try:
        signing_key = _jwk_client().get_signing_key_from_jwt(token)
        claims = jwt.decode(
            token,
            signing_key.key,
            algorithms=["RS256"],
            issuer=_issuer(),
            # Clerk session tokens carry no audience by default.
            options={"verify_aud": False, "require": ["exp", "iat", "sub"]},
            leeway=5,  # tolerate small clock skew
        )
    except jwt.PyJWTError as exc:
        raise ClerkError(f"invalid Clerk session token: {exc}") from exc

    # Clerk's short-lived tokens also carry `nbf`; PyJWT checks it, but guard
    # the explicit expiry too so a misconfigured clock can't wave one through.
    if claims.get("exp", 0) < time.time() - 5:
        raise ClerkError("Clerk session token has expired")
    return claims
