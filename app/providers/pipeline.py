"""Provider fallback pipeline (Module M2).

Walks the agent version's ``fallback_chain`` in order, skipping providers that
aren't configured and moving on when one errors (5xx / timeout / no key). The
template provider is always appended last so a run can never fail for lack of a
provider — matching the demo's "kill the primary, run still succeeds" flow.
"""

from __future__ import annotations

from dataclasses import dataclass

from app.providers.anthropic_provider import AnthropicProvider
from app.providers.base import Provider, ProviderResult
from app.providers.gemini_provider import GeminiProvider
from app.providers.openai_provider import OpenAIProvider
from app.providers.template import TemplateProvider

# Registry of provider id -> instance. Instantiated once at import.
_REGISTRY: dict[str, Provider] = {
    p.id: p
    for p in (AnthropicProvider(), OpenAIProvider(), GeminiProvider(), TemplateProvider())
}


@dataclass
class FallbackOutcome:
    result: ProviderResult
    attempts: list[dict]  # per-provider attempt log for the trace


def run_with_fallback(
    *, chain: list[str], system: str, prompt: str, model: str
) -> FallbackOutcome:
    """Try each provider in ``chain``; always end on the template provider."""
    ordered = [pid for pid in chain if pid in _REGISTRY]
    if "template" not in ordered:
        ordered.append("template")

    attempts: list[dict] = []
    for pid in ordered:
        provider = _REGISTRY[pid]
        if not provider.available():
            attempts.append({"provider": pid, "status": "skipped", "reason": "not_configured"})
            continue
        try:
            result = provider.generate(system=system, prompt=prompt, model=model)
            attempts.append({"provider": pid, "status": "ok"})
            return FallbackOutcome(result=result, attempts=attempts)
        except Exception as exc:  # noqa: BLE001 — any provider error falls through
            attempts.append({"provider": pid, "status": "error", "reason": str(exc)[:200]})

    # Unreachable: template is always available. Guard anyway.
    raise RuntimeError("no provider produced a result")


def stream_with_fallback(*, chain: list[str], system: str, prompt: str, model: str):
    """Streaming variant of the fallback walk.

    Yields ``("provider", {"provider": id, "attempts": [...]})`` exactly once —
    after the chosen provider produced its first chunk — then ``("delta", str)``
    for each chunk. Fallback only happens *before* the first chunk; once tokens
    have been emitted the stream is committed to that provider.
    """
    ordered = [pid for pid in chain if pid in _REGISTRY]
    if "template" not in ordered:
        ordered.append("template")

    attempts: list[dict] = []
    for pid in ordered:
        provider = _REGISTRY[pid]
        if not provider.available():
            attempts.append({"provider": pid, "status": "skipped", "reason": "not_configured"})
            continue
        try:
            gen = provider.stream_generate(system=system, prompt=prompt, model=model)
            first = next(gen, None)  # provider errors surface here, pre-emission
        except Exception as exc:  # noqa: BLE001 — any provider error falls through
            attempts.append({"provider": pid, "status": "error", "reason": str(exc)[:200]})
            continue
        attempts.append({"provider": pid, "status": "ok", "streamed": True})
        yield ("provider", {"provider": pid, "attempts": attempts})
        if first is not None:
            yield ("delta", first)
            yield from (("delta", chunk) for chunk in gen)
        return

    raise RuntimeError("no provider produced a result")
