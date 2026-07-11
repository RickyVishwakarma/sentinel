"""Cost attribution (Module M7) — token → USD mapping per provider/model.

Prices are USD per 1M tokens (input, output). The template provider is free.
Aggregation per tenant/agent/day is done in the cost router.
"""

# (input_per_mtok, output_per_mtok)
PRICING: dict[str, tuple[float, float]] = {
    "claude-opus-4-8": (5.00, 25.00),
    "claude-sonnet-5": (3.00, 15.00),
    "claude-haiku-4-5": (1.00, 5.00),
    "gpt-4o": (2.50, 10.00),
    "gpt-4o-mini": (0.15, 0.60),
    "gemini-1.5-flash": (0.075, 0.30),
    "gemini-1.5-pro": (1.25, 5.00),
    "template": (0.0, 0.0),
}

# Fallback price for unknown models so cost is never silently zero.
_DEFAULT = (1.00, 3.00)


def cost_usd(model: str, input_tokens: int, output_tokens: int) -> float:
    inp, out = PRICING.get(model, _DEFAULT)
    return round((input_tokens * inp + output_tokens * out) / 1_000_000, 6)
