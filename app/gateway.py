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
from app.models import Agent, AgentVersion, Approval, AuditLog, Run, User
from app.providers import run_with_fallback, stream_with_fallback
from app.providers.base import _estimate_tokens
from app.ratelimit import get_rate_limiter
from app.spans import SpanRecord, get_span_store
from app.config import get_settings

_BLOCKED_MESSAGE = "This request was blocked by a Sentinel guardrail."
_HELD_MESSAGE = (
    "This response was flagged as risky and is held for human approval. "
    "An admin can release it from the approval queue."
)


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


def _apply_cost_cap(
    db: Session, *, user: User, agent: Agent, chain: list[str], violations: list[dict]
) -> list[str]:
    """PRD Q2: enforce the tenant's cost-cap policy when the cap is reached.

    Returns the (possibly degraded) fallback chain; raises GatewayError in
    block mode. The mode is the tenant admin's choice (see /v1/tenant).
    """
    if _month_to_date_cost(db, user.tenant_id) < user.tenant.monthly_cost_cap:
        return chain

    mode = getattr(user.tenant, "cost_cap_mode", None) or "block"
    if mode == "warn":
        violations.append({
            "guardrail": "cost_cap", "action": "warn",
            "detail": f"monthly cost cap ${user.tenant.monthly_cost_cap} reached; mode=warn",
        })
        _audit(db, user.tenant_id, "system", "costcap.warn", agent.id, {"mode": "warn"})
        return chain
    if mode == "degrade":
        violations.append({
            "guardrail": "cost_cap", "action": "degrade",
            "detail": "monthly cost cap reached; degraded to the free template provider",
        })
        _audit(db, user.tenant_id, "system", "costcap.degrade", agent.id, {"mode": "degrade"})
        return ["template"]
    _audit(db, user.tenant_id, user.id, "costcap.block", agent.id, {"mode": "block"})
    db.commit()
    raise GatewayError(402, "monthly cost cap reached")


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

    # 2. Cost cap (per tenant, month-to-date) — policy is the tenant's (PRD Q2).
    violations: list[dict] = []
    chain = _apply_cost_cap(
        db, user=user, agent=agent, chain=version.fallback_chain, violations=violations
    )

    span(trace_id=trace_id, type="prompt", name="input", input=input_text)

    # 3. Pre-call guardrails.
    pre = run_pre_guardrails(
        input_text,
        enabled=version.guardrails,
        requested_tools=requested_tools,
        allowed_tools=version.tools,
    )
    violations.extend(v.__dict__ for v in pre.violations)
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

    # 4. LLM call with provider fallback (chain may be cost-cap degraded).
    llm_t0 = time.perf_counter()
    outcome = run_with_fallback(
        chain=chain,
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

    # 7. Human-in-the-loop hold (Module M6): flag-level violations on an agent
    # with hitl_approval enabled withhold the output until an admin decides.
    approval_id: str | None = None
    flags = [v for v in violations if v.get("action") == "flag"]
    if run.status == "ok" and flags and "hitl_approval" in version.guardrails:
        run.status = "pending_approval"
        approval = Approval(
            id=uuid.uuid4().hex,
            tenant_id=user.tenant_id,
            run_id=run.id,
            trace_id=trace_id,
            reason=flags,
            held_output=output_text,
        )
        db.add(approval)
        approval_id = approval.id
        output_text = _HELD_MESSAGE
        _audit(
            db, user.tenant_id, "system", "hitl.hold", run.id,
            {"approval_id": approval.id, "violations": flags},
        )

    db.add(run)
    _audit(
        db, user.tenant_id, user.id, "run.complete", run.id,
        {"provider": result.provider, "status": run.status, "cost": cost},
    )
    db.commit()

    # 8. Emit trace (best-effort, after the response is finalized).
    get_span_store().write(spans)

    return {
        "run_id": run.id, "trace_id": trace_id, "status": run.status,
        "provider": result.provider, "output": output_text,
        "total_tokens": result.total_tokens, "cost": cost,
        "latency_ms": run.latency_ms, "violations": violations,
        "approval_id": approval_id,
    }


# ── Streaming (PRD open question Q1) ────────────────────────────────────────
#
# The answer implemented here:
#   * Pre-call guardrails run BEFORE any token is emitted — a blocked input
#     never opens a stream.
#   * Post-call guardrails run INCREMENTALLY over the accumulated output while
#     a tail window of TAIL_HOLD chars is held back, so a leak pattern is
#     caught before its tail is emitted. A mid-stream block cuts the stream;
#     the withheld tail is never sent. Best-effort by construction — a pattern
#     longer than TAIL_HOLD could partially escape — which is why the full
#     post-pass is still recorded on the trace and audit log.
#   * HITL cannot compose with streaming (tokens cannot be un-sent), so agents
#     with the hitl_approval guardrail are refused on the stream endpoint.

TAIL_HOLD = 96  # chars withheld from emission until cleared by the next scan


def stream_run(
    db: Session,
    *,
    user: User,
    agent: Agent,
    version: AgentVersion,
    input_text: str,
    requested_tools: list[str],
):
    """Run the gateway pipeline in streaming mode.

    Returns ``("blocked", response_dict)`` when a pre-call guardrail blocks the
    input (no stream is opened), or ``("stream", generator)`` yielding SSE-ready
    event dicts: meta → provider → delta* → [blocked] → done.
    """
    settings = get_settings()

    if "hitl_approval" in version.guardrails:
        raise GatewayError(
            409,
            "streaming is unavailable for agents with hitl_approval: "
            "held output cannot be un-sent once streamed",
        )

    if not get_rate_limiter().allow(user.tenant_id, settings.rate_limit_per_minute):
        _audit(db, user.tenant_id, user.id, "ratelimit.block", agent.id, {})
        db.commit()
        raise GatewayError(429, "rate limit exceeded")

    violations: list[dict] = []
    chain = _apply_cost_cap(
        db, user=user, agent=agent, chain=version.fallback_chain, violations=violations
    )

    run = Run(
        id=uuid.uuid4().hex,
        agent_version_id=version.id,
        tenant_id=user.tenant_id,
        status="ok",
        trace_id=uuid.uuid4().hex,
    )
    trace_id = run.trace_id
    t0 = time.perf_counter()

    spans: list[SpanRecord] = []
    seq = 0

    def span(**kw) -> None:
        nonlocal seq
        spans.append(SpanRecord(seq=seq, **kw))
        seq += 1

    span(trace_id=trace_id, type="prompt", name="input", input=input_text)

    pre = run_pre_guardrails(
        input_text,
        enabled=version.guardrails,
        requested_tools=requested_tools,
        allowed_tools=version.tools,
    )
    violations.extend(v.__dict__ for v in pre.violations)
    span(
        trace_id=trace_id, type="guardrail", name="pre",
        input=input_text, output=pre.text, meta={"violations": violations},
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
        return ("blocked", {
            "run_id": run.id, "trace_id": trace_id, "status": "blocked",
            "provider": None, "output": _BLOCKED_MESSAGE,
            "total_tokens": 0, "cost": 0.0, "latency_ms": run.latency_ms,
            "violations": violations, "approval_id": None,
        })

    def events():
        yield {"event": "meta", "data": {
            "run_id": run.id, "trace_id": trace_id,
            "agent_id": agent.id, "agent_version": version.version,
        }}

        text = ""
        emitted = 0
        provider_id: str | None = None
        attempts: list[dict] = []
        blocked_mid = False
        stream_error: str | None = None
        llm_t0 = time.perf_counter()

        try:
            for kind, payload in stream_with_fallback(
                chain=chain,
                system=version.system_prompt,
                prompt=pre.text,
                model=version.model,
            ):
                if kind == "provider":
                    provider_id = payload["provider"]
                    attempts = payload["attempts"]
                    yield {"event": "provider", "data": {"provider": provider_id}}
                    continue
                text += payload
                scan = run_post_guardrails(text, enabled=version.guardrails)
                if scan.blocked:
                    blocked_mid = True
                    break
                safe_upto = max(emitted, len(text) - TAIL_HOLD)
                if safe_upto > emitted:
                    yield {"event": "delta", "data": {"text": text[emitted:safe_upto]}}
                    emitted = safe_upto
        except RuntimeError as exc:  # no provider produced a result
            stream_error = str(exc)

        llm_ms = int((time.perf_counter() - llm_t0) * 1000)

        post = run_post_guardrails(text, enabled=version.guardrails)
        post_violations = [v.__dict__ for v in post.violations]
        violations.extend(post_violations)
        blocked = blocked_mid or post.blocked

        if not blocked and emitted < len(text):
            yield {"event": "delta", "data": {"text": text[emitted:]}}
            emitted = len(text)

        model_used = version.model if provider_id == "anthropic" else (provider_id or "")
        input_tokens = _estimate_tokens(version.system_prompt + pre.text)
        output_tokens = _estimate_tokens(text)
        cost = cost_usd(model_used, input_tokens, output_tokens)

        span(
            trace_id=trace_id, type="llm", name=provider_id or "none",
            input=pre.text, output=text,
            tokens=input_tokens + output_tokens, latency_ms=llm_ms,
            meta={"attempts": attempts, "model": model_used, "streamed": True,
                  "tokens_estimated": True},
        )
        span(
            trace_id=trace_id, type="guardrail", name="post",
            input=text, output=post.text,
            meta={"violations": post_violations, "mid_stream_cut": blocked_mid,
                  "chars_emitted": emitted},
        )
        for v in post.violations:
            _audit(
                db, user.tenant_id, "system", f"guardrail.{v.action}", trace_id,
                {"guardrail": v.guardrail, "phase": "post", "detail": v.detail,
                 "streamed": True, "chars_emitted": emitted},
            )
        span(
            trace_id=trace_id, type="cost", name="cost_calc",
            cost=cost, tokens=input_tokens + output_tokens,
            meta={"model": model_used, "input_tokens": input_tokens,
                  "output_tokens": output_tokens, "estimated": True},
        )

        run.status = "error" if stream_error else ("blocked" if blocked else "ok")
        run.provider = provider_id
        run.total_tokens = input_tokens + output_tokens
        run.cost = cost
        run.latency_ms = int((time.perf_counter() - t0) * 1000)
        db.add(run)
        _audit(
            db, user.tenant_id, user.id, "run.complete", run.id,
            {"provider": provider_id, "status": run.status, "cost": cost,
             "streamed": True},
        )
        db.commit()
        get_span_store().write(spans)

        if blocked:
            yield {"event": "blocked", "data": {
                "message": _BLOCKED_MESSAGE, "violations": post_violations,
                "chars_emitted": emitted,
            }}
        yield {"event": "done", "data": {
            "run_id": run.id, "trace_id": trace_id, "status": run.status,
            "provider": provider_id, "total_tokens": run.total_tokens,
            "cost": cost, "latency_ms": run.latency_ms, "violations": violations,
        }}

    return ("stream", events())
