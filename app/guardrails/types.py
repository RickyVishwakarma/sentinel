from __future__ import annotations

from dataclasses import dataclass, field


@dataclass
class Violation:
    guardrail: str          # e.g. "prompt_injection"
    action: str             # "block" | "flag"
    detail: str = ""


@dataclass
class GuardrailResult:
    """Outcome of a pre- or post-call guardrail pass over some text."""

    text: str                                   # possibly transformed (e.g. PII redacted)
    violations: list[Violation] = field(default_factory=list)

    @property
    def blocked(self) -> bool:
        return any(v.action == "block" for v in self.violations)
