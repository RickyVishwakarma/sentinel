"""Admin operations (PRD Q3): trace retention enforcement."""

from __future__ import annotations

from fastapi import APIRouter, Depends
from sqlalchemy.orm import Session

from app.auth import require_role
from app.config import get_settings
from app.db import get_db
from app.models import AuditLog, User
from app.spans import get_span_store

router = APIRouter(prefix="/v1/admin", tags=["admin"])


@router.post("/traces/purge")
def purge_traces(
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
) -> dict:
    """Delete spans older than TRACE_RETENTION_DAYS. Runs stay (billing)."""
    deleted = get_span_store().purge_expired()
    db.add(
        AuditLog(
            tenant_id=user.tenant_id, actor=user.id, action="traces.purge",
            target="spans", meta={
                "deleted": deleted,
                "retention_days": get_settings().trace_retention_days,
            },
        )
    )
    db.commit()
    return {"deleted": deleted, "retention_days": get_settings().trace_retention_days}
