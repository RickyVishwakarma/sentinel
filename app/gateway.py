"""The gateway pipeline (Module M2 + System Architecture, Section 06).

A single entrypoint runs a fixed pipeline around the LLM call:

    rate-limit → cost-cap → load version → guardrails(pre)
      → LLM call + provider fallback → guardrails(post) → cost calc → emit trace

Trace spans are buffered and written once at the end so persistence never blocks
the response path. Every guardrail violation and terminal decision also lands in
the audit log.
"""

from __future__ import annotations

import time
import uuid
from datetime import datetime, timezone

from sqlalchemy import func
from sqlalchemy.orm import Session

from app.cost import cost_usd
from app.guardrails import run_post_guardrails, run_pre_guardrails
from app.models import Agent, AgentVersion, AuditLog, Run, User
from app.providers import run_with_fallback
from app.ratelimit import get_rate_limiter
from app.spans import SpanRecord, get_span_store
from app.config import get_settings

_BLOCKED_MESSAGE = "This request was blocked by a Sentinel guardrail."


class GatewayError(Exception):
    """Raised for terminal gateway conditions the router maps to HTTP status."""

    def __init__(self, status_code: int, detail: str) -> None:
        super().__init__(detail)
        self.status_code = status_code
        self.detail = detail


def _audit(db: Session, tenant_id: str, actor: str, action: str, target: str, meta: dict) -> None:
    db.add(
        AuditLog(tenant_id=tenant_id, actor=actor, action=action, target=target, meta=meta)
    )


def _month_to_date_cost(db: Session, tenant_id: str) -> float:
    start = datetime.now(timezone.utc).replace(day=1, hour=0, minute=0, second=0, microsecond=0)
    total = (
        db.query(func.coalesce(func.sum(Run.cost), 0.0))
        .filter(Run.tenant_id == tenant_id, Run.created_at >= start)
        .scalar()
    )
    return float(total or 0.0)


def execute_run(
    db: Session,
    *,
    user: User,
    agent: Agent,
    version: AgentVersion,
    input_text: str,
    requested_tools: list[str],
) -> dict:
    settings = get_settings()
    spans: list[SpanRecord] = []
    seq = 0

    def span(**kw) -> None:
        nonlocal seq
        spans.append(SpanRecord(seq=seq, **kw))
        seq += 1

    # Column defaults only fire at INSERT, so generate the trace id up front —
    # spans buffered before the flush need it.
    run = Run(
        id=uuid.uuid4().hex,
        agent_version_id=version.id,
        tenant_id=user.tenant_id,
        status="ok",
        trace_id=uuid.uuid4().hex,
    )
    trace_id = run.trace_id
    t0 = time.perf_counter()

    # 1. Rate limit (per tenant).
    if not get_rate_limiter().allow(user.tenant_id, settings.rate_limit_per_minute):
        _audit(db, user.tenant_id, user.id, "ratelimit.block", agent.id, {})
        db.commit()
        raise GatewayError(429, "rate limit exceeded")

    # 2. Cost cap (per tenant, month-to-date).
    if _month_to_date_cost(db, user.tenant_id) >= user.tenant.monthly_cost_cap:
        _audit(db, user.tenant_id, user.id, "costcap.block", agent.id, {})
        db.commit()
        raise GatewayError(402, "monthly cost cap reached")

    span(trace_id=trace_id, type="prompt", name="input", input=input_text)

    # 3. Pre-call guardrails.
    pre = run_pre_guardrails(
        input_text,
        enabled=version.guardrails,
        requested_tools=requested_tools,
        allowed_tools=version.tools,
    )
    violations = [v.__dict__ for v in pre.violations]
    span(
        trace_id=trace_id,
        type="guardrail",
        name="pre",
        input=input_text,
        output=pre.text,
        meta={"violations": violations},
    )
    for v in pre.violations:
        _audit(
            db, user.tenant_id, "system", f"guardrail.{v.action}", trace_id,
            {"guardrail": v.guardrail, "phase": "pre", "detail": v.detail},
        )

    if pre.blocked:
        run.status = "blocked"
        run.latency_ms = int((time.perf_counter() - t0) * 1000)
        db.add(run)
        db.commit()
        get_span_store().write(spans)
        return {
            "run_id": run.id, "trace_id": trace_id, "status": "blocked",
            "provider": None, "output": _BLOCKED_MESSAGE,
            "total_tokens": 0, "cost": 0.0, "latency_ms": run.latency_ms,
            "violations": violations,
        }

    # 4. LLM call with provider fallback.
    llm_t0 = time.perf_counter()
    outcome = run_with_fallback(
        chain=version.fallback_chain,
        system=version.system_prompt,
        prompt=pre.text,
        model=version.model,
    )
    result = outcome.result
    llm_ms = int((time.perf_counter() - llm_t0) * 1000)
    span(
        trace_id=trace_id,
        type="llm",
        name=result.provider,
        input=pre.text,
        output=result.output,
        tokens=result.total_tokens,
        latency_ms=llm_ms,
        meta={"attempts": outcome.attempts, "model": result.model},
    )

    # 5. Post-call guardrails.
    post = run_post_guardrails(result.output, enabled=version.guardrails)
    post_violations = [v.__dict__ for v in post.violations]
    violations.extend(post_violations)
    span(
        trace_id=trace_id,
        type="guardrail",
        name="post",
        input=result.output,
        output=post.text,
        meta={"violations": post_violations},
    )
    for v in post.violations:
        _audit(
            db, user.tenant_id, "system", f"guardrail.{v.action}", trace_id,
            {"guardrail": v.guardrail, "phase": "post", "detail": v.detail},
        )

    # 6. Cost calc.
    cost = cost_usd(result.model, result.input_tokens, result.output_tokens)
    span(
        trace_id=trace_id,
        type="cost",
        name="cost_calc",
        cost=cost,
        tokens=result.total_tokens,
        meta={"model": result.model, "input_tokens": result.input_tokens,
              "output_tokens": result.output_tokens},
    )

    output_text = _BLOCKED_MESSAGE if post.blocked else post.text
    run.status = "blocked" if post.blocked else "ok"
    run.provider = result.provider
    run.total_tokens = result.total_tokens
    run.cost = cost
    run.latency_ms = int((time.perf_counter() - t0) * 1000)

    db.add(run)
    _audit(
        db, user.tenant_id, user.id, "run.complete", run.id,
        {"provider": result.provider, "status": run.status, "cost": cost},
    )
    db.commit()

    # 7. Emit trace (best-effort, after the response is finalized).
    get_span_store().write(spans)

    return {
        "run_id": run.id, "trace_id": trace_id, "status": run.status,
        "provider": result.provider, "output": output_text,
        "total_tokens": result.total_tokens, "cost": cost,
        "latency_ms": run.latency_ms, "violations": violations,
    }
