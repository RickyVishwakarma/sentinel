"""Audit log query endpoint (Module M6 — Governance)."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.models import AuditLog, User

router = APIRouter(prefix="/v1", tags=["governance"])


@router.get("/audit")
def get_audit(
    limit: int = 100,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    rows = (
        db.query(AuditLog)
        .filter(AuditLog.tenant_id == user.tenant_id)
        .order_by(AuditLog.ts.desc())
        .limit(min(limit, 500))
        .all()
    )
    return {
        "tenant_id": user.tenant_id,
        "entries": [
            {
                "id": r.id,
                "actor": r.actor,
                "action": r.action,
                "target": r.target,
                "metadata": r.meta,
                "ts": r.ts.isoformat() if r.ts else None,
            }
            for r in rows
        ],
    }
