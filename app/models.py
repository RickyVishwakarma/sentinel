"""Relational data models (Section 07 of the PRD).

Every relational entity carries a row-level ``tenant_id`` for isolation. Agent
configs are versioned immutably: each save creates a new ``AgentVersion`` and a
run pins the exact version it executed against.
"""

from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import JSON, DateTime, Float, ForeignKey, Integer, String
from sqlalchemy.orm import Mapped, mapped_column, relationship

from app.db import Base


def _uuid() -> str:
    return uuid.uuid4().hex


def _now() -> datetime:
    return datetime.now(timezone.utc)


class Tenant(Base):
    __tablename__ = "tenants"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    name: Mapped[str] = mapped_column(String, nullable=False)
    plan: Mapped[str] = mapped_column(String, default="free")
    monthly_cost_cap: Mapped[float] = mapped_column(Float, default=50.0)  # USD

    users: Mapped[list[User]] = relationship(back_populates="tenant")
    agents: Mapped[list[Agent]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    role: Mapped[str] = mapped_column(String, default="dev")  # admin | dev | viewer
    api_key: Mapped[str] = mapped_column(String, unique=True, index=True, default=_uuid)

    tenant: Mapped[Tenant] = relationship(back_populates="users")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, default=0)

    tenant: Mapped[Tenant] = relationship(back_populates="agents")
    versions: Mapped[list[AgentVersion]] = relationship(
        back_populates="agent", order_by="AgentVersion.version"
    )


class AgentVersion(Base):
    """Immutable snapshot of an agent config. Never updated after creation."""

    __tablename__ = "agent_versions"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    version: Mapped[int] = mapped_column(Integer, nullable=False)
    model: Mapped[str] = mapped_column(String, nullable=False)
    system_prompt: Mapped[str] = mapped_column(String, default="")
    tools: Mapped[list] = mapped_column(JSON, default=list)          # allow-list of tool names
    guardrails: Mapped[list] = mapped_column(JSON, default=list)     # enabled guardrail ids
    fallback_chain: Mapped[list] = mapped_column(JSON, default=list) # ordered provider ids
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)

    agent: Mapped[Agent] = relationship(back_populates="versions")


class Run(Base):
    __tablename__ = "runs"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    agent_version_id: Mapped[str] = mapped_column(ForeignKey("agent_versions.id"), index=True)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    status: Mapped[str] = mapped_column(String, default="ok")  # ok | blocked | error
    provider: Mapped[str | None] = mapped_column(String, nullable=True)  # provider that served
    total_tokens: Mapped[int] = mapped_column(Integer, default=0)
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    trace_id: Mapped[str] = mapped_column(String, index=True, default=_uuid)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class AuditLog(Base):
    __tablename__ = "audit_log"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    actor: Mapped[str] = mapped_column(String, nullable=False)   # user id / "system"
    action: Mapped[str] = mapped_column(String, nullable=False)  # e.g. guardrail.block
    target: Mapped[str] = mapped_column(String, default="")      # run id / agent id
    meta: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class Approval(Base):
    """Human-in-the-loop queue item (Module M6).

    Created when a run trips a flag-level guardrail on an agent that has the
    ``hitl_approval`` guardrail enabled. The run's output is withheld here until
    an admin approves (releases it) or denies it.
    """

    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    run_id: Mapped[str] = mapped_column(ForeignKey("runs.id"), index=True)
    trace_id: Mapped[str] = mapped_column(String, index=True)
    reason: Mapped[list] = mapped_column(JSON, default=list)  # flag violations
    held_output: Mapped[str] = mapped_column(String, default="")
    status: Mapped[str] = mapped_column(String, default="pending", index=True)  # pending | approved | denied
    decided_by: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class EvalResult(Base):
    __tablename__ = "eval_results"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    agent_version_id: Mapped[str] = mapped_column(ForeignKey("agent_versions.id"), index=True)
    eval_set: Mapped[str] = mapped_column(String, nullable=False)
    metric: Mapped[str] = mapped_column(String, nullable=False)  # faithfulness | answer_relevance | guardrail_pass_rate
    score: Mapped[float] = mapped_column(Float, default=0.0)
    baseline: Mapped[float] = mapped_column(Float, default=0.0)
    passed: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class Span(Base):
    """A single pipeline step within a run's trace.

    In production these high-volume spans live in Mongo (SPAN_STORE=mongo); the
    default SQL span store keeps them here so traces are queryable with no extra
    infra. See app/spans.py.
    """

    __tablename__ = "spans"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    trace_id: Mapped[str] = mapped_column(String, index=True, nullable=False)
    parent_id: Mapped[str | None] = mapped_column(String, nullable=True)
    seq: Mapped[int] = mapped_column(Integer, default=0)  # ordering within a trace
    type: Mapped[str] = mapped_column(String, nullable=False)  # prompt|guardrail|llm|tool|cost
    name: Mapped[str] = mapped_column(String, default="")
    input: Mapped[str] = mapped_column(String, default="")
    output: Mapped[str] = mapped_column(String, default="")
    tokens: Mapped[int] = mapped_column(Integer, default=0)
    latency_ms: Mapped[int] = mapped_column(Integer, default=0)
    cost: Mapped[float] = mapped_column(Float, default=0.0)
    meta: Mapped[dict] = mapped_column("metadata", JSON, default=dict)
    ts: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now)
