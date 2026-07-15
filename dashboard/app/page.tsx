"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

const FEATURES = [
  ["Policy decision point", "Before an agent runs a high-risk tool, it asks Sentinel: allow, deny, or hold for a human."],
  ["Human approval queue", "Risky actions — spend money, touch prod, email a customer — wait for a person to sign off."],
  ["Kill switch", "Freeze an agent instantly and every action it attempts is denied, no redeploy."],
  ["Full audit trail", "Every action an agent took — or was stopped from taking — is recorded, with who decided."],
  ["Guardrails + traces", "PII redaction, prompt-injection blocking, and a per-run span tree, on top of the action layer."],
  ["Cost + fallback", "Per-tenant spend caps and provider fallback (Anthropic → OpenAI → Gemini) come built in."],
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
          Action governance for AI agents
        </div>
        <h1 className="text-4xl font-bold tracking-tight text-zinc-50 sm:text-5xl">
          The approval layer for agents that{" "}
          <span className="text-sky-400">do things.</span>
        </h1>
        <p className="mx-auto mt-5 max-w-2xl text-lg text-zinc-400">
          Your agent can now spend money, touch prod, and email customers — with no
          kill-switch and no paper trail. Sentinel puts every high-risk tool call through
          policy: <span className="text-zinc-200">allow</span>,{" "}
          <span className="text-zinc-200">deny</span>, or{" "}
          <span className="text-zinc-200">hold for a human</span> — all audited.
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
            The decision point
          </div>
          <pre className="font-mono text-xs leading-relaxed text-zinc-400">
{`agent: "I want to call refund(amount=5000)"
  → Sentinel evaluates your policies
  → refund over $100 requires approval → HELD
  → a human approves or denies → audited → the agent proceeds (or doesn't)`}
          </pre>
        </div>
      </section>

      <footer className="border-t border-zinc-900 px-6 py-6 text-center text-xs text-zinc-600">
        Sentinel — AI Agent Control Plane
      </footer>
    </div>
  );
}
