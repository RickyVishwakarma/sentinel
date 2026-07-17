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
    # PRD Q2 — what happens when the cap is hit mid-month (tenant admin's call):
    #   block   → 402 on every further run (default)
    #   warn    → runs proceed, each response carries a cost_cap warning + audit
    #   degrade → runs proceed on the cheapest provider (template) only
    cost_cap_mode: Mapped[str] = mapped_column(String, default="block")

    users: Mapped[list[User]] = relationship(back_populates="tenant")
    agents: Mapped[list[Agent]] = relationship(back_populates="tenant")


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    role: Mapped[str] = mapped_column(String, default="dev")  # admin | dev | viewer
    api_key: Mapped[str] = mapped_column(String, unique=True, index=True, default=_uuid)
    email: Mapped[str | None] = mapped_column(String, unique=True, index=True, nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String, nullable=True)
    # Set when the human signs in through Clerk; API-key-only users stay null.
    clerk_user_id: Mapped[str | None] = mapped_column(
        String, unique=True, index=True, nullable=True
    )

    tenant: Mapped[Tenant] = relationship(back_populates="users")


class Agent(Base):
    __tablename__ = "agents"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    name: Mapped[str] = mapped_column(String, nullable=False)
    current_version: Mapped[int] = mapped_column(Integer, default=0)
    # Kill switch (action governance): when frozen, every action check denies.
    frozen: Mapped[bool] = mapped_column(default=False)

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
    """Human-in-the-loop queue item.

    Two kinds:
      * ``output`` (Module M6) — a run's flagged output is withheld until an
        admin approves or denies it.
      * ``action`` (action governance) — an agent asked to perform a tool call
        that policy routed to human approval; the action is held until decided.
    """

    __tablename__ = "approvals"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    kind: Mapped[str] = mapped_column(String, default="output", index=True)  # output | action
    run_id: Mapped[str | None] = mapped_column(ForeignKey("runs.id"), index=True, nullable=True)
    trace_id: Mapped[str] = mapped_column(String, index=True, default="")
    reason: Mapped[list] = mapped_column(JSON, default=list)  # flag violations / policy match
    held_output: Mapped[str] = mapped_column(String, default="")
    # Action approvals carry the pending tool call:
    tool: Mapped[str | None] = mapped_column(String, nullable=True)
    arguments: Mapped[dict | None] = mapped_column(JSON, nullable=True)
    action_request_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
    status: Mapped[str] = mapped_column(String, default="pending", index=True)  # pending | approved | denied
    decided_by: Mapped[str | None] = mapped_column(String, nullable=True)
    note: Mapped[str] = mapped_column(String, default="")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)
    decided_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class Policy(Base):
    """A declarative action-governance rule (the policy decision point).

    A rule matches a tool (glob) and an optional condition on the call's
    arguments, and yields an effect: allow, deny, or require_approval. Rules are
    evaluated by ascending ``priority``; the first match wins. A rule with
    ``agent_id`` null applies to every agent in the tenant.
    """

    __tablename__ = "policies"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    agent_id: Mapped[str | None] = mapped_column(ForeignKey("agents.id"), index=True, nullable=True)
    tool: Mapped[str] = mapped_column(String, nullable=False)          # glob, e.g. "refund", "delete_*", "*"
    condition: Mapped[dict | None] = mapped_column(JSON, nullable=True)  # {field, op, value}
    effect: Mapped[str] = mapped_column(String, nullable=False)        # allow | deny | require_approval
    priority: Mapped[int] = mapped_column(Integer, default=100)        # lower = evaluated first
    description: Mapped[str] = mapped_column(String, default="")
    enabled: Mapped[bool] = mapped_column(default=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), default=_now, index=True)


class ActionRequest(Base):
    """Every action an agent asked to perform, with the decision — the audit
    surface for agentic side effects (the core of action governance)."""

    __tablename__ = "action_requests"

    id: Mapped[str] = mapped_column(String, primary_key=True, default=_uuid)
    tenant_id: Mapped[str] = mapped_column(ForeignKey("tenants.id"), index=True)
    agent_id: Mapped[str] = mapped_column(ForeignKey("agents.id"), index=True)
    tool: Mapped[str] = mapped_column(String, nullable=False)
    arguments: Mapped[dict] = mapped_column(JSON, default=dict)
    decision: Mapped[str] = mapped_column(String, default="pending", index=True)  # allow|deny|pending|approved|denied
    matched_policy_id: Mapped[str | None] = mapped_column(String, nullable=True)
    reason: Mapped[str] = mapped_column(String, default="")
    approval_id: Mapped[str | None] = mapped_column(String, index=True, nullable=True)
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
