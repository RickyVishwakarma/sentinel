"""HITL approval queue (Module M6): flag → hold → decide."""

from __future__ import annotations

from app.db import SessionLocal
from app.models import Agent, AgentVersion, User


def _enable_hitl(agent_id: str) -> None:
    db = SessionLocal()
    try:
        version = (
            db.query(AgentVersion).filter(AgentVersion.agent_id == agent_id).first()
        )
        version.guardrails = version.guardrails + ["hitl_approval"]
        db.commit()
    finally:
        db.close()


def _run_with_pii(client, seeded) -> dict:
    return client.post(
        f"/v1/agents/{seeded['agent_id']}/run",
        headers={"Authorization": f"Bearer {seeded['api_key']}"},
        json={"input": "My email is jane@example.com — where is my order?"},
    ).json()


def test_flagged_run_is_held_for_approval(client, seeded):
    _enable_hitl(seeded["agent_id"])
    res = _run_with_pii(client, seeded)

    assert res["status"] == "pending_approval"
    assert res["approval_id"]
    assert "held for human approval" in res["output"]
    # the real output must not leak through the run response
    assert "jane@example.com" not in res["output"]


def test_approve_releases_output_and_updates_run(client, seeded):
    _enable_hitl(seeded["agent_id"])
    headers = {"Authorization": f"Bearer {seeded['api_key']}"}
    res = _run_with_pii(client, seeded)

    decided = client.post(
        f"/v1/approvals/{res['approval_id']}/decide",
        headers=headers,
        json={"decision": "approve", "note": "looks fine"},
    )
    assert decided.status_code == 200
    body = decided.json()
    assert body["status"] == "approved"
    # PII was redacted by the pre-guardrail before reaching the LLM
    assert "[REDACTED_EMAIL]" in body["held_output"]

    run = client.get(f"/v1/runs/{res['run_id']}", headers=headers).json()
    assert run["run"]["status"] == "ok"

    # double-decide is a conflict
    again = client.post(
        f"/v1/approvals/{res['approval_id']}/decide",
        headers=headers,
        json={"decision": "deny"},
    )
    assert again.status_code == 409


def test_deny_marks_run_denied(client, seeded):
    _enable_hitl(seeded["agent_id"])
    headers = {"Authorization": f"Bearer {seeded['api_key']}"}
    res = _run_with_pii(client, seeded)

    client.post(
        f"/v1/approvals/{res['approval_id']}/decide",
        headers=headers,
        json={"decision": "deny"},
    )
    run = client.get(f"/v1/runs/{res['run_id']}", headers=headers).json()
    assert run["run"]["status"] == "denied"


def test_viewer_cannot_decide_and_cannot_see_held_output(client, seeded):
    _enable_hitl(seeded["agent_id"])
    db = SessionLocal()
    try:
        db.add(
            User(tenant_id=seeded["tenant_id"], role="viewer", api_key="viewer-key")
        )
        db.commit()
    finally:
        db.close()

    res = _run_with_pii(client, seeded)
    viewer = {"Authorization": "Bearer viewer-key"}

    listed = client.get("/v1/approvals", headers=viewer).json()
    assert listed["entries"][0]["held_output"] is None

    denied = client.post(
        f"/v1/approvals/{res['approval_id']}/decide",
        headers=viewer,
        json={"decision": "approve"},
    )
    assert denied.status_code == 403


def test_no_hold_without_hitl_guardrail(client, seeded):
    # seeded agent has pii_redaction but NOT hitl_approval
    res = _run_with_pii(client, seeded)
    assert res["status"] == "ok"
    assert res["approval_id"] is None
    assert any(v["guardrail"] == "pii_redaction" for v in res["violations"])
