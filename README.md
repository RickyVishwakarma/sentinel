# Sentinel — an AI Agent Control Plane

The deploy · govern · observe · evaluate layer that makes LLM agents
production-safe — without replacing the frameworks teams already build on.

Every agent call routes through a policy-enforcing FastAPI gateway that produces
a full trace, applies guardrails, falls back across providers, and attributes
cost — while an eval harness blocks regressions before a prompt change ships.

> This is the **Week-1 runnable slice** of the [PRD](#whats-here-vs-the-full-prd):
> Agent Registry, the Gateway pipeline (routing + fallback + rate-limit), guardrails,
> trace capture, cost attribution, an eval CI gate, and audit/RBAC. It runs with
> **zero external services** and no API keys.

---

## Quickstart (no API keys, no Docker)

```bash
python -m venv .venv && . .venv/Scripts/activate   # Windows
#   source .venv/bin/activate                       # macOS / Linux
pip install -r requirements.txt

python -m app.seed                                  # creates demo tenant + admin login
uvicorn app.main:app --reload                       # http://localhost:8000/docs
```

Then start the dashboard and sign in:

```bash
cd dashboard && npm install && npm run dev          # http://localhost:3000
# sign in:  admin@sentinel.dev  /  sentinel123
```

No agents are pre-created — register your own from the **Agents** page, then send
it a message from the playground. Humans log in with email/password; the API key
(`sentinel-demo-key`) remains the machine-to-machine credential for curl.

With no `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` / `GEMINI_API_KEY` set, the gateway
runs entirely on a **deterministic template provider**, so the full pipeline —
guardrails, traces, cost, evals — works out of the box. Add a key to `.env` and
the fallback chain will prefer the real provider automatically.

### Run an agent

```bash
curl -s -X POST localhost:8000/v1/agents/<AGENT_ID>/run \
  -H "Authorization: Bearer sentinel-demo-key" \
  -H "Content-Type: application/json" \
  -d '{"input": "How do I reset my password?"}'
```

Response includes the output, the serving `provider`, `total_tokens`, `cost`, and
a `trace_id`. Open the trace:

```bash
curl -s localhost:8000/v1/traces/<TRACE_ID> \
  -H "Authorization: Bearer sentinel-demo-key"
```

---

## The gateway pipeline

Every run flows through one fixed pipeline ([`app/gateway.py`](app/gateway.py)):

```
auth → rate-limit → cost-cap → load agent version → guardrails(pre)
  → LLM call + provider fallback → guardrails(post) → cost calc → emit trace
```

- **Guardrails (pre):** PII redaction, prompt-injection / jailbreak detection, tool allow-list.
- **Guardrails (post):** secret-leak blocklist, optional JSON-schema check.
- **Fallback:** tries the agent's `fallback_chain` (e.g. `anthropic → openai → gemini`),
  skipping unconfigured providers and erroring providers, and **always** ends on the
  template provider — so "kill the primary, the run still succeeds" holds.
- **Trace writes are async of the response** — spans are buffered and flushed after
  the call returns, never blocking it.

## API surface

| Method | Path | Purpose |
|---|---|---|
| POST | `/v1/agents` | Create an agent (v1) |
| GET  | `/v1/agents` | List agents |
| POST | `/v1/agents/{id}/versions` | New immutable version |
| POST | `/v1/agents/{id}/run` | Run — returns output + `trace_id` |
| POST | `/v1/agents/{id}/run/stream` | Streaming run (SSE): `meta → provider → delta* → [blocked] → done` |
| GET  | `/v1/runs/{id}` | Run + full trace tree |
| GET  | `/v1/traces/{trace_id}` | Trace by id |
| POST | `/v1/evals/run` | Run an eval set (used by CI) |
| GET  | `/v1/approvals` | HITL queue (flagged runs holding output) |
| POST | `/v1/approvals/{id}/decide` | Approve / deny a held run (admin) |
| GET  | `/v1/cost?from=&to=` | Cost per agent for the tenant |
| GET  | `/v1/audit` | Audit log |

Auth is `Authorization: Bearer <api_key>`; RBAC roles are `admin | dev | viewer`.
Every relational row carries a `tenant_id`, enforced from the API key (never the
query string).

## Eval CI gate

```bash
python -m cli.eval_runner \
  --url http://localhost:8000 \
  --api-key sentinel-demo-key \
  --agent-id <AGENT_ID> \
  --file evals/support-bot.json
```

Scores `answer_relevance`, `faithfulness`, and `guardrail_pass_rate`; exits
non-zero if any metric drops below the baseline. Wired into
[`.github/workflows/eval-gate.yml`](.github/workflows/eval-gate.yml) so a prompt
change that regresses fails the build.

## Dashboard

A Next.js console over the gateway — run list with metrics, expandable trace
tree per run, an agents playground (fire runs from the browser), cost
attribution with cap usage, and the audit log.

```bash
cd dashboard
npm install
npm run dev        # http://localhost:3000 (gateway URL + API key configurable in the top bar)
```

## Tests

```bash
pytest -q
```

## Production-shaped infra (optional)

The default backends are SQLite + in-memory span store + in-memory rate limiter.
To exercise the PRD's three-store architecture:

```bash
docker compose up -d      # host ports 5433 (pg) / 27017 (mongo) / 6380 (redis)
export DATABASE_URL=postgresql+psycopg://sentinel:sentinel@localhost:5433/sentinel
export SPAN_STORE=mongo   MONGO_URL=mongodb://localhost:27017
export RATE_LIMITER=redis REDIS_URL=redis://localhost:6380/0
# pip install "psycopg[binary]" pymongo redis
```

Verified end-to-end: runs land in Postgres, spans are served from Mongo, and
the per-tenant rate-limit window lives in Redis.

Each swap is a config change — no code changes. See [`.env.example`](.env.example).

## What's here vs. the full PRD

**Built (Weeks 1–3):** Agent Registry with immutable versioning · Gateway
(routing, provider fallback, rate-limit, cost-cap) · Guardrails (pre + post) ·
Observability (spans + trace tree) · Eval harness + CI gate (+ LLM-judge metric
when an Anthropic key is set) · Governance (RBAC + audit log + HITL approval
queue) · Cost attribution · Next.js dashboard (runs, trace view, playground,
approvals, cost, audit) · Load test (`python -m scripts.load_test` — gateway
overhead p95 ≈ 24 ms vs the < 50 ms PRD target, concurrency 20, SQLite/WAL).

## PRD open questions — answers implemented

**Q2 — cost cap hit mid-month.** The policy belongs to the **tenant admin**
(`PATCH /v1/tenant`, admin role): `cost_cap_mode` is `block` (402 on every
further run — default), `warn` (runs proceed; every response and the audit log
carry a `cost_cap` warning), or `degrade` (runs proceed on the free template
provider only). Every mode writes an audit entry.

**Q3 — trace retention & PII at rest.** Span inputs/outputs are PII-redacted
**before persistence** (`REDACT_SPANS_AT_REST`, on by default — the live
response is unaffected; only the stored copy is scrubbed). Spans older than
`TRACE_RETENTION_DAYS` (default 30) are deleted by a startup sweep and by
`POST /v1/admin/traces/purge`; runs are kept as billing records.

**Q4 — path to enterprise readiness.** Not a v1 code problem; the sequencing
is: (1) SSO/OIDC in front of the existing RBAC — API keys stay for
machine-to-machine, humans get SSO via the dashboard; (2) SOC 2 — the audit
log, retention policy, and RBAC built here are the control evidence, so the
work is process + an auditor, not architecture; (3) multi-region — the gateway
is stateless (Postgres/Mongo/Redis hold all state), so region expansion is a
deployment topology change (regional gateway + read replicas) rather than a
rewrite. Becomes gating at the first enterprise design partner, not before.

## Streaming and guardrails (PRD open question Q1)

`POST /v1/agents/{id}/run/stream` answers Q1 like this:

- **Pre-call guardrails run before any token is emitted** — a blocked input
  returns a plain JSON block response; no stream opens.
- **Post-call guardrails run incrementally** over the accumulated output while
  the last 96 chars are withheld from emission. When a leak pattern completes,
  the stream is cut and the withheld tail is never sent. This is best-effort by
  construction (a pattern longer than the hold window can partially escape), so
  the full post-pass is still recorded on the trace and audit log with
  `chars_emitted` for exposure accounting.
- **HITL and streaming don't compose** — you can't un-send tokens — so agents
  with `hitl_approval` get a 409 on the stream endpoint and must use the
  buffered endpoint.

## HITL approval queue

Flag-level guardrail hits (e.g. PII redaction) on an agent with the
`hitl_approval` guardrail enabled complete the LLM call but **withhold the
output**: the run returns `status: pending_approval` plus an `approval_id`, and
the output sits in the queue until an admin approves (run becomes `ok`, output
released) or denies it. Decide from the dashboard's **Approvals** page or via
`POST /v1/approvals/{id}/decide`.

## Layout

```
app/
  main.py            FastAPI app + router wiring
  gateway.py         the request pipeline
  config.py db.py    settings + SQLAlchemy
  models.py          tenant, user, agent, agent_version, run, span, audit, eval_result
  auth.py            API-key auth + RBAC
  cost.py            token → USD pricing
  ratelimit.py       in-memory / Redis limiter
  spans.py           SQL / Mongo span store
  guardrails/        pre.py, post.py
  providers/         anthropic, openai, gemini, template, fallback pipeline
  evals.py           eval harness
  routers/           agents, runs, evals, cost, audit
cli/eval_runner.py   CI regression gate
tests/               guardrail unit tests + gateway E2E
dashboard/           Next.js console: runs, trace tree, playground, cost, audit
```
