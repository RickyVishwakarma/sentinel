"""Post-call guardrails: run on the LLM output before it reaches the client."""

from __future__ import annotations

import json
import re

from app.guardrails.types import GuardrailResult, Violation

# Words/phrases that should never appear in an output. In a real deployment
# these come from the agent's output-policy config; kept inline for the MVP.
_BLOCKLIST: list[re.Pattern] = [
    re.compile(r"\b(api[_ ]?key|secret[_ ]?key|password)\s*[:=]\s*\S+", re.I),
    re.compile(r"\bBEGIN (RSA |EC )?PRIVATE KEY\b", re.I),
]


def run_post_guardrails(
    text: str,
    *,
    enabled: list[str],
    schema: dict | None = None,
) -> GuardrailResult:
    """Apply enabled post-call guardrails.

    Supported ids: ``output_blocklist`` (regex leak check), ``json_schema``
    (require the output to be a JSON object; ``schema`` may name required keys).
    """
    violations: list[Violation] = []

    if "output_blocklist" in enabled:
        for pattern in _BLOCKLIST:
            if pattern.search(text):
                violations.append(
                    Violation("output_blocklist", "block", f"matched: {pattern.pattern}")
                )
                break

    if "json_schema" in enabled:
        try:
            parsed = json.loads(text)
            required = (schema or {}).get("required", [])
            missing = [k for k in required if k not in parsed]
            if missing:
                violations.append(
                    Violation("json_schema", "flag", f"missing keys: {missing}")
                )
        except (json.JSONDecodeError, TypeError):
            violations.append(Violation("json_schema", "flag", "output was not valid JSON"))

    return GuardrailResult(text=text, violations=violations)
