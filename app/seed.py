"""Seed the demo tenant + an admin login. No sample agents or runs are created
— you register your own agent from the dashboard, so all data is yours.

Run once after install:  python -m app.seed
Idempotent — re-running reuses the existing demo tenant and (re)sets the
admin password so the printed credentials always work.
"""

from __future__ import annotations

from app.auth import hash_password
from app.db import SessionLocal, init_db
from app.models import Tenant, User

DEMO_TENANT = "Demo Tenant"
DEMO_EMAIL = "admin@sentinel.dev"
DEMO_PASSWORD = "sentinel123"
DEMO_API_KEY = "sentinel-demo-key"  # stable key so API/curl examples keep working


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
        user.email = DEMO_EMAIL
        user.password_hash = hash_password(DEMO_PASSWORD)

        db.commit()

        print("Seed complete — sign in at the dashboard with:")
        print(f"  Email:    {DEMO_EMAIL}")
        print(f"  Password: {DEMO_PASSWORD}")
        print(f"  (API key for curl / machine access: {DEMO_API_KEY})")
        print("\nNo agents are pre-created — register one from the Agents page,")
        print("then send it a message from the playground.")
    finally:
        db.close()


if __name__ == "__main__":
    seed()
