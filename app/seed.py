"""Seed a demo tenant, an admin user (with API key), and a sample agent.

Run once after install:  python -m app.seed
Idempotent — re-running reuses the existing demo tenant and prints its API key.
"""

from __future__ import annotations

from app.db import SessionLocal, init_db
from app.models import Agent, AgentVersion, Tenant, User

DEMO_TENANT = "Demo Tenant"
DEMO_API_KEY = "sentinel-demo-key"  # fixed key so the README examples just work


def seed() -> None:
    init_db()
    db = SessionLocal()
    try:
        tenant = db.query(Tenant).filter(Tenant.name == DEMO_TENANT).first()
        if tenant is None:
            tenant = Tenant(name=DEMO_TENANT, plan="pro", monthly_cost_cap=50.0)
            db.add(tenant)
            db.flush()

        user = db.query(User).filter(User.api_key == DEMO_API_KEY).first()
        if user is None:
            user = User(tenant_id=tenant.id, role="admin", api_key=DEMO_API_KEY)
            db.add(user)
            db.flush()

        agent = (
            db.query(Agent)
            .filter(Agent.tenant_id == tenant.id, Agent.name == "support-bot")
            .first()
        )
        if agent is None:
            agent = Agent(tenant_id=tenant.id, name="support-bot", current_version=0)
            db.add(agent)
            db.flush()
            db.add(
                AgentVersion(
                    agent_id=agent.id,
                    version=1,
                    model="claude-opus-4-8",
                    system_prompt="You are a concise, friendly customer-support assistant.",
                    tools=["search_docs"],
                    guardrails=["pii_redaction", "prompt_injection", "output_blocklist", "hitl_approval"],
                    fallback_chain=["anthropic", "openai", "gemini"],
                )
            )
            agent.current_version = 1

        db.commit()

        print("Seed complete.")
        print(f"  Tenant:   {tenant.name} ({tenant.id})")
        print(f"  API key:  {DEMO_API_KEY}")
        print(f"  Agent:    {agent.name} ({agent.id})  v{agent.current_version}")
        print("\nTry it:")
        print(
            '  curl -s -X POST localhost:8000/v1/agents/'
            f'{agent.id}/run \\\n'
            f'    -H "Authorization: Bearer {DEMO_API_KEY}" \\\n'
            '    -H "Content-Type: application/json" \\\n'
            '    -d \'{"input": "How do I reset my password?"}\''
        )
    finally:
        db.close()


if __name__ == "__main__":
    seed()
