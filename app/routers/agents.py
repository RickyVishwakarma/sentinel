"""Agent registry + run endpoints (Modules M1 + M2)."""

from __future__ import annotations

import json

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse
from sqlalchemy.orm import Session

from app.auth import current_user, require_role
from app.db import get_db
from app.gateway import GatewayError, execute_run, stream_run
from app.models import Agent, AgentVersion, User
from app.schemas import (
    AgentCreate,
    AgentOut,
    AgentVersionCreate,
    RunRequest,
    RunResponse,
)

router = APIRouter(prefix="/v1/agents", tags=["agents"])


def _next_version(db: Session, agent: Agent, data: dict) -> AgentVersion:
    """Create the next immutable version for ``agent`` from ``data``."""
    version = AgentVersion(
        agent_id=agent.id,
        version=agent.current_version + 1,
        model=data["model"],
        system_prompt=data["system_prompt"],
        tools=data["tools"],
        guardrails=data["guardrails"],
        fallback_chain=data["fallback_chain"],
    )
    agent.current_version += 1
    db.add(version)
    return version


def _get_agent(db: Session, agent_id: str, user: User) -> Agent:
    agent = (
        db.query(Agent)
        .filter(Agent.id == agent_id, Agent.tenant_id == user.tenant_id)
        .first()
    )
    if agent is None:
        raise HTTPException(404, "agent not found")
    return agent


@router.post("", response_model=AgentOut, status_code=201)
def create_agent(
    body: AgentCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "dev")),
) -> AgentOut:
    agent = Agent(tenant_id=user.tenant_id, name=body.name, current_version=0)
    db.add(agent)
    db.flush()  # assign agent.id before creating the version
    _next_version(db, agent, body.model_dump())
    db.commit()
    return AgentOut(id=agent.id, name=agent.name, current_version=agent.current_version, frozen=agent.frozen)


@router.get("", response_model=list[AgentOut])
def list_agents(
    db: Session = Depends(get_db), user: User = Depends(current_user)
) -> list[AgentOut]:
    agents = db.query(Agent).filter(Agent.tenant_id == user.tenant_id).all()
    return [
        AgentOut(id=a.id, name=a.name, current_version=a.current_version, frozen=a.frozen)
        for a in agents
    ]


@router.post("/{agent_id}/versions", response_model=AgentOut, status_code=201)
def create_version(
    agent_id: str,
    body: AgentVersionCreate,
    db: Session = Depends(get_db),
    user: User = Depends(require_role("admin", "dev")),
) -> AgentOut:
    agent = _get_agent(db, agent_id, user)
    current = agent.versions[-1]
    merged = {
        "model": body.model or current.model,
        "system_prompt": current.system_prompt if body.system_prompt is None else body.system_prompt,
        "tools": current.tools if body.tools is None else body.tools,
        "guardrails": current.guardrails if body.guardrails is None else body.guardrails,
        "fallback_chain": current.fallback_chain if body.fallback_chain is None else body.fallback_chain,
    }
    _next_version(db, agent, merged)
    db.commit()
    return AgentOut(id=agent.id, name=agent.name, current_version=agent.current_version, frozen=agent.frozen)


@router.post("/{agent_id}/run", response_model=RunResponse)
def run_agent(
    agent_id: str,
    body: RunRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
) -> RunResponse:
    agent = _get_agent(db, agent_id, user)
    version = agent.versions[-1]
    try:
        result = execute_run(
            db,
            user=user,
            agent=agent,
            version=version,
            input_text=body.input,
            requested_tools=body.requested_tools,
        )
    except GatewayError as exc:
        raise HTTPException(exc.status_code, exc.detail)
    return RunResponse(**result)


@router.post("/{agent_id}/run/stream")
def run_agent_stream(
    agent_id: str,
    body: RunRequest,
    db: Session = Depends(get_db),
    user: User = Depends(current_user),
):
    """Streaming run (SSE): meta → provider → delta* → [blocked] → done.

    A pre-call guardrail block returns a plain JSON RunResponse instead of a
    stream — nothing was generated, so there is nothing to stream.
    """
    agent = _get_agent(db, agent_id, user)
    version = agent.versions[-1]
    try:
        kind, payload = stream_run(
            db,
            user=user,
            agent=agent,
            version=version,
            input_text=body.input,
            requested_tools=body.requested_tools,
        )
    except GatewayError as exc:
        raise HTTPException(exc.status_code, exc.detail)

    if kind == "blocked":
        return JSONResponse(payload)

    def sse():
        for ev in payload:
            yield f"event: {ev['event']}\ndata: {json.dumps(ev['data'])}\n\n"

    return StreamingResponse(sse(), media_type="text/event-stream")
