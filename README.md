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

python -m app.seed                                  # creates demo tenant + agent, prints API key
uvicorn app.main:app --reload                       # http://localhost:8000/docs
```

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
| GET  | `/v1/runs/{id}` | Run + full trace tree |
| GET  | `/v1/traces/{trace_id}` | Trace by id |
| POST | `/v1/evals/run` | Run an eval set (used by CI) |
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
docker compose up -d
export DATABASE_URL=postgresql+psycopg://sentinel:sentinel@localhost:5432/sentinel
export SPAN_STORE=mongo   MONGO_URL=mongodb://localhost:27017
export RATE_LIMITER=redis REDIS_URL=redis://localhost:6379/0
# pip install "psycopg[binary]" pymongo redis
```

Each swap is a config change — no code changes. See [`.env.example`](.env.example).

## What's here vs. the full PRD

**Built (Weeks 1–2):** Agent Registry with immutable versioning · Gateway
(routing, provider fallback, rate-limit, cost-cap) · Guardrails (pre + post) ·
Observability (spans + trace tree) · Eval harness + CI gate · Governance (RBAC +
audit log) · Cost attribution · Next.js dashboard (runs, trace view, playground,
cost, audit).

**Deliberately later (Week 3):** human-in-the-loop approval queue, LLM-judge
eval metric, streaming responses, load test, and the Postgres/Mongo/Redis
deployment (drop-in via env today). See open questions Q1–Q4 in the PRD.

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
