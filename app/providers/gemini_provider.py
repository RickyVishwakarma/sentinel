"""Google Gemini provider (fallback tier).

Uses the REST generateContent endpoint so it needs no extra SDK — only an API
key. Kept minimal on purpose; swap for google-genai if you prefer the SDK.
"""

from __future__ import annotations

import json
import urllib.request

from app.config import get_settings
from app.providers.base import Provider, ProviderResult, _estimate_tokens

_ENDPOINT = "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={key}"


class GeminiProvider(Provider):
    id = "gemini"

    def __init__(self) -> None:
        self._key = get_settings().gemini_api_key
        self._default_model = get_settings().gemini_model

    def available(self) -> bool:
        return bool(self._key)

    def generate(self, *, system: str, prompt: str, model: str) -> ProviderResult:
        model_id = model or self._default_model
        url = _ENDPOINT.format(model=model_id, key=self._key)
        body = {
            "contents": [{"role": "user", "parts": [{"text": prompt}]}],
        }
        if system:
            body["systemInstruction"] = {"parts": [{"text": system}]}

        req = urllib.request.Request(
            url, data=json.dumps(body).encode(), headers={"Content-Type": "application/json"}
        )
        with urllib.request.urlopen(req, timeout=60) as resp:  # noqa: S310 (trusted endpoint)
            data = json.loads(resp.read())

        text = data["candidates"][0]["content"]["parts"][0]["text"]
        usage = data.get("usageMetadata", {})
        return ProviderResult(
            provider=self.id,
            model=model_id,
            output=text,
            input_tokens=usage.get("promptTokenCount", _estimate_tokens(system + prompt)),
            output_tokens=usage.get("candidatesTokenCount", _estimate_tokens(text)),
        )
