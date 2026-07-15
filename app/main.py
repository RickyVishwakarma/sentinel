"""Sentinel FastAPI application — the single entrypoint for agent runs."""

from __future__ import annotations

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import __version__
from app.config import get_settings
from app.db import init_db
from app.routers import (
    actions, admin, agents, approvals, audit, auth_router, cost, evals, runs, tenant,
)


@asynccontextmanager
async def lifespan(app: FastAPI):
    init_db()
    # Retention sweep (PRD Q3) — best-effort; a failing span store must not
    # keep the gateway from starting.
    try:
        from app.spans import get_span_store

        get_span_store().purge_expired()
    except Exception:  # noqa: BLE001
        pass
    yield


app = FastAPI(
    title="Sentinel — AI Agent Control Plane",
    version=__version__,
    summary="Deploy, govern, observe, and evaluate LLM agents in production.",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=get_settings().cors_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(agents.router)
app.include_router(approvals.router)
app.include_router(runs.router)
app.include_router(evals.router)
app.include_router(cost.router)
app.include_router(audit.router)
app.include_router(tenant.router)
app.include_router(admin.router)
app.include_router(auth_router.router)
app.include_router(actions.router)


@app.get("/health", tags=["meta"])
def health() -> dict:
    return {"status": "ok", "version": __version__}


@app.get("/v1/providers", tags=["meta"])
def providers() -> dict:
    """Which model providers are live (have a key) vs. running on the template."""
    from app.providers import provider_status

    return {"providers": provider_status()}


@app.get("/", tags=["meta"])
def root() -> dict:
    return {
        "name": "Sentinel",
        "tagline": "An AI Agent Control Plane",
        "docs": "/docs",
        "modules": [
            "agent-registry", "gateway", "guardrails", "observability",
            "eval-harness", "governance", "cost-attribution", "hitl-approvals",
        ],
    }
