"""Action governance — the policy decision point (PDP) for agentic tool calls.

Before an agent executes a high-risk tool call (spend money, email a customer,
touch prod), it asks Sentinel here. The call is evaluated against the tenant's
policies and returns one of:

    allow    → the agent may proceed
    deny     → the agent must not proceed
    pending  → held for a human; poll GET /v1/actions/{id} until decided

Every decision is recorded as an ActionRequest and written to the audit log, so
there is always a paper trail for what an agent did — or was stopped from doing.
A frozen agent (kill switch) denies every action outright.
"""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.db import get_db
from app.models import ActionRequest, Agent, Approval, AuditLog, Policy, User
from app.policy import evaluate
from app.schemas import PolicyCreate

router = APIRouter(prefix="/v1", tags=["actions"])


def _get_agent(db: Session, agent_id: str, user: User) -> Agent:
    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id, Agent.tenant_id == user.tenant_id)
        .first()
    )
    if agent is None:
        raise HTTPException(404, "agent not found")
    return agent


def _audit(db: Session, tenant_id: str, actor: str, action: str, target: str, meta: dict) -> None:
    db.add(AuditLog(tenant_id=tenant_id, actor=actor, action=action, target=target, meta=meta))


# ── The decision point ──────────────────────────────────────────────────────

