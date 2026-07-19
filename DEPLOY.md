# Deploying Sentinel

Two pieces ship separately:

- **Gateway** (FastAPI) → **Render** (Docker + managed Postgres, via `render.yaml`)
- **Dashboard** (Next.js) → **Vercel** (root directory `dashboard/`)

Everything below needs *your* account logins — there's no way to automate the
click-through. Budget ~20 minutes.

---

## 0. Make the repo public (optional but easier)

Free Render/Vercel tiers can read private repos once you authorize GitHub, but
public is simpler and it's a portfolio piece anyway:
**GitHub → repo → Settings → General → Change visibility → Public.**

---

## 1. Gateway → Render

1. Push is already done. Go to **[dashboard.render.com](https://dashboard.render.com)** → **New → Blueprint**.
2. Connect GitHub, pick **`sentinel`**. Render reads [`render.yaml`](render.yaml)
   and provisions the web service + a free Postgres.
3. Set environment variables on the **sentinel-gateway** service:

   | Key | Value |
   |-----|-------|
   | `GEMINI_API_KEY` | your Gemini key |
   | `CLERK_PUBLISHABLE_KEY` | `pk_…` (from Clerk dashboard) |
   | `CLERK_SECRET_KEY` | `sk_…` (from Clerk dashboard) |
   | `CORS_ORIGINS` | `["https://YOUR-APP.vercel.app"]` — fill in after step 2 |
   | `ANTHROPIC_API_KEY` / `OPENAI_API_KEY` | optional (extra providers / eval judge) |

   `DATABASE_URL` is wired automatically by the blueprint. `RATE_LIMIT_PER_MINUTE`
   defaults to 60.
4. Deploy. When it's live, hit **`https://YOUR-GATEWAY.onrender.com/health`** →
   `{"status":"ok"}`. Copy that URL.

> Free tier spins down when idle, so the first request after a pause takes ~30s.

---

## 2. Dashboard → Vercel

1. **[vercel.com/new](https://vercel.com/new)** → import **`sentinel`**.
2. **Root Directory: `dashboard`** (important — the Next app isn't at the repo root).
3. Environment variables:

   | Key | Value |
   |-----|-------|
   | `NEXT_PUBLIC_API_URL` | `https://YOUR-GATEWAY.onrender.com` (from step 1) |
   | `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` | `pk_…` |
   | `CLERK_SECRET_KEY` | `sk_…` |

4. Deploy. Then go **back to Render** and set `CORS_ORIGINS` to your new
   `https://YOUR-APP.vercel.app` so the browser can call the gateway.

---

## 3. Clerk

The dashboard already has Clerk wired in (`@clerk/nextjs`, `proxy.ts`). Two paths:

- **Quick demo:** reuse the **development** Clerk keys. They work, but Clerk shows a
  "development keys" banner and has strict usage limits. Fine for a portfolio link.
- **Proper production:** create a **production instance** (`clerk deploy`, or the
  Clerk dashboard). Production needs a **custom domain** with DNS records, so it
  doesn't apply to a bare `*.vercel.app` URL — use dev keys there, or point a real
  domain at Vercel first.

Either way, rename the app in the Clerk dashboard from **"My Application"** to
**Sentinel** so the sign-in card reads right.

---

## 4. Verify

- `https://YOUR-GATEWAY.onrender.com/docs` — API docs load
- `https://YOUR-APP.vercel.app` — landing page, favicon, stats section
- Sign in → you land on `/overview` with your name/avatar
- Create an agent → send it a message → a trace appears

---

## Environment variables at a glance

**Gateway (Render):** `DATABASE_URL`* · `GEMINI_API_KEY` · `CLERK_PUBLISHABLE_KEY` ·
`CLERK_SECRET_KEY` · `CORS_ORIGINS` · `RATE_LIMIT_PER_MINUTE` ·
`ANTHROPIC_API_KEY`? · `OPENAI_API_KEY`?
*auto-wired by the blueprint. `?` = optional.

**Dashboard (Vercel):** `NEXT_PUBLIC_API_URL` · `NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY` ·
`CLERK_SECRET_KEY`

Secrets live only in the host dashboards — never commit `.env.local` (it's
gitignored).
