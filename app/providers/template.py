"""Deterministic template provider — the always-available last resort.

It needs no API key and no network, so Sentinel runs end-to-end out of the box
and provider fallback can always terminate successfully. It echoes a structured,
reproducible response so traces, cost, and evals all have real data to work on.
"""

from __future__ import annotations

from app.providers.base import Provider, ProviderResult, _estimate_tokens


class TemplateProvider(Provider):
    id = "template"

    def available(self) -> bool:
        return True

    def generate(self, *, system: str, prompt: str, model: str) -> ProviderResult:
        summary = prompt.strip().replace("\n", " ")
        if len(summary) > 200:
            summary = summary[:200] + "…"
        output = (
            "[template-fallback] No live LLM provider was available, so this is a "
            "deterministic stand-in response.\n"
            f"System context: {system.strip()[:120] or '(none)'}\n"
            f"You asked: {summary}"
        )
        return ProviderResult(
            provider=self.id,
            model="template",
            output=output,
            input_tokens=_estimate_tokens(system + prompt),
            output_tokens=_estimate_tokens(output),
        )
