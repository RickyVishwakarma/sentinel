"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";

/* Faithful port of the "Luminous Horizon" reference: warm airy glassmorphism,
   Plus Jakarta Sans, sunset-orange accents. Structure mirrors the reference
   section-for-section; copy is Sentinel's (action governance). */

const font = { fontFamily: "var(--font-jakarta), system-ui, sans-serif" } as const;

const ON = "#1d1c15"; // on-surface
const VAR = "#56423c"; // on-surface-variant
const PRIMARY = "#FF5E3A";

function I({ d, cls = "" }: { d: string; cls?: string }) {
  return (
    <svg className={cls} viewBox="0 0 24 24" fill="none" width="20" height="20">
      <path d={d} stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
const CHECK = "M20 6L9 17l-5-5";
const ARROW_UP = "M12 19V5M5 12l7-7 7 7";
const ARROW_R = "M5 12h14M13 6l6 6-6 6";
const ADD = "M12 5v14M5 12h14";

export default function Landing() {
  const { session } = useAuth();
  const cta = session ? "/overview" : "/login";
  const ctaLabel = session ? "Open dashboard" : "Start governing";

  const glass =
    "bg-white/40 backdrop-blur-xl border border-white/60 shadow-[0_8px_32px_rgba(0,0,0,0.04)]";

  return (
    <div style={font} className="min-h-screen w-full overflow-x-hidden bg-white" >
      {/* ── Nav ── */}
      <nav className={`fixed top-6 left-1/2 z-50 flex w-[95%] max-w-7xl -translate-x-1/2 items-center justify-between rounded-full px-8 py-3 ${glass}`}>
        <Link href="/" className="flex items-center gap-2 text-2xl font-extrabold tracking-tight" style={{ color: PRIMARY }}>
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#FF5E3A] to-[#FF2A6D] text-white">
            <I d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" cls="h-4 w-4" />
          </span>
          Sentinel
        </Link>
        <div className="hidden items-center gap-6 md:flex" style={{ color: VAR }}>
          <span className="text-base font-bold" style={{ color: PRIMARY }}>Product</span>
          <a className="text-base font-medium transition-colors hover:text-[#FF5E3A]" href="https://github.com/RickyVishwakarma/sentinel" target="_blank" rel="noreferrer">Use cases</a>
          <a className="text-base font-medium transition-colors hover:text-[#FF5E3A]" href="https://github.com/RickyVishwakarma/sentinel" target="_blank" rel="noreferrer">Docs</a>
          <a className="text-base font-medium transition-colors hover:text-[#FF5E3A]" href="https://github.com/RickyVishwakarma/sentinel" target="_blank" rel="noreferrer">Pricing</a>
          <a className="text-base font-medium transition-colors hover:text-[#FF5E3A]" href="https://github.com/RickyVishwakarma/sentinel" target="_blank" rel="noreferrer">Enterprise</a>
        </div>
        <Link href={cta} className="rounded-full border border-white/60 bg-white/40 px-6 py-2 text-base font-medium shadow-sm backdrop-blur-md transition-transform hover:bg-white/60 active:scale-95" style={{ color: ON }}>
          {session ? "Dashboard" : "Sign in"}
        </Link>
      </nav>

      <main className="mx-auto w-full max-w-[1728px]">
        {/* ── Hero ── */}
        <section className="relative flex min-h-[90vh] flex-col items-center justify-center overflow-hidden px-16 pb-[120px] pt-48 text-center">
          <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#38BDF8]/20 via-[#C084FC]/10 to-white" />
          <div className="mb-8 inline-flex items-center gap-2 rounded-full border border-white/60 bg-white/40 px-4 py-2 shadow-sm backdrop-blur-xl">
            <span className="rounded-full bg-[#d6ed7a] px-2 py-1 text-[12px] font-bold uppercase leading-none tracking-[0.1em] text-[#5a6c00]">New</span>
            <span className="text-base" style={{ color: ON }}>Action governance for AI agents</span>
          </div>
          <h1 className="mb-6 max-w-4xl text-[64px] font-extrabold leading-[1.1] tracking-[-0.04em]" style={{ color: ON }}>
            Govern agents that take action
          </h1>
          <p className="mb-12 max-w-2xl text-[18px] leading-[1.6]" style={{ color: VAR }}>
            Sentinel puts every high-risk tool call an agent makes through policy — allow, deny, or hold
            for a human. A warm, minimal control plane for running AI agents safely in production.
          </p>

          {/* prompt-style hero card → an action check */}
          <div className={`mb-8 w-full max-w-[870px] rounded-3xl p-6 ${glass}`}>
            <div className="flex flex-col gap-4 text-left">
              <div className="min-h-[80px] font-mono text-[18px] leading-[1.6]" style={{ color: ON }}>
                <span style={{ color: "#89726b" }}>agent</span> wants to call{" "}
                <span style={{ color: PRIMARY }}>refund</span>
                (amount: 5000, customer: &quot;acme&quot;)
              </div>
              <div className="flex items-center justify-between border-t border-white/40 pt-4">
                <div className="flex items-center gap-3">
                  <button className="rounded-full p-2 transition-colors hover:bg-white/50" style={{ color: VAR }}>
                    <I d={ADD} />
                  </button>
                  <div className="flex cursor-pointer items-center gap-2 rounded-full border border-white/60 bg-white/50 px-4 py-2 shadow-sm">
                    <span className="text-base" style={{ color: VAR }}>Policy: refunds &gt; $100</span>
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <span className="rounded-full border border-[#C084FC]/40 bg-[#C084FC]/15 px-3 py-1.5 text-sm font-semibold text-[#6b21a8]">HELD</span>
                  <button className="flex h-12 w-12 items-center justify-center rounded-full border border-white/60 bg-white/50 shadow-sm transition-colors hover:bg-white/70 active:scale-95" style={{ color: ON }}>
                    <I d={ARROW_UP} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            {["refund", "send_email", "delete_*", "wire_transfer"].map((t) => (
              <button key={t} className="rounded-full border border-white/50 bg-white/30 px-5 py-2 font-mono text-base shadow-sm backdrop-blur-md transition-colors hover:bg-white/50" style={{ color: ON }}>{t}</button>
            ))}
          </div>
        </section>

        {/* ── Slogan ── */}
        <section className="relative flex min-h-[810px] items-center justify-center bg-white px-16 py-[120px]">
          <h2 className="max-w-5xl text-center text-[62px] font-normal leading-[1.2] tracking-tight" style={{ color: ON }}>
            Govern what your agents do — not just what they say.
          </h2>
        </section>

        {/* ── Feature 01 ── */}
        <section className="relative px-16 pb-0 pt-[120px]">
          <div className={`mx-auto flex min-h-[596px] max-w-[1118px] flex-col overflow-hidden rounded-[10px] md:flex-row ${glass}`}>
            <div className="flex flex-1 flex-col justify-center p-10">
              <span className="mb-6 text-[12px] font-bold uppercase tracking-[0.15em]" style={{ color: VAR }}>01 / 04</span>
              <h3 className="mb-6 text-[32px] font-bold leading-tight" style={{ color: ON }}>Ask before acting</h3>
              <p className="mb-10 max-w-md text-[18px] leading-[1.6]" style={{ color: VAR }}>
                Before an agent runs a high-risk tool, it asks Sentinel. Declarative per-tool rules — a glob
                match plus a condition on the arguments — return allow, deny, or hold-for-approval. First
                match by priority wins.
              </p>
              <Link href={cta} className="w-fit rounded-[8px] border border-white/60 bg-white/40 px-8 py-4 text-base font-medium shadow-sm backdrop-blur-md transition-colors hover:bg-white/60" style={{ color: ON }}>Read the docs</Link>
            </div>
            <div className="relative flex flex-1 items-center justify-end overflow-hidden border-l border-white/40 bg-white/20">
              <div className="absolute right-[-10%] w-[120%] translate-y-[5%] rounded-l-[10px] border border-white/60 bg-white/40 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl">
                <div className="mb-4 flex items-center justify-between border-b border-white/40 pb-4">
                  <span className="text-[24px] font-semibold" style={{ color: ON }}>Action queue</span>
                  <div className="flex gap-2">
                    <div className="h-3 w-3 rounded-full bg-black/10" />
                    <div className="h-3 w-3 rounded-full bg-black/10" />
                    <div className="h-3 w-3 rounded-full bg-black/10" />
                  </div>
                </div>
                <div className="grid grid-cols-3 gap-4">
                  <div className="rounded-[8px] border border-white/60 bg-white/50 p-4 shadow-sm">
                    <div className="mb-4 h-2 w-16 rounded bg-black/10" />
                    <div className="mb-2 h-16 rounded bg-white/60" />
                    <div className="h-16 rounded bg-white/60" />
                  </div>
                  <div className="rounded-[8px] border border-white/60 bg-white/50 p-4 shadow-sm">
                    <div className="mb-4 h-2 w-16 rounded bg-black/10" />
                    <div className="mb-2 h-16 rounded bg-white/60" />
                  </div>
                  <div className="rounded-[8px] border border-white/60 bg-white/50 p-4 shadow-sm">
                    <div className="mb-4 h-2 w-16 rounded bg-black/10" />
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Feature 02 ── */}
        <section className="relative px-16 pb-[120px] pt-10">
          <div className={`mx-auto flex min-h-[596px] max-w-[1118px] flex-col overflow-hidden rounded-[10px] md:flex-row ${glass}`}>
            <div className="flex flex-1 flex-col justify-center p-10">
              <span className="mb-6 text-[12px] font-bold uppercase tracking-[0.15em]" style={{ color: VAR }}>02 / 04</span>
              <h3 className="mb-6 text-[32px] font-bold leading-tight" style={{ color: ON }}>Every action, on the record</h3>
              <p className="mb-10 max-w-md text-[18px] leading-[1.6]" style={{ color: VAR }}>
                Every action an agent took — or was stopped from taking — lands in an immutable audit log
                with who, what, and why. Freeze an agent and it stops instantly. No redeploy, no guesswork.
              </p>
            </div>
            <div className="relative flex flex-1 items-center justify-center overflow-hidden bg-gradient-to-br from-[#FF5E3A]/80 to-[#FF2A6D]/80 backdrop-blur-md">
              <div className="relative w-[80%] rounded-[10px] border border-white/60 bg-white/50 p-6 shadow-[0_8px_32px_rgba(0,0,0,0.08)] backdrop-blur-xl">
                <div className="mb-6 flex items-center gap-2 border-b border-white/40 pb-4">
                  <span style={{ color: PRIMARY }}><I d="M4 17l6-6-6-6M12 19h8" /></span>
                  <span className="text-lg font-semibold" style={{ color: ON }}>Sentinel audit</span>
                </div>
                <div className="space-y-4 text-base">
                  {[
                    ["Allowed refund $40", true],
                    ["Held wire_transfer $5,000", true],
                    ["Denied delete_* on prod", true],
                    ["Freezing agent ops-bot…", false],
                  ].map(([label, done]) => (
                    <div key={label as string} className={`flex items-start gap-3 ${done ? "" : "opacity-50"}`}>
                      <span className={done ? "text-[#556500]" : "animate-pulse"} style={{ color: done ? "#556500" : "#89726b" }}>
                        <I d={done ? CHECK : "M12 6v6l4 2"} />
                      </span>
                      <span style={{ color: VAR }}>{label}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ── Showcase ── */}
        <section className="relative overflow-hidden bg-white py-[120px]">
          <div className="absolute inset-0" style={{ backgroundImage: "radial-gradient(#C084FC 1px, transparent 1px)", backgroundSize: "32px 32px", opacity: 0.2 }} />
          <div className="relative z-10 mx-auto mb-16 max-w-7xl px-16 text-center">
            <h2 className="text-[40px] font-bold tracking-tight" style={{ color: ON }}>From decision to audit, in one place</h2>
          </div>
          <div className="relative z-10 flex w-full justify-center gap-6 overflow-x-auto px-8 pb-12">
            {[
              { tint: "#38BDF8", body: <><div className="mb-6 h-4 w-24 rounded bg-white/80" /><div className="mb-4 grid grid-cols-2 gap-2"><div className="h-32 rounded border border-white/50 bg-[#38BDF8]/20" /><div className="h-32 rounded border border-white/50 bg-[#C084FC]/20" /></div><div className="h-8 rounded bg-white/80" /></> },
              { tint: "#C084FC", body: <div className="flex h-full flex-col"><div className="mb-4 h-6 w-full rounded bg-white/80" /><div className="flex flex-1 flex-col gap-4 border-y border-white/40 py-4"><div className="h-4 w-full rounded bg-white/80" /><div className="h-4 w-5/6 rounded bg-white/80" /><div className="h-4 w-full rounded bg-white/80" /></div><div className="mt-auto h-8 w-24 self-end rounded-full border border-white/50 bg-[#FF5E3A]/60" /></div> },
              { tint: "#FF9A9E", body: <><div className="mb-4 flex gap-2"><div className="h-10 w-10 rounded-full border border-white/50 bg-[#FF5E3A]/20" /><div className="h-10 flex-1 rounded bg-white/80" /></div><div className="h-40 rounded-lg border border-white/60 bg-white/50" /></> },
              { tint: "#FFD166", body: <div className="grid grid-cols-2 gap-4"><div className="aspect-square rounded bg-white/80" /><div className="aspect-square rounded bg-white/80" /><div className="aspect-square rounded bg-white/80" /><div className="aspect-square rounded bg-white/80" /></div> },
            ].map((c, i) => (
              <div key={i} className={`h-[333px] w-[400px] shrink-0 overflow-hidden rounded-[10px] ${glass}`}>
                <div className="relative h-full overflow-hidden p-6" style={{ backgroundColor: `${c.tint}1a` }}>
                  <div className="relative z-10 h-full rounded-[8px] border border-white/80 bg-white/60 p-4 shadow-[0_4px_16px_rgba(0,0,0,0.02)] backdrop-blur-md">
                    {c.body}
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>

        {/* ── Pricing ── */}
        <section className="px-16 py-[120px]">
          <div className="mx-auto max-w-[1516px]">
            <div className="grid grid-cols-1 gap-8 md:grid-cols-3">
              <div className={`flex flex-col justify-center rounded-[10px] p-8 ${glass}`}>
                <h2 className="mb-4 text-[38px] font-extrabold leading-tight" style={{ color: ON }}>Simple, transparent pricing.</h2>
                <p className="text-[18px] leading-[1.6]" style={{ color: VAR }}>Start free, self-host anytime. No hidden fees.</p>
              </div>
              <div className={`relative flex flex-col overflow-hidden rounded-[10px] p-8 ${glass}`}>
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#38BDF8]/10 to-transparent" />
                <h3 className="mb-2 text-[38px] font-semibold" style={{ color: ON }}>Open source</h3>
                <div className="mb-6 text-[56px] font-extrabold" style={{ color: ON }}>$0<span className="text-base font-normal" style={{ color: VAR }}>/mo</span></div>
                <ul className="mb-8 flex-1 space-y-4 text-base" style={{ color: VAR }}>
                  {["Self-hosted control plane", "Policies, approvals, audit", "Community support"].map((t) => (
                    <li key={t} className="flex items-center gap-3"><span style={{ color: PRIMARY }}><I d={CHECK} /></span>{t}</li>
                  ))}
                </ul>
                <Link href={cta} className="w-full rounded-[8px] border border-white/60 bg-white/50 py-4 text-center text-base shadow-sm backdrop-blur-md transition-colors hover:bg-white/70" style={{ color: ON }}>Get started</Link>
              </div>
              <div className={`relative flex flex-col overflow-hidden rounded-[10px] p-8 ${glass}`}>
                <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#C084FC]/20 to-[#FF9A9E]/20" />
                <div className="absolute right-4 top-4 rounded-full border border-white/80 bg-white/60 px-3 py-1 text-xs font-bold uppercase tracking-wider shadow-sm" style={{ color: ON }}>Popular</div>
                <h3 className="mb-2 text-[38px] font-semibold" style={{ color: ON }}>Cloud</h3>
                <div className="mb-6 text-[56px] font-extrabold" style={{ color: ON }}>$20<span className="text-base font-normal" style={{ color: VAR }}>/mo</span></div>
                <ul className="mb-8 flex-1 space-y-4 text-base" style={{ color: VAR }}>
                  {["Hosted gateway", "Multi-tenant RBAC + SSO", "Priority support", "Managed Postgres"].map((t) => (
                    <li key={t} className="flex items-center gap-3"><span style={{ color: ON }}><I d={CHECK} /></span>{t}</li>
                  ))}
                </ul>
                <Link href={cta} className="w-full rounded-[8px] border border-white/60 bg-white/50 py-4 text-center text-base shadow-sm backdrop-blur-md transition-colors hover:bg-white/70" style={{ color: ON }}>Upgrade</Link>
              </div>
            </div>
            <div className={`relative mt-8 flex flex-col items-center justify-between overflow-hidden rounded-[10px] p-8 md:flex-row ${glass}`}>
              <div className="absolute inset-0 -z-10 bg-[#38BDF8]/5" />
              <div>
                <h4 className="mb-2 text-[28px] font-semibold" style={{ color: ON }}>Enterprise needs?</h4>
                <p className="text-base" style={{ color: VAR }}>Air-gapped deploy, custom SLAs, dedicated support.</p>
              </div>
              <a href="https://github.com/RickyVishwakarma/sentinel" target="_blank" rel="noreferrer" className="mt-4 rounded-[8px] border border-white/60 bg-white/50 px-8 py-3 text-base shadow-sm backdrop-blur-md transition-colors hover:bg-white/70 md:mt-0" style={{ color: ON }}>Contact sales</a>
            </div>
          </div>
        </section>

        {/* ── FAQ ── */}
        <section className="bg-white px-16 py-[120px]">
          <div className="mx-auto flex max-w-[1515px] flex-col gap-16 lg:flex-row">
            <div className="lg:w-1/3">
              <h2 className="sticky top-32 text-[60px] font-extrabold leading-[1.1]" style={{ color: ON }}>Frequently asked questions</h2>
            </div>
            <div className="flex flex-col lg:w-2/3">
              {["What is Sentinel?", "How does action governance work?", "Can I self-host it?", "Does it work with my agent framework?"].map((q) => (
                <div key={q} className="group flex cursor-pointer items-center border-b border-[#ddc0b8]/40 py-4">
                  <div className="flex w-full items-center justify-between">
                    <h3 className="text-xl font-semibold transition-colors group-hover:text-[#FF5E3A]" style={{ color: ON }}>{q}</h3>
                    <span className="transition-colors group-hover:text-[#FF5E3A]" style={{ color: VAR }}><I d={ADD} /></span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ── Final CTA ── */}
        <section className="relative flex min-h-[70vh] flex-col items-center justify-center overflow-hidden px-16 py-[120px] text-center">
          <div className="absolute inset-0 -z-10 bg-white" />
          <div className="absolute inset-0 -z-10 opacity-20" style={{ background: "radial-gradient(circle at 10% 20%, #FF5E3A 0%, transparent 50%), radial-gradient(circle at 90% 80%, #C084FC 0%, transparent 50%), radial-gradient(circle at 50% 50%, #38BDF8 0%, transparent 70%)" }} />
          <h2 className="relative z-10 mb-10 max-w-2xl text-[54px] font-extrabold leading-tight" style={{ color: ON }}>So, what will your agents do next?</h2>
          <Link href={cta} className="group relative z-10 inline-flex items-center gap-3 rounded-full border border-white/60 bg-white/40 px-10 py-5 text-[18px] font-medium shadow-sm backdrop-blur-md transition-all hover:scale-105 hover:bg-white/60" style={{ color: ON }}>
            {ctaLabel}
            <span className="grid h-6 w-6 place-items-center rounded-full bg-white/60"><I d={ARROW_R} cls="h-4 w-4" /></span>
          </Link>
        </section>
      </main>

      <footer className="border-t border-[#ddc0b8]/40 px-16 py-8 text-center text-base" style={{ color: "#89726b" }}>
        © 2026 Sentinel — action governance for AI agents.
      </footer>
    </div>
  );
}
