"""API-key authentication + lightweight RBAC.

Clients authenticate with ``Authorization: Bearer <api_key>``. The key maps to a
User, which carries the tenant and role used for isolation and access checks.
"""

from __future__ import annotations

import hashlib
import hmac
import os

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User

_ITER = 120_000


def hash_password(password: str) -> str:
    """Salted PBKDF2 (stdlib) — avoids pulling in bcrypt for the MVP."""
    salt = os.urandom(16)
    dk = hashlib.pbkdf2_hmac("sha256", password.encode(), salt, _ITER)
    return f"pbkdf2_sha256${_ITER}${salt.hex()}${dk.hex()}"


def verify_password(password: str, stored: str | None) -> bool:
    if not stored:
        return False
    try:
        _algo, iters, salt_hex, hash_hex = stored.split("$")
        dk = hashlib.pbkdf2_hmac(
            "sha256", password.encode(), bytes.fromhex(salt_hex), int(iters)
        )
        return hmac.compare_digest(dk.hex(), hash_hex)
    except (ValueError, TypeError):
        return False


def current_user(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> User:
    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing API key")
    user = db.query(User).filter(User.api_key == token).first()
    if user is None:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid API key")
    return user


def require_role(*roles: str):
    """Dependency factory: require the caller's role to be one of ``roles``."""

    def _checker(user: User = Depends(current_user)) -> User:
        if user.role not in roles:
            raise HTTPException(
                status.HTTP_403_FORBIDDEN,
                f"role '{user.role}' not permitted; requires one of {list(roles)}",
            )
        return user

    return _checker
