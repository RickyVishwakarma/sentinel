<p align="center">
  <img src="docs/banner.svg" alt="Sentinel — the approval layer for AI agents that take action" width="100%" />
</p>

<p align="center">
  <img src="https://img.shields.io/badge/tests-38%20passing-17c964" alt="tests" />
  <img src="https://img.shields.io/badge/python-3.12-3776AB" alt="python" />
  <img src="https://img.shields.io/badge/FastAPI-009688" alt="fastapi" />
  <img src="https://img.shields.io/badge/Next.js-16-0A0A0A" alt="next.js" />
  <img src="https://img.shields.io/badge/status-MVP-6b6b6b" alt="status" />
</p>

# Sentinel

**The approval layer for AI agents that *do things*.**

An agent can now spend money, delete records, and email customers. Sentinel puts
every high-risk tool call through policy **before it runs** — **allow**, **deny**,
or **hold for a human** — and writes it all to an audit log.

```
agent → refund(amount = 5000)
      → Sentinel checks your policies
      → "refunds over $100 need a human"  →  HELD
      → a person approves or denies       →  audited  →  the agent proceeds (or doesn't)
```

---

## How it works

```mermaid
flowchart LR
    A["🤖 Agent wants<br/>to run a tool"] --> B{Policy check}
    B -->|no rule matched| C["✅ ALLOW<br/>runs"]
    B -->|deny rule| D["⛔ DENY<br/>blocked"]
    B -->|needs approval| E["⏸️ HOLD<br/>waits for a human"]
    E -->|approve| C
    E -->|deny| D
    C --> F[("📋 Audit log")]
    D --> F
    E --> F
```

Policies are declarative — a tool glob plus an optional condition on the call's
arguments — evaluated by priority, first match wins:

```json
{ "tool": "delete_*", "effect": "deny", "priority": 10 }
{ "tool": "refund", "priority": 20,
  "condition": { "field": "amount", "op": "gt", "value": 100 },
  "effect": "require_approval" }
```

A **kill switch** freezes an agent so every action it attempts is denied instantly.

---

## See it work (30 seconds)

One command runs a **real Gemini agent** through all three verdicts:

```bash
python -m examples.governed_agent --auto-approve
```

```
[1/3] Where is order 1234?
  agent decided: check_order_status(order_id='1234')
  sentinel:      ALLOW — no policy matched
  executed:      Order 1234 shipped — arriving Tuesday.

[2/3] Customer 88 asked to be forgotten. Remove their record.
  agent decided: delete_customer(customer_id='88')
  sentinel:      DENY — never delete anything
  not executed.

[3/3] Acme was double-charged $5000. Make them whole.
  agent decided: refund(amount=5000, customer='Acme')
  sentinel:      HELD — big refunds need a human
  human:         APPROVED
  executed:      Refunded $5000 to Acme.
```

Drop `--auto-approve` and the refund waits for you in the dashboard's **Approvals**
page. [`examples/governed_agent.py`](examples/governed_agent.py) is plain HTTP and
imports nothing from the app — it's exactly how *your* agent wires in.

---

## Quickstart

**1. Backend + demo** (no API keys, no Docker needed):

```bash
python -m venv .venv && source .venv/Scripts/activate   # Windows
#   source .venv/bin/activate                            # macOS / Linux
pip install -r requirements.txt

python -m app.seed              # demo tenant + API key: sentinel-demo-key
uvicorn app.main:app --reload   # http://localhost:8000/docs
```

With no `GEMINI_API_KEY` / `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` set, the gateway
runs on a **deterministic template provider** — the whole pipeline works out of the
box. Add a key to `.env` and the fallback chain prefers the real model automatically.

**2. Dashboard**:

```bash
cd dashboard && npm install && npm run dev   # http://localhost:3000
```

Humans sign in with **Clerk** (Google / GitHub / email). Machines keep using the
API key. *(A fresh clone needs your own Clerk keys in `dashboard/.env.local` — run
`clerk init` or add them by hand.)*

---

## What's inside

| | |
|---|---|
| 🎯 **Action governance** | Policy decision point · approval queue · kill switch · audit log |
| 🚪 **AI gateway** | One entrypoint for every agent run |
| 🛡️ **Guardrails** | PII redaction · prompt-injection blocking · secret-leak blocking |
| 🔀 **Provider fallback** | Anthropic → OpenAI → Gemini → template (kill the primary, run still completes) |
| 📊 **Observability** | Full trace tree per run, PII-redacted at rest, 30-day retention |
| 💸 **Cost attribution** | Per-tenant / per-agent spend + monthly caps (block / warn / degrade) |
| ✅ **Eval CI gate** | Score prompts; block regressions before they ship |
| 🌊 **Streaming** | SSE with incremental guardrails |
| 👥 **Multi-tenant** | RBAC (`admin` / `dev` / `viewer`) + row-level isolation |

