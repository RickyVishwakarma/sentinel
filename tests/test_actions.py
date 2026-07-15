"""Action governance: the policy decision point, action approvals, kill switch."""

from __future__ import annotations

from app.policy import evaluate


def _h(seeded):
    return {"Authorization": f"Bearer {seeded['api_key']}"}


def _policy(client, seeded, **body):
    return client.post("/v1/policies", headers=_h(seeded), json=body)


def _check(client, seeded, tool, arguments=None):
    return client.post(
        f"/v1/agents/{seeded['agent_id']}/actions/check",
        headers=_h(seeded),
        json={"tool": tool, "arguments": arguments or {}},
    ).json()


# ── engine unit tests ──────────────────────────────────────────────────────

class _P:
    def __init__(self, tool, effect, condition=None, priority=100, id="p", enabled=True):
        self.tool, self.effect, self.condition = tool, effect, condition
        self.priority, self.id, self.enabled, self.description = priority, id, enabled, ""
        self.created_at = 0


def test_engine_first_match_by_priority():
    policies = [
        _P("*", "allow", priority=200, id="catchall"),
        _P("refund", "require_approval", condition={"field": "amount", "op": "gt", "value": 100},
           priority=10, id="big-refund"),
    ]
    d = evaluate("refund", {"amount": 500}, policies)
    assert d.effect == "require_approval"
    assert d.matched_policy_id == "big-refund"

    # small refund misses the condition, falls to the catch-all allow
    d2 = evaluate("refund", {"amount": 20}, policies)
    assert d2.effect == "allow"
    assert d2.matched_policy_id == "catchall"


def test_engine_default_when_no_match():
    assert evaluate("send_email", {}, []).effect == "allow"
    assert evaluate("send_email", {}, [], default_effect="deny").effect == "deny"


# ── decision point (API) ────────────────────────────────────────────────────

def test_action_allow_by_default(client, seeded):
    res = _check(client, seeded, "read_docs")
    assert res["decision"] == "allow"


def test_action_denied_by_policy(client, seeded):
    _policy(client, seeded, tool="delete_*", effect="deny", description="no deletes")
    res = _check(client, seeded, "delete_database", {"name": "prod"})
    assert res["decision"] == "deny"
    assert res["matched_policy_id"]


def test_action_conditional_approval_and_release(client, seeded):
    _policy(client, seeded, tool="refund", effect="require_approval",
            condition={"field": "amount", "op": "gt", "value": 100})

    # under threshold → allowed outright
    assert _check(client, seeded, "refund", {"amount": 50})["decision"] == "allow"

    # over threshold → held for approval
    held = _check(client, seeded, "refund", {"amount": 999})
    assert held["decision"] == "pending"
    assert held["approval_id"]

    # the action shows pending until a human decides
    poll = client.get(f"/v1/actions/{held['action_id']}", headers=_h(seeded)).json()
    assert poll["decision"] == "pending"

    # approve it → the action becomes approved (agent may now proceed)
    client.post(f"/v1/approvals/{held['approval_id']}/decide", headers=_h(seeded),
                json={"decision": "approve", "note": "ok this once"})
    poll2 = client.get(f"/v1/actions/{held['action_id']}", headers=_h(seeded)).json()
    assert poll2["decision"] == "approved"


def test_action_approval_can_be_denied(client, seeded):
    _policy(client, seeded, tool="wire_transfer", effect="require_approval")
    held = _check(client, seeded, "wire_transfer", {"amount": 5000})
    client.post(f"/v1/approvals/{held['approval_id']}/decide", headers=_h(seeded),
                json={"decision": "deny"})
    poll = client.get(f"/v1/actions/{held['action_id']}", headers=_h(seeded)).json()
    assert poll["decision"] == "denied"


def test_frozen_agent_denies_everything(client, seeded):
    _policy(client, seeded, tool="*", effect="allow")  # even an allow-all policy
    client.post(f"/v1/agents/{seeded['agent_id']}/freeze", headers=_h(seeded))

    res = _check(client, seeded, "read_docs")
    assert res["decision"] == "deny"
    assert "frozen" in res["reason"]

    client.post(f"/v1/agents/{seeded['agent_id']}/unfreeze", headers=_h(seeded))
    assert _check(client, seeded, "read_docs")["decision"] == "allow"


def test_actions_are_audited(client, seeded):
    _policy(client, seeded, tool="delete_*", effect="deny")
    _check(client, seeded, "delete_user", {"id": 42})
    audit = client.get("/v1/audit", headers=_h(seeded)).json()
    actions = [e for e in audit["entries"] if e["action"].startswith("action.")]
    assert any(e["action"] == "action.deny" for e in actions)


def test_viewer_cannot_create_policy_or_freeze(client, seeded):
    from app.db import SessionLocal
    from app.models import User

    db = SessionLocal()
    try:
        db.add(User(tenant_id=seeded["tenant_id"], role="viewer", api_key="viewer-key"))
        db.commit()
    finally:
        db.close()
    v = {"Authorization": "Bearer viewer-key"}
    assert client.post("/v1/policies", headers=v,
                       json={"tool": "*", "effect": "deny"}).status_code == 403
    assert client.post(
        f"/v1/agents/{seeded['agent_id']}/freeze", headers=v
    ).status_code == 403
