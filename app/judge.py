"""LLM-judge scoring for the eval harness (Module M5, PRD risk table).

Scores a (question, expected, output) triple 0.0–1.0 with Claude when an
Anthropic key is configured. Keyless deployments get ``None`` — the harness
reports the metric as unavailable rather than failing the CI gate, so the
deterministic metrics remain the keyless baseline.
"""

from __future__ import annotations

import json
import re

from app.config import get_settings

_JUDGE_SYSTEM = (
    "You are an evaluation judge for a customer-facing AI agent. Score how well "
    "the RESPONSE answers the QUESTION, using the REFERENCE as ground truth when "
    "given. Judge factual agreement with the reference and whether the question "
    "was actually addressed — not style. Reply with only a JSON object: "
    '{"score": <float 0.0-1.0>, "reason": "<one sentence>"}'
)


def judge_available() -> bool:
    return bool(get_settings().anthropic_api_key)


def judge_score(question: str, expected: str, output: str) -> tuple[float, str] | None:
    """Return (score, reason), or None when no judge model is configured."""
    settings = get_settings()
    if not settings.anthropic_api_key:
        return None

    import anthropic

    client = anthropic.Anthropic(api_key=settings.anthropic_api_key)
    prompt = (
        f"QUESTION:\n{question}\n\n"
        f"REFERENCE (may be empty):\n{expected}\n\n"
        f"RESPONSE:\n{output}"
    )
    try:
        msg = client.messages.create(
            model=settings.anthropic_model,
            max_tokens=256,
            system=_JUDGE_SYSTEM,
            messages=[{"role": "user", "content": prompt}],
        )
        text = "".join(b.text for b in msg.content if b.type == "text")
        match = re.search(r"\{.*\}", text, re.S)
        data = json.loads(match.group(0)) if match else {}
        score = float(data.get("score", 0.0))
        return max(0.0, min(1.0, score)), str(data.get("reason", ""))
    except Exception as exc:  # judge failures must never break the harness
        return 0.0, f"judge error: {exc}"
