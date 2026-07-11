"""Cost aggregation endpoint (Module M7)."""

from __future__ import annotations

from datetime import datetime, timezone

from fastapi import APIRouter, Depends
from sqlalchemy import func
from sqlalchemy.orm import Session

from app.auth import current_user
from app.db import get_db
from app.models import Agent, AgentVersion, Run, User

router = APIRouter(prefix="/v1", tags=["cost"])


def _parse(ts: str | None, default: datetime) -> datetime:
    if not ts:
        return default
    return datetime.fromisoformat(ts).replace(tzinfo=timezone.utc)


@router.get("/cost")
def get_cost(
    from_: str | None = None,
    to: str | None = None,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> dict:
    """Cost broken down per agent for the caller's tenant over a window.

    Query params ``from`` / ``to`` are ISO dates; default is the current month.
    Tenant scoping is enforced from the API key, never the query string.
    """
    now = datetime.now(timezone.utc)
    start = _parse(from_, now.replace(day=1, hour=0, minute=0, second=0, microsecond=0))
    end = _parse(to, now)

    rows = (
        db.query(
            Agent.id,
            Agent.name,
            func.coalesce(func.sum(Run.cost), 0.0),
            func.coalesce(func.sum(Run.total_tokens), 0),
            func.count(Run.id),
        )
        .join(AgentVersion, AgentVersion.agent_id == Agent.id)
        .join(Run, Run.agent_version_id == AgentVersion.id)
        .filter(
            Agent.tenant_id == user.tenant_id,
            Run.created_at >= start,
            Run.created_at <= end,
        )
        .group_by(Agent.id, Agent.name)
        .all()
    )

    by_agent = [
        {"agent_id": aid, "agent": name, "cost": round(cost, 6), "tokens": tokens, "runs": runs}
        for aid, name, cost, tokens, runs in rows
    ]
    return {
        "tenant_id": user.tenant_id,
        "from": start.isoformat(),
        "to": end.isoformat(),
        "total_cost": round(sum(a["cost"] for a in by_agent), 6),
        "monthly_cost_cap": user.tenant.monthly_cost_cap,
        "by_agent": by_agent,
    }