---

## API surface

| Method | Path | Purpose |
|---|---|---|
| `POST` | `/v1/agents/{id}/actions/check` | **The decision point** → `allow` / `deny` / `pending` |
| `GET`  | `/v1/actions/{id}` | Poll a held action until decided |
| `GET/POST/DELETE` | `/v1/policies` | Manage per-tool rules |
| `POST` | `/v1/agents/{id}/freeze` · `/unfreeze` | Kill switch |
| `POST` | `/v1/agents/{id}/run` · `/run/stream` | Run an agent (buffered or SSE) |
| `GET`  | `/v1/runs/{id}` · `/v1/traces/{trace_id}` | Trace tree |
| `GET`  | `/v1/approvals` · `POST /decide` | Human-in-the-loop queue |
| `POST` | `/v1/evals/run` | Eval set (used by CI) |
| `GET`  | `/v1/cost` · `/v1/audit` | Cost + audit log |

Full interactive docs at **`/docs`**. Auth: `Authorization: Bearer <api_key>`.

---

## The dashboard

A Next.js console over the gateway: **Overview · Runs · Agents** (with a live
streaming playground) **· Policies · Approvals · Evals · Cost · Audit** — plus a
black-and-white marketing site (landing, product, pricing, FAQ, contact).

<!-- Add screenshots to docs/screenshots/ and they'll show here (see that folder's README) -->

| Landing | Dashboard |
|---|---|
| ![Landing](docs/screenshots/landing.png) | ![Dashboard](docs/screenshots/dashboard.png) |
| **Trace tree** | **Approvals** |
| ![Trace](docs/screenshots/trace.png) | ![Approvals](docs/screenshots/approvals.png) |

---

## Testing

```bash
pytest -q                                   # 38 tests

python -m cli.eval_runner \                 # the CI gate — exits non-zero on regression
  --url http://localhost:8000 --api-key sentinel-demo-key \
  --agent-id <AGENT_ID> --file evals/support-bot.json
```

<details>
<summary><b>Production infra (optional)</b> — swap SQLite for Postgres + Mongo + Redis</summary>

```bash
docker compose up -d      # host ports 5433 (pg) / 27017 (mongo) / 6380 (redis)
export DATABASE_URL=postgresql+psycopg://sentinel:sentinel@localhost:5433/sentinel
export SPAN_STORE=mongo   MONGO_URL=mongodb://localhost:27017
export RATE_LIMITER=redis REDIS_URL=redis://localhost:6380/0
pip install "psycopg[binary]" pymongo redis
```

Each swap is a config change — no code changes. Verified end-to-end: runs land in
Postgres, spans served from Mongo, rate-limit window in Redis.
</details>

<details>
<summary><b>Architecture</b></summary>

```mermaid
flowchart TB
    subgraph client [Your agent]
      T[thinking] & X[actions]
    end
    T -->|/run| GW[Gateway pipeline]
    X -->|/actions/check| PDP[Policy decision point]
    GW --> G[Guardrails] --> P[Anthropic → OpenAI → Gemini → template]
    PDP --> POL[(Policies)]
    PDP --> Q[Approval queue]
    GW --> TR[(Traces)]
    GW & PDP --> AU[(Audit log)]
```

Every run flows through one fixed pipeline
([`app/gateway.py`](app/gateway.py)):
`auth → rate-limit → cost-cap → guardrails(pre) → LLM + fallback → guardrails(post) → cost → trace`.
Trace writes are async of the response, so persistence never blocks a call.
</details>

<details>
<summary><b>Project layout</b></summary>

```
app/
  gateway.py         the request pipeline          policy.py     the rules engine
  models.py          tenants · agents · runs …      clerk.py      Clerk session verify
  guardrails/        pre.py, post.py                providers/    anthropic/openai/gemini/template
  routers/           agents, actions, approvals, runs, evals, cost, audit, tenant, auth …
cli/eval_runner.py   CI regression gate            examples/governed_agent.py   the demo
scripts/load_test.py load test                     tests/        38 tests
dashboard/           Next.js console + marketing site
```
</details>

---

## Status & honesty

Sentinel is an **early, open-source MVP** — a real, working system, not a hardened
product. What that means: 38 tests pass and the full flow works against live Gemini,
but the guardrails are regex heuristics (not ML), there are no production users, and
it isn't deployed to a public URL yet (`render.yaml` is ready). The numbers in the
app describe what the control plane guarantees *by design*, not traction.

**License:** MIT recommended (add a `LICENSE` file).
