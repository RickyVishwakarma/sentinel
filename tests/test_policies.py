"""PRD Q2 (cost-cap policy) and Q3 (retention + PII at rest)."""

from __future__ import annotations

from datetime import datetime, timedelta, timezone

from app.db import SessionLocal
from app.models import Span, Tenant


def _hit_cap(tenant_id: str, mode: str) -> None:
    """Set the cap to 0 so month-to-date (0.0) >= cap immediately."""
    db = SessionLocal()
    try:
        tenant = db.get(Tenant, tenant_id)
        tenant.monthly_cost_cap = 0.0
        tenant.cost_cap_mode = mode
        db.commit()
    finally:
        db.close()


def _run(client, seeded, text="hello"):
    return client.post(
        f"/v1/agents/{seeded['agent_id']}/run",
        headers={"Authorization": f"Bearer {seeded['api_key']}"},
        json={"input": text},
    )


# ── Q2: cost-cap modes ─────────────────────────────────────────────────────

def test_cost_cap_block_mode(client, seeded):
    _hit_cap(seeded["tenant_id"], "block")
    assert _run(client, seeded).status_code == 402


def test_cost_cap_warn_mode_proceeds_with_warning(client, seeded):
    _hit_cap(seeded["tenant_id"], "warn")
    res = _run(client, seeded)
    assert res.status_code == 200
    body = res.json()
    assert body["status"] == "ok"
    assert any(
        v["guardrail"] == "cost_cap" and v["action"] == "warn"
        for v in body["violations"]
    )


def test_cost_cap_degrade_mode_forces_template(client, seeded):
    _hit_cap(seeded["tenant_id"], "degrade")
    res = _run(client, seeded)
    assert res.status_code == 200
    body = res.json()
    assert body["provider"] == "template"
    assert any(v["action"] == "degrade" for v in body["violations"])


def test_tenant_settings_endpoint(client, seeded):
    headers = {"Authorization": f"Bearer {seeded['api_key']}"}
    out = client.patch(
        "/v1/tenant", headers=headers,
        json={"cost_cap_mode": "degrade", "monthly_cost_cap": 10.0},
    ).json()
    assert out["cost_cap_mode"] == "degrade"
    assert out["monthly_cost_cap"] == 10.0

    assert client.patch(
        "/v1/tenant", headers=headers, json={"cost_cap_mode": "explode"}
    ).status_code == 422


# ── Q3: PII redaction at rest + retention ──────────────────────────────────

def test_spans_are_pii_redacted_at_rest(client, seeded):
    res = _run(client, seeded, "My email is jane@example.com, help me").json()
    trace = client.get(
        f"/v1/traces/{res['trace_id']}",
        headers={"Authorization": f"Bearer {seeded['api_key']}"},
    ).json()
    joined = " ".join(s["input"] + " " + s["output"] for s in trace["spans"])
    assert "jane@example.com" not in joined
    assert "[REDACTED_EMAIL]" in joined


def test_retention_purge_deletes_only_expired_spans(client, seeded):
    res = _run(client, seeded).json()  # fresh trace

    db = SessionLocal()
    try:
        db.add(Span(
            trace_id="old-trace", type="prompt", name="input", seq=0,
            ts=datetime.now(timezone.utc) - timedelta(days=90),
        ))
        db.commit()
    finally:
        db.close()

    headers = {"Authorization": f"Bearer {seeded['api_key']}"}
    purged = client.post("/v1/admin/traces/purge", headers=headers).json()
    assert purged["deleted"] == 1

    fresh = client.get(f"/v1/traces/{res['trace_id']}", headers=headers).json()
    assert len(fresh["spans"]) > 0
