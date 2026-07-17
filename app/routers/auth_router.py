"""Login endpoint — exchanges email + password for the caller's API key.

The API key remains the machine-to-machine credential; humans log in with
email/password and the dashboard then uses the returned key for API calls.
"""

from __future__ import annotations

import uuid

from fastapi import APIRouter, Depends, Header, HTTPException, status
from sqlalchemy.orm import Session

from app.auth import current_user, verify_password
from app.clerk import ClerkError, clerk_enabled, fetch_profile, verify_session_token
from app.db import get_db
from app.models import AuditLog, Tenant, User
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


@router.post("/clerk")
def clerk_exchange(
    authorization: str = Header(default=""),
    db: Session = Depends(get_db),
) -> dict:
    """Exchange a verified Clerk session for this tenant's API key.

    Clerk owns *who the human is*; Sentinel still owns *what they may do*, so
    the Clerk identity is mapped onto a Tenant/User row and the caller gets
    back the API key the rest of the gateway already understands. Machines are
    unaffected — they keep presenting API keys directly.
    """
    if not clerk_enabled():
        raise HTTPException(status.HTTP_501_NOT_IMPLEMENTED, "Clerk is not configured")

    token = authorization.removeprefix("Bearer ").strip()
    if not token:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, "missing Clerk session token")
    try:
        claims = verify_session_token(token)
    except ClerkError as exc:
        raise HTTPException(status.HTTP_401_UNAUTHORIZED, str(exc)) from exc

    clerk_user_id = claims["sub"]
    # Session tokens carry only `sub` unless a JWT template adds more, so ask
    # Clerk for the real identity. Synthetic values are a last resort.
    profile = fetch_profile(clerk_user_id)
    email = (
        profile.email
        or claims.get("email")
        or f"{clerk_user_id}@clerk.local"
    ).lower()
    display_name = profile.full_name or email.split("@")[0]

    user = db.query(User).filter(User.clerk_user_id == clerk_user_id).first()
    if user is None:
        # Link an existing invited/seeded account by email before creating one,
        # so signing in with Clerk doesn't silently fork a second tenant.
        user = db.query(User).filter(User.email == email).first()

    if user is None:
        tenant = Tenant(id=uuid.uuid4().hex, name=f"{display_name}'s workspace", plan="free")
        db.add(tenant)
        db.flush()
        user = User(
            id=uuid.uuid4().hex,
            tenant_id=tenant.id,
            role="admin",  # first user of a brand-new tenant owns it
            api_key=f"sk_sentinel_{uuid.uuid4().hex}",
            email=email,
        )
        db.add(user)
        action = "auth.clerk_provision"
    else:
        action = "auth.clerk_login"
        # Heal rows provisioned before the profile lookup existed (or if the
        # person changed their email/name in Clerk since last sign-in).
        if profile.email and user.email != profile.email:
            user.email = profile.email
        tenant = db.get(Tenant, user.tenant_id)
        if tenant and (
            tenant.name.startswith("user_") or tenant.name.endswith("@clerk.local")
        ):
            tenant.name = f"{display_name}'s workspace"

    user.clerk_user_id = clerk_user_id
    db.add(
        AuditLog(
            tenant_id=user.tenant_id, actor=user.id, action=action,
            target=user.id, meta={"email": email, "clerk_user_id": clerk_user_id},
        )
    )
    db.commit()

    return {
        "api_key": user.api_key,
        "email": user.email,
        "name": display_name,
        "avatar_url": profile.avatar_url,
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
