"""Anthropic (Claude) provider.

Built against the official ``anthropic`` Python SDK. Defaults to Claude Opus 4.8
with adaptive thinking — the model decides how much to reason per request. Only
text blocks are returned to the caller; thinking blocks stay internal.
"""

from __future__ import annotations

from app.config import get_settings
from app.providers.base import Provider, ProviderResult, _estimate_tokens


class AnthropicProvider(Provider):
    id = "anthropic"

    def __init__(self) -> None:
        self._key = get_settings().anthropic_api_key
        self._default_model = get_settings().anthropic_model

    def available(self) -> bool:
        return bool(self._key)

    def generate(self, *, system: str, prompt: str, model: str) -> ProviderResult:
        from anthropic import Anthropic  # imported lazily; optional dependency

        client = Anthropic(api_key=self._key)
        model_id = self.resolve_model(model)
        message = client.messages.create(
            model=model_id,
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=system or None,
            messages=[{"role": "user", "content": prompt}],
        )

        text = "".join(
            block.text for block in message.content if getattr(block, "type", None) == "text"
        )
        usage = message.usage
        return ProviderResult(
            provider=self.id,
            model=model_id,
            output=text,
            input_tokens=getattr(usage, "input_tokens", _estimate_tokens(system + prompt)),
            output_tokens=getattr(usage, "output_tokens", _estimate_tokens(text)),
        )

    def stream_generate(self, *, system: str, prompt: str, model: str):
        """Native token streaming via the SDK's streaming helper."""
        from anthropic import Anthropic

        client = Anthropic(api_key=self._key)
        with client.messages.stream(
            model=self.resolve_model(model),
            max_tokens=16000,
            thinking={"type": "adaptive"},
            system=system or None,
            messages=[{"role": "user", "content": prompt}],
        ) as stream:
            yield from stream.text_stream