@router.post("/agents/{agent_id}/actions/check")
def check_action(
    agent_id: str,
    body: dict,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    tool = (body or {}).get("tool")
    arguments = (body or {}).get("arguments") or {}
    if not tool:
        raise HTTPException(422, "tool is required")

    agent = _get_agent(db, agent_id, user)

    req = ActionRequest(
        tenant_id=user.tenant_id, agent_id=agent.id, tool=tool, arguments=arguments
    )

    # Kill switch takes precedence over any policy.
    if agent.frozen:
        req.decision = "deny"
        req.reason = "agent is frozen (kill switch)"
        req.decided_at = datetime.now(timezone.utc)
        db.add(req)
        _audit(db, user.tenant_id, "system", "action.deny", agent.id,
               {"tool": tool, "reason": req.reason, "action_id": req.id})
        db.commit()
        return {"action_id": req.id, "decision": "deny", "reason": req.reason}

    policies = db.query(Policy).filter(
        Policy.tenant_id == user.tenant_id,
        (Policy.agent_id == agent.id) | (Policy.agent_id.is_(None)),
    ).all()
    decision = evaluate(tool, arguments, policies)
    req.matched_policy_id = decision.matched_policy_id
    req.reason = decision.reason

    if decision.effect == "allow":
        req.decision = "allow"
        req.decided_at = datetime.now(timezone.utc)
        db.add(req)
        _audit(db, user.tenant_id, user.id, "action.allow", agent.id,
               {"tool": tool, "policy": decision.matched_policy_id, "action_id": req.id})
        db.commit()
        return {"action_id": req.id, "decision": "allow", "reason": req.reason,
                "matched_policy_id": decision.matched_policy_id}

    if decision.effect == "deny":
        req.decision = "deny"
        req.decided_at = datetime.now(timezone.utc)
        db.add(req)
        _audit(db, user.tenant_id, "system", "action.deny", agent.id,
               {"tool": tool, "policy": decision.matched_policy_id, "action_id": req.id})
        db.commit()
        return {"action_id": req.id, "decision": "deny", "reason": req.reason,
                "matched_policy_id": decision.matched_policy_id}

    # require_approval → hold the action for a human.
    req.decision = "pending"
    db.add(req)
    db.flush()  # assign req.id
    approval = Approval(
        tenant_id=user.tenant_id, kind="action", tool=tool, arguments=arguments,
        action_request_id=req.id, reason=[{"policy": decision.matched_policy_id,
                                           "detail": decision.reason}],
    )
    db.add(approval)
    db.flush()
    req.approval_id = approval.id
    _audit(db, user.tenant_id, "system", "action.hold", agent.id,
           {"tool": tool, "policy": decision.matched_policy_id,
            "action_id": req.id, "approval_id": approval.id})
    db.commit()
    return {"action_id": req.id, "decision": "pending", "reason": req.reason,
            "approval_id": approval.id, "matched_policy_id": decision.matched_policy_id}


@router.get("/actions/{action_id}")
def get_action(
    action_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    """Poll an action's decision (allow | deny | pending | approved | denied)."""
    req = (
        db.query(ActionRequest)
        .filter(ActionRequest.id == action_id, ActionRequest.tenant_id == user.tenant_id)
        .first()
    )
    if req is None:
        raise HTTPException(404, "action not found")
    return {
        "action_id": req.id, "agent_id": req.agent_id, "tool": req.tool,
        "arguments": req.arguments, "decision": req.decision, "reason": req.reason,
        "matched_policy_id": req.matched_policy_id, "approval_id": req.approval_id,
        "created_at": req.created_at.isoformat() if req.created_at else None,
        "decided_at": req.decided_at.isoformat() if req.decided_at else None,
    }


@router.get("/actions")
def list_actions(
    agent_id: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    q = db.query(ActionRequest).filter(ActionRequest.tenant_id == user.tenant_id)
    if agent_id:
        q = q.filter(ActionRequest.agent_id == agent_id)
    rows = q.order_by(ActionRequest.created_at.desc()).limit(200).all()
    return {"entries": [
        {"action_id": r.id, "agent_id": r.agent_id, "tool": r.tool,
         "arguments": r.arguments, "decision": r.decision, "reason": r.reason,
         "created_at": r.created_at.isoformat() if r.created_at else None}
        for r in rows
    ]}


# ── Policy management ───────────────────────────────────────────────────────

def _policy_dict(p: Policy) -> dict:
    return {
        "id": p.id, "agent_id": p.agent_id, "tool": p.tool, "effect": p.effect,
        "condition": p.condition, "priority": p.priority,
        "description": p.description, "enabled": p.enabled,
        "created_at": p.created_at.isoformat() if p.created_at else None,
    }


@router.get("/policies")
def list_policies(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> dict:
    rows = (
        db.query(Policy)
        .filter(Policy.tenant_id == user.tenant_id)
        .order_by(Policy.priority)
        .all()
    )
    return {"entries": [_policy_dict(p) for p in rows]}


@router.post("/policies", status_code=201)
def create_policy(
    body: PolicyCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
) -> dict:
    if body.effect not in ("allow", "deny", "require_approval"):
        raise HTTPException(422, "effect must be allow | deny | require_approval")
    if body.agent_id:
        _get_agent(db, body.agent_id, user)  # tenant-scope check
    policy = Policy(
        tenant_id=user.tenant_id, agent_id=body.agent_id, tool=body.tool,
        effect=body.effect, priority=body.priority, description=body.description,
        enabled=body.enabled,
        condition=body.condition.model_dump() if body.condition else None,
    )
    db.add(policy)
    _audit(db, user.tenant_id, user.id, "policy.create", policy.tool or "",
           {"effect": body.effect, "agent_id": body.agent_id})
    db.commit()
    return _policy_dict(policy)


@router.delete("/policies/{policy_id}")
def delete_policy(
    policy_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
) -> dict:
    policy = (
        db.query(Policy)
        .filter(Policy.id == policy_id, Policy.tenant_id == user.tenant_id)
        .first()
    )
    if policy is None:
        raise HTTPException(404, "policy not found")
    db.delete(policy)
    _audit(db, user.tenant_id, user.id, "policy.delete", policy.tool or "", {"policy_id": policy_id})
    db.commit()
    return {"deleted": policy_id}


# ── Kill switch ─────────────────────────────────────────────────────────────

@router.post("/agents/{agent_id}/freeze")
def freeze_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
) -> dict:
    agent = _get_agent(db, agent_id, user)
    agent.frozen = True
    _audit(db, user.tenant_id, user.id, "agent.freeze", agent.id, {})
    db.commit()
    return {"agent_id": agent.id, "frozen": True}


@router.post("/agents/{agent_id}/unfreeze")
def unfreeze_agent(
    agent_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin")),
) -> dict:
    agent = _get_agent(db, agent_id, user)
    agent.frozen = False
    _audit(db, user.tenant_id, user.id, "agent.unfreeze", agent.id, {})
    db.commit()
    return {"agent_id": agent.id, "frozen": False}
