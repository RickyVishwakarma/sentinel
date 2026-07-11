"""Run + trace retrieval (Module M4 — Observability)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.models import Run, User
from app.spans import get_span_store

router = APIRouter(prefix="/v1", tags=["observability"])


def _run_dict(run: Run) -> dict:
    return {
        "id": run.id,
        "agent_version_id": run.agent_version_id,
        "status": run.status,
        "provider": run.provider,
        "total_tokens": run.total_tokens,
        "cost": run.cost,
        "latency_ms": run.latency_ms,
        "trace_id": run.trace_id,
        "created_at": run.created_at.isoformat() if run.created_at else None,
    }


@router.get("/runs/{run_id}")
def get_run(
    run_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict:
    run = (
        db.query(Run)
        .filter(Run.id == run_id, Run.tenant_id == user.tenant_id)
        .first()
    )
    if run is None:
        raise HTTPException(404, "run not found")
    return {"run": _run_dict(run), "trace": get_span_store().by_trace(run.trace_id)}


@router.get("/traces/{trace_id}")
def get_trace(
    trace_id: str, db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict:
    # Verify the trace belongs to the caller's tenant via its run.
    run = (
        db.query(Run)
        .filter(Run.trace_id == trace_id, Run.tenant_id == user.tenant_id)
        .first()
    )
    if run is None:
        raise HTTPException(404, "trace not found")
    return {"trace_id": trace_id, "spans": get_span_store().by_trace(trace_id)}
