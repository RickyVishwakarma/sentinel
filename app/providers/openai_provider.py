"""OpenAI provider (fallback tier)."""

from __future__ import annotations

from app.config import get_settings
from app.providers.base import Provider, ProviderResult, _estimate_tokens


class OpenAIProvider(Provider):
    id = "openai"

    def __init__(self) -> None:
        self._key = get_settings().openai_api_key
        self._default_model = get_settings().openai_model

    def available(self) -> bool:
        return bool(self._key)

    def generate(self, *, system: str, prompt: str, model: str) -> ProviderResult:
        from openai import OpenAI  # imported lazily; optional dependency

        client = OpenAI(api_key=self._key)
        model_id = model or self._default_model
        messages = []
        if system:
            messages.append({"role": "system", "content": system})
        messages.append({"role": "user", "content": prompt})

        resp = client.chat.completions.create(model=model_id, messages=messages)
        text = resp.choices[0].message.content or ""
        usage = resp.usage
        return ProviderResult(
            provider=self.id,
            model=model_id,
            output=text,
            input_tokens=getattr(usage, "prompt_tokens", _estimate_tokens(system + prompt)),
            output_tokens=getattr(usage, "completion_tokens", _estimate_tokens(text)),
        )
