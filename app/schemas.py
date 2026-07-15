"""Pydantic request/response models for the API surface (Section 08)."""

from __future__ import annotations

from pydantic import BaseModel, Field


class AgentCreate(BaseModel):
    name: str
    model: str = "claude-opus-4-8"
    system_prompt: str = ""
    tools: list[str] = Field(default_factory=list)
    guardrails: list[str] = Field(
        default_factory=lambda: ["pii_redaction", "prompt_injection", "output_blocklist"]
    )
    fallback_chain: list[str] = Field(
        default_factory=lambda: ["anthropic", "openai", "gemini"]
    )


class AgentVersionCreate(BaseModel):
    """New immutable version. Any omitted field inherits the current version."""

    model: str | None = None
    system_prompt: str | None = None
    tools: list[str] | None = None
    guardrails: list[str] | None = None
    fallback_chain: list[str] | None = None


class AgentOut(BaseModel):
    id: str
    name: str
    current_version: int
    frozen: bool = False


class RunRequest(BaseModel):
    input: str
    requested_tools: list[str] = Field(default_factory=list)


class RunResponse(BaseModel):
    run_id: str
    trace_id: str
    status: str            # ok | blocked | pending_approval | denied | error
    provider: str | None
    output: str
    total_tokens: int
    cost: float
    latency_ms: int
    violations: list[dict] = Field(default_factory=list)
    approval_id: str | None = None  # set when the output is held for HITL approval


class ApprovalDecision(BaseModel):
    decision: str          # "approve" | "deny"
    note: str = ""


class TenantSettings(BaseModel):
    """PATCH /v1/tenant — cost-cap policy is the tenant admin's decision (Q2)."""

    cost_cap_mode: str | None = None      # "block" | "warn" | "degrade"
    monthly_cost_cap: float | None = None


class LoginRequest(BaseModel):
    email: str
    password: str


# ── Action governance ──────────────────────────────────────────────────────

class ActionCheckRequest(BaseModel):
    """An agent asks Sentinel whether it may perform a tool call."""

    tool: str
    arguments: dict = Field(default_factory=dict)


class PolicyCondition(BaseModel):
    field: str
    op: str = "always"     # gt|gte|lt|lte|eq|ne|in|not_in|contains|not_contains|regex|always
    value: object = None


class PolicyCreate(BaseModel):
    tool: str                       # glob: "refund", "delete_*", "*"
    effect: str                     # allow | deny | require_approval
    condition: PolicyCondition | None = None
    priority: int = 100
    description: str = ""
    agent_id: str | None = None     # null → applies to every agent in the tenant
    enabled: bool = True


class EvalCase(BaseModel):
    input: str
    expected: str = ""          # reference answer for relevance/faithfulness scoring
    expect_blocked: bool = False  # guardrails SHOULD block this case (e.g. injection probes)


class EvalRunRequest(BaseModel):
    agent_id: str
    eval_set: str = "default"
    cases: list[EvalCase]
    # CI gate threshold(s); a metric below its baseline fails the build.
    # Either one float for all metrics or a per-metric dict — metrics have
    # different natural scales (guardrail_pass_rate ~1.0, token-overlap ~0.1-0.4).
    baseline: float | dict[str, float] = 0.7
