"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  ["Policy gateway", "Every agent call routes through one auth’d pipeline — rate-limit, cost-cap, guardrails, fallback."],
  ["Guardrails", "PII redaction, prompt-injection detection, and output leak-blocking, pre- and post-call."],
  ["Full traces", "Every run is a span tree: prompt → guardrails → LLM → cost. PII-redacted at rest."],
  ["Provider fallback", "Anthropic → OpenAI → Gemini → template. Kill the primary; the run still succeeds."],
  ["Cost attribution", "Per-tenant, per-agent spend with a monthly cap: block, warn, or degrade."],
  ["Eval CI gate", "Score faithfulness, relevance, guardrail-pass-rate; block prompt regressions before they ship."],
];

export default function Landing() {
  const { session } = useAuth();
  const cta = session ? "/overview" : "/login";
  const ctaLabel = session ? "Open dashboard" : "Sign in";

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-sky-400" />
          <span className="text-sm font-semibold tracking-wide text-zinc-100">SENTINEL</span>
        </div>
        <Link
          href={cta}
          className="rounded border border-zinc-700 px-4 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900"
        >
          {ctaLabel}
        </Link>
      </header>

      <section className="mx-auto max-w-4xl px-6 pb-16 pt-16 text-center sm:pt-24">
        <div className="mb-5 inline-block rounded-full border border-sky-500/30 bg-sky-500/10 px-3 py-1 text-xs text-sky-400">
          AI Agent Control Plane
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
          Run LLM agents in production —{" "}
          <span className="text-sky-400">safely.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
          Sentinel is the deploy · govern · observe · evaluate layer that sits{" "}
          <em>above</em> your agent framework. Every call is policy-enforced, fully
          traced, cost-attributed, and guarded — without replacing what you already build on.
        </p>
        <div className="mt-8 flex justify-center gap-3">
          <Link
            href={cta}
            className="rounded-lg bg-sky-500 px-6 py-2.5 text-sm font-medium text-zinc-950 hover:bg-sky-400"
          >
            {ctaLabel} →
          </Link>
          <a
            href="https://github.com/RickyVishwakarma/sentinel"
            target="_blank"
            rel="noreferrer"
            className="rounded-lg border border-zinc-700 px-6 py-2.5 text-sm text-zinc-300 hover:bg-zinc-900"
          >
            View source
          </a>
        </div>
      </section>

      <section className="mx-auto max-w-6xl px-6 pb-24">
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {FEATURES.map(([title, body]) => (
            <div
              key={title}
              className="rounded-xl border border-zinc-800 bg-zinc-900/40 p-5"
            >
              <h3 className="text-sm font-semibold text-zinc-100">{title}</h3>
              <p className="mt-2 text-sm text-zinc-400">{body}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 overflow-x-auto rounded-xl border border-zinc-800 bg-zinc-950 p-5">
          <div className="mb-2 text-[11px] uppercase tracking-widest text-zinc-500">
            The request path
          </div>
          <pre className="font-mono text-xs leading-relaxed text-zinc-400">
{`auth → rate-limit → cost-cap → load agent version → guardrails(pre)
  → LLM call + provider fallback → guardrails(post) → cost calc → trace`}
          </pre>
        </div>
      </section>

      <footer className="border-t border-zinc-900 px-6 py-6 text-center text-xs text-zinc-600">
        Sentinel — AI Agent Control Plane
      </footer>
    </div>
  );
}
