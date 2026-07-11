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


class Provider:
    id: str = "base"

    def available(self) -> bool:
        """Whether this provider is usable (e.g. has an API key configured)."""
        return False

    def generate(self, *, system: str, prompt: str, model: str) -> ProviderResult:
        raise NotImplementedError


def _estimate_tokens(text: str) -> int:
    """Rough token estimate (~4 chars/token) for providers that don't report usage."""
    return max(1, len(text) // 4)
