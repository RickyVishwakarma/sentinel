"""API-key authentication + lightweight RBAC.

Clients authenticate with ``Authorization: Bearer <api_key>``. The key maps to a
User, which carries the tenant and role used for isolation and access checks.
"""

from __future__ import annotations

from fastapi import Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.db import get_db
from app.models import User


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
