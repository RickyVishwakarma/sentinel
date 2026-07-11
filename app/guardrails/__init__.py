"""Guardrails (Module M3).

Pre-call: PII redaction, prompt-injection / jailbreak detection, tool allow-list.
Post-call: output policy (regex / schema).

Each check returns a GuardrailResult. Violations either *block* (halt the run,
return a safe message) or *flag* (allow but record). Every check always yields
an audit entry via the pipeline.
"""

from app.guardrails.pre import run_pre_guardrails
from app.guardrails.post import run_post_guardrails
from app.guardrails.types import GuardrailResult, Violation

__all__ = [
    "run_pre_guardrails",
    "run_post_guardrails",
    "GuardrailResult",
    "Violation",
]
