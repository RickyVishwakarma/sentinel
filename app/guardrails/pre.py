"""Pre-call guardrails: run on the user input before it reaches the LLM."""

from __future__ import annotations

import re

from app.guardrails.types import GuardrailResult, Violation

# ── PII patterns ──────────────────────────────────────────────────────────
_PII_PATTERNS: list[tuple[str, re.Pattern]] = [
    ("EMAIL", re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")),
    ("SSN", re.compile(r"\b\d{3}-\d{2}-\d{4}\b")),
    ("CREDIT_CARD", re.compile(r"\b(?:\d[ -]*?){13,16}\b")),
    ("PHONE", re.compile(r"\b(?:\+?\d{1,2}[ -]?)?\(?\d{3}\)?[ -]?\d{3}[ -]?\d{4}\b")),
]

# ── Prompt-injection / jailbreak heuristics ───────────────────────────────
_INJECTION_PATTERNS: list[re.Pattern] = [
    re.compile(r"ignore (all |the |your )?(previous|prior|above) (instructions|prompt)", re.I),
    re.compile(r"disregard (all |the |your )?(previous|prior|system) (instructions|prompt)", re.I),
    re.compile(r"reveal (your |the )?(system prompt|instructions|hidden)", re.I),
    re.compile(r"you are (now )?(dan|developer mode|jailbroken)", re.I),
    re.compile(r"pretend (you are|to be) (an? )?(unrestricted|uncensored)", re.I),
    re.compile(r"\boverride (the )?(guardrails|safety|rules)\b", re.I),
]


def redact_pii(text: str) -> tuple[str, list[str]]:
    """Replace PII with typed placeholders. Returns (redacted_text, kinds_found)."""
    found: list[str] = []
    redacted = text
    for label, pattern in _PII_PATTERNS:
        if pattern.search(redacted):
            found.append(label)
            redacted = pattern.sub(f"[REDACTED_{label}]", redacted)
    return redacted, found


def detect_injection(text: str) -> str | None:
    for pattern in _INJECTION_PATTERNS:
        if pattern.search(text):
            return pattern.pattern
    return None


def run_pre_guardrails(
    text: str,
    *,
    enabled: list[str],
    requested_tools: list[str] | None = None,
    allowed_tools: list[str] | None = None,
) -> GuardrailResult:
    """Apply the enabled pre-call guardrails.

    ``enabled`` is the agent version's guardrail list; supported ids:
    ``pii_redaction``, ``prompt_injection``, ``tool_allowlist``.
    """
    violations: list[Violation] = []
    out = text

    if "pii_redaction" in enabled:
        out, kinds = redact_pii(out)
        if kinds:
            violations.append(
                Violation("pii_redaction", "flag", f"redacted: {', '.join(kinds)}")
            )

    if "prompt_injection" in enabled:
        hit = detect_injection(out)
        if hit:
            violations.append(
                Violation("prompt_injection", "block", f"matched pattern: {hit}")
            )

    if "tool_allowlist" in enabled and requested_tools:
        allowed = set(allowed_tools or [])
        disallowed = [t for t in requested_tools if t not in allowed]
        if disallowed:
            violations.append(
                Violation("tool_allowlist", "block", f"disallowed tools: {disallowed}")
            )

    return GuardrailResult(text=out, violations=violations)
