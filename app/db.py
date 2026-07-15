"""SQLAlchemy engine + session wiring.

Relational data (tenants, agents, runs, audit, cost) lives here. The default
is a local SQLite file so the app runs with zero setup; point DATABASE_URL at
Postgres for production — no code changes needed.
"""

from collections.abc import Iterator

from sqlalchemy import create_engine, event
from sqlalchemy.orm import DeclarativeBase, Session, sessionmaker

from app.config import get_settings

_settings = get_settings()

# PaaS hosts (Render, Heroku) hand out postgres:// URLs; SQLAlchemy needs an
# explicit driver scheme.
_db_url = _settings.database_url
if _db_url.startswith("postgres://"):
    _db_url = _db_url.replace("postgres://", "postgresql+psycopg://", 1)

_is_sqlite = _db_url.startswith("sqlite")

# check_same_thread is a SQLite-only knob; harmless to pass only when relevant.
_connect_args = {"check_same_thread": False} if _is_sqlite else {}

engine = create_engine(_db_url, connect_args=_connect_args, future=True)

if _is_sqlite:
    # WAL lets readers and a writer proceed concurrently; NORMAL fsync is safe
    # with WAL and removes most write-lock stalls under concurrent gateway load.
    @event.listens_for(engine, "connect")
    def _sqlite_pragmas(dbapi_conn, _record):  # pragma: no cover
        cur = dbapi_conn.cursor()
        cur.execute("PRAGMA journal_mode=WAL")
        cur.execute("PRAGMA synchronous=NORMAL")
        cur.execute("PRAGMA busy_timeout=5000")
        cur.close()
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
    _apply_mini_migrations()


def _apply_mini_migrations() -> None:
    """Additive column migrations for existing databases.

    create_all() only creates missing tables — it never alters existing ones.
    Until the project adopts Alembic, columns added to a shipped table are
    listed here and applied with a plain ADD COLUMN when absent.
    """
    from sqlalchemy import inspect, text

    additions = {
        "tenants": [("cost_cap_mode", "VARCHAR DEFAULT 'block'")],
        "users": [("email", "VARCHAR"), ("password_hash", "VARCHAR")],
    }
    inspector = inspect(engine)
    with engine.begin() as conn:
        for table, columns in additions.items():
            if table not in inspector.get_table_names():
                continue
            existing = {c["name"] for c in inspector.get_columns(table)}
            for name, ddl in columns:
                if name not in existing:
                    conn.execute(text(f"ALTER TABLE {table} ADD COLUMN {name} {ddl}"))
