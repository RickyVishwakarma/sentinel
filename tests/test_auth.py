"""Login (email/password → API key) and provider status."""

from __future__ import annotations

from app.auth import hash_password
from app.db import SessionLocal
from app.models import User


def _set_login(api_key: str, email: str, password: str) -> None:
    db = SessionLocal()
    try:
        user = db.query(User).filter(User.api_key == api_key).first()
        user.email = email
        user.password_hash = hash_password(password)
        db.commit()
    finally:
        db.close()


def test_login_returns_api_key(client, seeded):
    _set_login(seeded["api_key"], "admin@test.dev", "hunter2")

    ok = client.post("/v1/auth/login", json={"email": "admin@test.dev", "password": "hunter2"})
    assert ok.status_code == 200
    body = ok.json()
    assert body["api_key"] == seeded["api_key"]
    assert body["role"] == "admin"
    assert body["tenant"]

    # the returned key actually works for a protected endpoint
    me = client.get("/v1/auth/me", headers={"Authorization": f"Bearer {body['api_key']}"})
    assert me.status_code == 200
    assert me.json()["email"] == "admin@test.dev"


def test_login_rejects_bad_password(client, seeded):
    _set_login(seeded["api_key"], "admin@test.dev", "hunter2")
    bad = client.post("/v1/auth/login", json={"email": "admin@test.dev", "password": "wrong"})
    assert bad.status_code == 401


def test_login_rejects_unknown_email(client, seeded):
    assert client.post(
        "/v1/auth/login", json={"email": "nobody@test.dev", "password": "x"}
    ).status_code == 401


def test_providers_status_reports_template(client):
    # no keys set in the test env → only the template provider is available
    body = client.get("/v1/providers").json()
    by_id = {p["id"]: p["available"] for p in body["providers"]}
    assert by_id["template"] is True
    assert by_id["anthropic"] is False
