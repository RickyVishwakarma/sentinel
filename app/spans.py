"""Span store — OpenTelemetry-style spans captured per run.

The interface has two backends:
  * SqlSpanStore   (default) — writes to the ``spans`` table via SQLAlchemy.
  * MongoSpanStore          — writes to a Mongo collection (SPAN_STORE=mongo).

The PRD puts high-volume spans in Mongo; SQL is the zero-infra default so a
fresh clone produces queryable traces immediately. Trace writes are best-effort
and must never block the response — callers buffer spans and flush after the
LLM call returns.
"""

from __future__ import annotations

from dataclasses import asdict, dataclass, field

from app.config import get_settings


@dataclass
class SpanRecord:
    trace_id: str
    type: str
    name: str = ""
    seq: int = 0
    parent_id: str | None = None
    input: str = ""
    output: str = ""
    tokens: int = 0
    latency_ms: int = 0
    cost: float = 0.0
    meta: dict = field(default_factory=dict)


class SpanStore:
    def write(self, spans: list[SpanRecord]) -> None:  # pragma: no cover - interface
        raise NotImplementedError

    def by_trace(self, trace_id: str) -> list[dict]:  # pragma: no cover - interface
        raise NotImplementedError


class SqlSpanStore(SpanStore):
    def write(self, spans: list[SpanRecord]) -> None:
        from app.db import SessionLocal
        from app.models import Span

        db = SessionLocal()
        try:
            db.add_all([Span(**asdict(s)) for s in spans])
            db.commit()
        finally:
            db.close()

    def by_trace(self, trace_id: str) -> list[dict]:
        from app.db import SessionLocal
        from app.models import Span

        db = SessionLocal()
        try:
            rows = (
                db.query(Span)
                .filter(Span.trace_id == trace_id)
                .order_by(Span.seq)
                .all()
            )
            return [
                {
                    "id": r.id,
                    "trace_id": r.trace_id,
                    "parent_id": r.parent_id,
                    "seq": r.seq,
                    "type": r.type,
                    "name": r.name,
                    "input": r.input,
                    "output": r.output,
                    "tokens": r.tokens,
                    "latency_ms": r.latency_ms,
                    "cost": r.cost,
                    "meta": r.meta,
                    "ts": r.ts.isoformat() if r.ts else None,
                }
                for r in rows
            ]
        finally:
            db.close()


class MongoSpanStore(SpanStore):
    def __init__(self) -> None:
        from pymongo import MongoClient  # imported lazily so it's an optional dep

        s = get_settings()
        self._col = MongoClient(s.mongo_url)[s.mongo_db]["spans"]
        self._col.create_index("trace_id")

    def write(self, spans: list[SpanRecord]) -> None:
        if spans:
            self._col.insert_many([asdict(s) for s in spans])

    def by_trace(self, trace_id: str) -> list[dict]:
        rows = self._col.find({"trace_id": trace_id}, {"_id": 0}).sort("seq", 1)
        return list(rows)


def get_span_store() -> SpanStore:
    if get_settings().span_store == "mongo":
        return MongoSpanStore()
    return SqlSpanStore()
