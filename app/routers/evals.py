"""Eval runner endpoint (Module M5). Used by the CLI / GitHub Action."""

from __future__ import annotations

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.db import get_db
from app.evals import run_eval
from app.models import Agent, AgentVersion, EvalResult, User
from app.schemas import EvalRunRequest

router = APIRouter(prefix="/v1/evals", tags=["evals"])


@router.get("/history")
def eval_history(
    agent_id: str,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    """Metric history per agent version — powers the dashboard Evals page."""
    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id, Agent.tenant_id == user.tenant_id)
        .first()
    )
    if agent is None:
        raise HTTPException(404, "agent not found")

    rows = (
        db.query(EvalResult, AgentVersion.version)
        .join(AgentVersion, EvalResult.agent_version_id == AgentVersion.id)
        .filter(AgentVersion.agent_id == agent.id)
        .order_by(EvalResult.created_at.desc())
        .limit(500)
        .all()
    )
    return {
        "agent_id": agent.id,
        "agent": agent.name,
        "entries": [
            {
                "id": r.id,
                "version": v,
                "eval_set": r.eval_set,
                "metric": r.metric,
                "score": r.score,
                "baseline": r.baseline,
                "passed": r.passed,
                "created_at": r.created_at.isoformat() if r.created_at else None,
            }
            for r, v in rows
        ],
    }


@router.post("/run")
def run_evals(
    body: EvalRunRequest,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "dev")),
) -> dict:
    agent = (
        db.query(Agent)
        .filter(Agent.id == body.agent_id, Agent.tenant_id == user.tenant_id)
        .first()
    )
    if agent is None:
        raise HTTPException(404, "agent not found")

    return run_eval(
        db,
        user=user,
        agent=agent,
        version=agent.versions[-1],
        cases=[c.model_dump() for c in body.cases],
        eval_set=body.eval_set,
        baseline=body.baseline,
    )
