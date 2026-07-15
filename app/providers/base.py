"""Provider interface shared by every model backend."""

from __future__ import annotations

from dataclasses import dataclass


@dataclass
class ProviderResult:
    provider: str
    model: str
    output: str
    input_tokens: int
    output_tokens: int

    @property
    def total_tokens(self) -> int:
        return self.input_tokens + self.output_tokens


# Which model-name prefixes belong to which provider. Used so a run that falls
# back across providers doesn't hand a Claude model id to Gemini, etc.
_MODEL_PREFIXES = {
    "anthropic": ("claude",),
    "openai": ("gpt", "o1", "o3", "o4"),
    "gemini": ("gemini",),
}


class Provider:
    id: str = "base"

    def available(self) -> bool:
        """Whether this provider is usable (e.g. has an API key configured)."""
        return False

    def resolve_model(self, requested: str) -> str:
        """Use the requested model only if it belongs to this provider.

        The agent stores a single ``model`` string, but the fallback chain can
        span providers. When a run falls through to a provider whose family
        doesn't match the requested model, use that provider's default instead.
        """
        prefixes = _MODEL_PREFIXES.get(self.id, ())
        if requested and prefixes and requested.lower().startswith(prefixes):
            return requested
        return getattr(self, "_default_model", requested)

    def generate(self, *, system: str, prompt: str, model: str) -> ProviderResult:
        raise NotImplementedError

    def stream_generate(self, *, system: str, prompt: str, model: str):
        """Yield output text chunks. Default: pseudo-stream the full response.

        Providers with native streaming (Anthropic) override this; the rest
        chunk their complete() output so the fallback chain keeps identical
        semantics in streaming mode.
        """
        result = self.generate(system=system, prompt=prompt, model=model)
        words = result.output.split(" ")
        step = 6
        for i in range(0, len(words), step):
            chunk = " ".join(words[i : i + step])
            if i + step < len(words):
                chunk += " "
            yield chunk


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars/token) for providers that don't report usage."""
    return max(1, len(text) // 4)
