"""Human-in-the-loop approval queue (Module M6).

Runs whose output was flagged risky sit here as ``pending``. An admin approves
(releases the held output — the run becomes ``ok``) or denies (the run becomes
``denied``). Every decision is written to the audit log.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.db import get_db
from app.models import ActionRequest, Approval, AuditLog, Run, User
from app.schemas import ApprovalDecision

router = APIRouter(prefix="/v1/approvals", tags=["approvals"])


def _approval_dict(a: Approval, include_output: bool) -> dict:
    return {
        "id": a.id,
        "kind": a.kind,
        "run_id": a.run_id,
        "trace_id": a.trace_id,
        "reason": a.reason,
        "status": a.status,
        "held_output": a.held_output if include_output else None,
        "tool": a.tool,
        "arguments": a.arguments,
        "action_request_id": a.action_request_id,
        "decided_by": a.decided_by,
        "note": a.note,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "decided_at": a.decided_at.isoformat() if a.decided_at else None,
    }


@router.get("")
def list_approvals(
    status: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    q = db.query(Approval).filter(Approval.tenant_id == user.tenant_id)
    if status:
        q = q.filter(Approval.status == status)
    entries = q.order_by(Approval.created_at.desc()).limit(200).all()
    # Held output is only visible to roles that can act on it.
    include_output = user.role in ("admin", "dev")
    return {"entries": [_approval_dict(a, include_output) for a in entries]}


@router.get("/{approval_id}")
def get_approval(
    approval_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    a = (
        db.query(Approval)
        .filter(Approval.id == approval_id, Approval.tenant_id == user.tenant_id)
        .first()
    )
    if a is None:
        raise HTTPException(404, "approval not found")
    # Pending output stays hidden from viewers; released output is visible.
    include_output = user.role in ("admin", "dev") or a.status == "approved"
    return _approval_dict(a, include_output)


@router.post("/{approval_id}/decide")
def decide(
    approval_id: str,
    body: ApprovalDecision,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
) -> dict:
    if body.decision not in ("approve", "deny"):
        raise HTTPException(422, "decision must be 'approve' or 'deny'")

    a = (
        db.query(Approval)
        .filter(Approval.id == approval_id, Approval.tenant_id == user.tenant_id)
        .first()
    )
    if a is None:
        raise HTTPException(404, "approval not found")
    if a.status != "pending":
        raise HTTPException(409, f"approval already {a.status}")

    a.status = "approved" if body.decision == "approve" else "denied"
    a.decided_by = user.id
    a.note = body.note
    a.decided_at = datetime.now(timezone.utc)

    if a.kind == "action":
        # Release/deny the held tool call; the polling agent reads this next.
        req = (
            db.query(ActionRequest)
            .filter(ActionRequest.id == a.action_request_id)
            .first()
        )
        if req is not None:
            req.decision = "approved" if body.decision == "approve" else "denied"
            req.decided_at = a.decided_at
        audit_action = f"action.{body.decision}"
        target = a.action_request_id or a.id
        meta = {"approval_id": a.id, "tool": a.tool, "note": body.note}
    else:
        run = db.query(Run).filter(Run.id == a.run_id).first()
        if run is not None:
            run.status = "ok" if body.decision == "approve" else "denied"
        audit_action = f"hitl.{body.decision}"
        target = a.run_id or a.id
        meta = {"approval_id": a.id, "note": body.note}

    db.add(AuditLog(tenant_id=user.tenant_id, actor=user.id, action=audit_action,
                    target=target, meta=meta))
    db.commit()
    return _approval_dict(a, include_output=True)
