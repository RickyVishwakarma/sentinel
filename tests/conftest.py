"""Test fixtures. Uses an isolated SQLite DB and the always-available template
provider (no API keys set), so tests run offline and deterministically."""

from __future__ import annotations

import os
import tempfile

# Point the app at a throwaway DB *before* app modules read settings.
_tmp = tempfile.NamedTemporaryFile(suffix=".db", delete=False)
_tmp.close()
os.environ["DATABASE_URL"] = f"sqlite:///{_tmp.name}"
os.environ["RATE_LIMIT_PER_MINUTE"] = "1000"

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

from app.db import Base, SessionLocal, engine  # noqa: E402
from app.main import app  # noqa: E402
from app.models import Agent, AgentVersion, Tenant, User  # noqa: E402


@pytest.fixture(autouse=True)
def fresh_db():
    Base.metadata.drop_all(bind=engine)
    Base.metadata.create_all(bind=engine)
    yield


@pytest.fixture
def client() -> TestClient:
    return TestClient(app)


@pytest.fixture
def seeded() -> dict:
    """Create a tenant + admin user + agent; return their ids and API key."""
    db = SessionLocal()
    try:
        tenant = Tenant(name="Test", plan="pro", monthly_cost_cap=50.0)
        db.add(tenant)
        db.flush()
        user = User(tenant_id=tenant.id, role="admin", api_key="test-key")
        db.add(user)
        agent = Agent(tenant_id=tenant.id, name="bot", current_version=1)
        db.add(agent)
        db.flush()
        db.add(
            AgentVersion(
                agent_id=agent.id,
                version=1,
                model="template",
                system_prompt="You are a helpful bot.",
                tools=["search_docs"],
                guardrails=["pii_redaction", "prompt_injection", "output_blocklist"],
                fallback_chain=["template"],
            )
        )
        db.commit()
        return {"api_key": "test-key", "agent_id": agent.id, "tenant_id": tenant.id}
    finally:
        db.close()
