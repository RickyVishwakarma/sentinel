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


class RunRequest(BaseModel):
    input: str
    requested_tools: list[str] = Field(default_factory=list)


class RunResponse(BaseModel):
    run_id: str
    trace_id: str
    status: str            # ok | blocked | error
    provider: str | None
    output: str
    total_tokens: int
    cost: float
    latency_ms: int
    violations: list[dict] = Field(default_factory=list)


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
