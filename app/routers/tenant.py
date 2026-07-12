"""Tenant settings (PRD Q2): the cost-cap policy belongs to the tenant admin."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.db import get_db
from app.models import AuditLog, Tenant, User
from app.schemas import TenantSettings

router = APIRouter(prefix="/v1/tenant", tags=["tenant"])

_MODES = {"block", "warn", "degrade"}


def _out(t: Tenant) -> dict:
    return {
        "id": t.id,
        "name": t.name,
        "plan": t.plan,
        "monthly_cost_cap": t.monthly_cost_cap,
        "cost_cap_mode": t.cost_cap_mode or "block",
    }


@router.get("")
def get_tenant(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict:
    return _out(db.get(Tenant, user.tenant_id))


@router.patch("")
def update_tenant(
    body: TenantSettings,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
) -> dict:
    tenant = db.get(Tenant, user.tenant_id)
    changes: dict = {}
    if body.cost_cap_mode is not None:
        if body.cost_cap_mode not in _MODES:
            raise HTTPException(422, f"cost_cap_mode must be one of {sorted(_MODES)}")
        tenant.cost_cap_mode = body.cost_cap_mode
        changes["cost_cap_mode"] = body.cost_cap_mode
    if body.monthly_cost_cap is not None:
        if body.monthly_cost_cap < 0:
            raise HTTPException(422, "monthly_cost_cap must be >= 0")
        tenant.monthly_cost_cap = body.monthly_cost_cap
        changes["monthly_cost_cap"] = body.monthly_cost_cap

    if changes:
        db.add(
            AuditLog(
                tenant_id=tenant.id, actor=user.id,
                action="tenant.settings_update", target=tenant.id, meta=changes,
            )
        )
        db.commit()
    return _out(tenant)
