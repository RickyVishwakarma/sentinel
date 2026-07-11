"""SQLAlchemy engine + session wiring.

Relational data (tenants, agents, runs, audit, cost) lives here. The default
is a local SQLite file so the app runs with zero setup; point DATABASE_URL at
Postgres for production — no code changes needed.
"""

from collections.abc import Iterator

from sqlalchemy import create_engine
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

_settings = get_settings()

# check_same_thread is a SQLite-only knob; harmless to pass only when relevant.
_connect_args = {"check_same_thread": False} if _settings.database_url.startswith("sqlite") else {}

engine = create_engine(_settings.database_url, connect_args=_connect_args, future=True)
SessionLocal = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False, future=True)


class Base(DeclarativeBase):
    pass


def get_db() -> Iterator[Session]:
    """FastAPI dependency: one Session per request, always closed."""
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def init_db() -> None:
    """Create tables. Import models first so they register on Base.metadata."""
    from app import models  # noqa: F401  (registers mappers)

    Base.metadata.create_all(bind=engine)
