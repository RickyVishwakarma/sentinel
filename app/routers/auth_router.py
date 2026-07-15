"""Login endpoint — exchanges email + password for the caller's API key.

The API key remains the machine-to-machine credential; humans log in with
email/password and the dashboard then uses the returned key for API calls.
"""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import current_user, verify_password
from app.db import get_db
from app.models import AuditLog, User
from app.schemas import LoginRequest

router = APIRouter(prefix="/v1/auth", tags=["auth"])


@router.post("/login")
def login(body: LoginRequest, db: Session = Depends(get_db)) -> dict:
    user = db.query(User).filter(User.email == body.email.strip().lower()).first()
    if user is None or not verify_password(body.password, user.password_hash):
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "invalid email or password")

    db.add(
        AuditLog(
            tenant_id=user.tenant_id, actor=user.id,
            action="auth.login", target=user.id, meta={"email": user.email},
        )
    )
    db.commit()
    return {
        "api_key": user.api_key,
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "tenant": user.tenant.name,
    }


@router.get("/me")
def me(user: User = Depends(current_user)) -> dict:
    """Validate the stored key on app load; powers the session restore."""
    return {
        "email": user.email,
        "role": user.role,
        "tenant_id": user.tenant_id,
        "tenant": user.tenant.name,
    }
