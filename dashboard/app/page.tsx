"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

/* Luminous Horizon aesthetic: warm off-white canvas, Plus Jakarta Sans,
   sunset-orange accents, oversized display type, glassy blurred cards. */

const jakarta = { fontFamily: "var(--font-jakarta), system-ui, sans-serif" };

function Check() {
  return (
    <svg className="h-5 w-5 shrink-0 text-[#FF5E3A]" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const FEATURES = [
  {
    n: "01 / 04",
    title: "A policy decision point",
    body: "Before an agent runs a high-risk tool, it asks Sentinel. Declarative per-tool rules — glob match plus a condition on the arguments — return allow, deny, or hold-for-approval. First match by priority wins.",
  },
  {
    n: "02 / 04",
    title: "Human approval, in the loop",
    body: "Actions that cross a line — refund over $100, delete prod, wire a transfer — pause and wait for a person. The agent polls; a human approves or denies; the decision is recorded with who and why.",
  },
  {
    n: "03 / 04",
    title: "A kill switch that actually stops",
    body: "Freeze an agent and every action it attempts is denied instantly — no redeploy, no config push. Unfreeze to resume. The one control you want the moment something looks wrong.",
  },
  {
    n: "04 / 04",
    title: "A full paper trail",
    body: "Every action an agent took — or was stopped from taking — lands in an immutable audit log, alongside per-run traces, guardrails, and cost. Answer 'what did the agent do?' in one place.",
  },
];

export default function Landing() {
  const { session } = useAuth();
  const cta = session ? "/overview" : "/login";
  const ctaLabel = session ? "Open dashboard" : "Sign in";

  return (
    <div style={jakarta} className="min-h-screen bg-[#fff9ee] text-[#1d1c15] antialiased overflow-x-hidden">
      {/* floating glass nav */}
      <nav className="fixed left-1/2 top-4 z-50 flex w-[94%] max-w-6xl -translate-x-1/2 items-center justify-between rounded-full border border-white/60 bg-white/40 px-6 py-3 shadow-[0_8px_32px_rgba(159,65,34,0.06)] backdrop-blur-xl">
        <Link href="/" className="flex items-center gap-2">
          <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#FF5E3A] to-[#FF2A6D] text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-lg font-extrabold tracking-tight">Sentinel</span>
        </Link>
        <div className="hidden items-center gap-7 text-sm font-medium text-[#56423c] md:flex">
          <span className="font-bold text-[#FF5E3A]">Product</span>
          <a href="https://github.com/RickyVishwakarma/sentinel" target="_blank" rel="noreferrer" className="transition-colors hover:text-[#FF5E3A]">Docs</a>
          <a href="https://github.com/RickyVishwakarma/sentinel" target="_blank" rel="noreferrer" className="transition-colors hover:text-[#FF5E3A]">GitHub</a>
        </div>
        <Link
          href={cta}
          className="rounded-full border border-white/60 bg-white/50 px-5 py-2 text-sm font-medium shadow-sm backdrop-blur-md transition-transform hover:bg-white/70 active:scale-95"
        >
          {ctaLabel}
        </Link>
      </nav>

      {/* hero */}
      <section className="relative flex min-h-[92vh] flex-col items-center justify-center overflow-hidden px-6 pb-24 pt-40 text-center">
        <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#38BDF8]/20 via-[#C084FC]/10 to-[#fff9ee]" />
        <div className="absolute left-1/4 top-32 -z-10 h-72 w-72 rounded-full bg-[#FF5E3A]/10 blur-3xl" />
        <div className="absolute right-1/4 top-52 -z-10 h-72 w-72 rounded-full bg-[#C084FC]/10 blur-3xl" />

        <div className="mb-7 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/40 px-4 py-2 shadow-sm backdrop-blur-xl">
          <span className="rounded-full bg-[#d6ed7a] px-2 py-1 text-[10px] font-bold uppercase tracking-[0.1em] text-[#5a6c00]">New</span>
          <span className="text-sm text-[#1d1c15]">Action governance for AI agents</span>
        </div>

        <h1 className="mb-6 max-w-4xl text-5xl font-extrabold leading-[1.05] tracking-[-0.04em] sm:text-6xl md:text-7xl">
          The approval layer for agents that{" "}
          <span className="bg-gradient-to-r from-[#FF5E3A] to-[#FF2A6D] bg-clip-text text-transparent">do things.</span>
        </h1>
        <p className="mb-10 max-w-2xl text-lg leading-relaxed text-[#56423c]">
          Your agent can now spend money, touch prod, and email customers — with no kill-switch
          and no paper trail. Sentinel puts every high-risk tool call through policy: allow, deny,
          or hold for a human.
        </p>

        {/* glassy "decision" card — the product's actual value, styled as the hero object */}
        <div className="w-full max-w-2xl rounded-3xl border border-white/60 bg-white/40 p-6 text-left shadow-[0_8px_32px_rgba(159,65,34,0.08)] backdrop-blur-xl">
          <div className="mb-4 flex items-center gap-2 border-b border-white/50 pb-4">
            <span className="grid h-6 w-6 place-items-center rounded-full bg-[#FF5E3A]/15 text-[#FF5E3A]">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><path d="M4 17l6-6-6-6M12 19h8" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
            </span>
            <span className="text-sm font-semibold">Action check</span>
            <span className="ml-auto font-mono text-xs text-[#89726b]">POST /actions/check</span>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-sm text-[#56423c]">
{`agent → refund(amount: 5000, customer: "acme")`}
          </pre>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <span className="rounded-full border border-[#C084FC]/30 bg-[#C084FC]/15 px-3 py-1 text-xs font-semibold text-[#6b21a8]">
              HELD — policy: refunds over $100
            </span>
            <div className="ml-auto flex gap-2">
              <span className="rounded-full bg-gradient-to-br from-[#FF5E3A] to-[#FF2A6D] px-4 py-1.5 text-xs font-semibold text-white shadow-sm">Approve</span>
              <span className="rounded-full border border-white/60 bg-white/50 px-4 py-1.5 text-xs font-semibold shadow-sm">Deny</span>
            </div>
          </div>
        </div>

        <div className="mt-8 flex flex-wrap items-center justify-center gap-3">
          {["refund", "send_email", "delete_*", "wire_transfer", "deploy"].map((t) => (
            <span key={t} className="rounded-full border border-white/50 bg-white/30 px-4 py-2 font-mono text-sm text-[#1d1c15] shadow-sm backdrop-blur-md">
              {t}
            </span>
          ))}
        </div>
      </section>

      {/* slogan */}
      <section className="flex min-h-[40vh] items-center justify-center bg-[#fff9ee] px-6 py-28">
        <h2 className="max-w-4xl text-center text-4xl font-normal leading-tight tracking-tight text-[#1d1c15] sm:text-5xl">
          Govern what your agents <em className="font-extrabold not-italic text-[#FF5E3A]">do</em> — not just what they say.
        </h2>
      </section>

      {/* feature cards */}
      <section className="mx-auto grid max-w-5xl gap-8 px-6 pb-28 md:grid-cols-2">
        {FEATURES.map((f) => (
          <div
            key={f.n}
            className="rounded-3xl border border-white/60 bg-white/50 p-10 shadow-[0_8px_32px_rgba(159,65,34,0.05)] backdrop-blur-xl transition-transform hover:-translate-y-1"
          >
            <span className="text-xs font-bold uppercase tracking-[0.15em] text-[#89726b]">{f.n}</span>
            <h3 className="mb-4 mt-5 text-2xl font-bold leading-tight tracking-tight">{f.title}</h3>
            <p className="text-[15px] leading-relaxed text-[#56423c]">{f.body}</p>
          </div>
        ))}
      </section>

      {/* on top of a gateway */}
      <section className="relative overflow-hidden bg-[#fff9ee] px-6 py-28">
        <div className="absolute inset-0 -z-10" style={{ backgroundImage: "radial-gradient(#C084FC 1px, transparent 1px)", backgroundSize: "32px 32px", opacity: 0.15 }} />
        <div className="mx-auto max-w-5xl text-center">
          <h2 className="mb-4 text-3xl font-bold tracking-tight sm:text-4xl">…on top of a full AI gateway</h2>
          <p className="mx-auto mb-12 max-w-2xl text-lg text-[#56423c]">
            The decision point sits over everything you already need to run agents in production.
          </p>
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            {[
              ["Traces", "Every run as a span tree, PII-redacted at rest."],
              ["Guardrails", "PII redaction + prompt-injection blocking."],
              ["Cost caps", "Per-tenant spend: block, warn, or degrade."],
              ["Fallback", "Anthropic → OpenAI → Gemini, automatic."],
            ].map(([t, b]) => (
              <div key={t} className="rounded-2xl border border-white/60 bg-white/50 p-6 text-left shadow-sm backdrop-blur-xl">
                <div className="mb-2 flex items-center gap-2">
                  <Check />
                  <span className="font-bold">{t}</span>
                </div>
                <p className="text-sm text-[#56423c]">{b}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* final CTA */}
      <section className="relative flex min-h-[60vh] flex-col items-center justify-center overflow-hidden px-6 py-28 text-center">
        <div className="absolute inset-0 -z-10 opacity-25" style={{ background: "radial-gradient(circle at 15% 25%, #FF5E3A 0%, transparent 45%), radial-gradient(circle at 85% 75%, #C084FC 0%, transparent 45%), radial-gradient(circle at 50% 50%, #38BDF8 0%, transparent 60%)" }} />
        <h2 className="mb-10 max-w-2xl text-4xl font-extrabold leading-tight tracking-[-0.03em] sm:text-5xl">
          Ready to govern your agents?
        </h2>
        <Link
          href={cta}
          className="inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/50 px-9 py-4 text-lg font-medium shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-white/70"
        >
          {ctaLabel}
          <span className="grid h-6 w-6 place-items-center rounded-full bg-gradient-to-br from-[#FF5E3A] to-[#FF2A6D] text-white">
            <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none"><path d="M5 12h14M13 6l6 6-6 6" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" /></svg>
          </span>
        </Link>
      </section>

      <footer className="border-t border-[#ddc0b8]/40 px-6 py-8 text-center text-sm text-[#89726b]">
        Sentinel — action governance for AI agents.
      </footer>
    </div>
  );
}
