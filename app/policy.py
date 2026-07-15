"""Policy engine — the decision logic behind action governance.

Given a tool name, its call arguments, and the tenant/agent's policy rules,
decide whether the agent may perform the action: ``allow``, ``deny``, or
``require_approval``. Rules are evaluated by ascending priority; first match
wins. No rule matching falls through to a configurable default.

Kept dependency-free and deterministic so it is trivially testable.
"""

from __future__ import annotations

import fnmatch
import re
from dataclasses import dataclass


@dataclass
class Decision:
    effect: str            # "allow" | "deny" | "require_approval"
    reason: str
    matched_policy_id: str | None = None


def _get(arguments: dict, field: str):
    """Dotted-path lookup into the arguments dict (e.g. 'payment.amount')."""
    cur = arguments
    for part in field.split("."):
        if isinstance(cur, dict) and part in cur:
            cur = cur[part]
        else:
            return None
    return cur


def _as_number(v) -> float | None:
    try:
        return float(v)
    except (TypeError, ValueError):
        return None


def _match_condition(condition: dict | None, arguments: dict) -> bool:
    """Evaluate one condition against the call arguments.

    condition = {"field": "amount", "op": "gt", "value": 100}
    A null/absent condition always matches (rule applies to the tool as a whole).
    """
    if not condition:
        return True
    field = condition.get("field")
    op = condition.get("op", "always")
    expected = condition.get("value")
    if op == "always" or field is None:
        return True

    actual = _get(arguments, field)

    if op in ("gt", "gte", "lt", "lte"):
        a, b = _as_number(actual), _as_number(expected)
        if a is None or b is None:
            return False
        return {
            "gt": a > b, "gte": a >= b, "lt": a < b, "lte": a <= b,
        }[op]
    if op == "eq":
        return actual == expected
    if op == "ne":
        return actual != expected
    if op == "in":
        return isinstance(expected, list) and actual in expected
    if op == "not_in":
        return isinstance(expected, list) and actual not in expected
    if op == "contains":
        return expected is not None and str(expected) in str(actual or "")
    if op == "not_contains":
        return expected is not None and str(expected) not in str(actual or "")
    if op == "regex":
        try:
            return re.search(str(expected), str(actual or "")) is not None
        except re.error:
            return False
    return False


def evaluate(
    tool: str,
    arguments: dict,
    policies: list,
    *,
    default_effect: str = "allow",
) -> Decision:
    """Return the decision for a tool call under an ordered list of policies.

    ``policies`` are Policy ORM objects (or anything with .tool/.condition/
    .effect/.priority/.enabled/.id). They are sorted here by priority so callers
    don't have to.
    """
    ordered = sorted(
        (p for p in policies if getattr(p, "enabled", True)),
        key=lambda p: (getattr(p, "priority", 100), getattr(p, "created_at", None) or 0),
    )
    for p in ordered:
        if fnmatch.fnmatch(tool, p.tool) and _match_condition(p.condition, arguments):
            return Decision(
                effect=p.effect,
                reason=p.description or f"matched policy '{p.tool}' → {p.effect}",
                matched_policy_id=p.id,
            )
    return Decision(effect=default_effect, reason=f"no policy matched; default {default_effect}")
