"use client";

import Link from "next/link";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { LandingShell } from "@/components/landing-chrome";
import "./landing.css";
import "./home.css";

/* Minimal black-and-white landing. All styling lives in ./landing.css —
   no Tailwind utilities here, per the design spec. */

// What the control plane does — the hero ticker.
const TICKER = [
  "Action Policies",
  "Human Approvals",
  "Full Traces",
  "Kill Switch",
  "Cost Attribution",
];

// Stacks Sentinel actually sits in front of. Not customer logos — these are
// integrations, so the claim stays true.
const STACKS: { name: string; font: string; weight: number }[] = [
  { name: "LangChain", font: "var(--font-cedarville), cursive", weight: 700 },
  { name: "CrewAI", font: "system-ui, sans-serif", weight: 800 },
  { name: "Anthropic", font: "Georgia, serif", weight: 500 },
  { name: "OpenAI", font: "var(--font-inter), sans-serif", weight: 600 },
  { name: "Gemini", font: "var(--font-inter), sans-serif", weight: 700 },
  { name: "LlamaIndex", font: "system-ui, sans-serif", weight: 600 },
  { name: "AutoGen", font: "Georgia, serif", weight: 700 },
  { name: "MCP", font: "system-ui, sans-serif", weight: 800 },
  { name: "Vercel AI", font: "var(--font-inter), sans-serif", weight: 600 },
  { name: "Postgres", font: "var(--font-source-serif), serif", weight: 600 },
];

const LINE_COUNT = 20;

function Lines() {
  const lines = Array.from({ length: LINE_COUNT }, (_, i) => i);
  return (
    <div className="snl-lines" aria-hidden="true">
      {lines.map((i) => (
        <span
          key={`l${i}`}
          className="snl-line snl-line--left"
          style={{ width: `${60 + i * 10}px`, animationDelay: `${i * 0.25}s` }}
        />
      ))}
      {lines.map((i) => (
        <span
          key={`r${i}`}
          className="snl-line snl-line--right"
          style={{ width: `${60 + i * 10}px`, animationDelay: `${i * 0.25}s` }}
        />
      ))}
      {lines.map((i) => (
        <span
          key={`t${i}`}
          className="snl-line snl-line--top"
          style={{ height: `${60 + i * 10}px`, animationDelay: `${i * 0.25}s` }}
        />
      ))}
    </div>
  );
}

function Hero({ cta, ctaLabel }: { cta: string; ctaLabel: string }) {
  return (
    <section className="snl-hero">
      <Lines />

      <div className="snl-ticker">
        <div className="snl-marquee">
          {Array.from({ length: 4 }).flatMap((_, dup) =>
            TICKER.map((t) => (
              <span className="snl-ticker-item" key={`${dup}-${t}`}>
                {t}
              </span>
            )),
          )}
        </div>
      </div>

      <h1 className="snl-title">
        Every agent action <span className="serif italic">sentinel</span>
        <sup>®</sup> approved.
      </h1>

      <p className="snl-sub">
        A policy layer for teams shipping autonomous agents. Allow, deny, or hold every
        high-risk tool call for a human — with a full audit trail of what your agents did.
      </p>

      <div className="snl-cta">
        <Link href={cta} className="snl-btn-primary">
          {ctaLabel}
        </Link>
        <a
          className="snl-btn-book"
          href="https://github.com/RickyVishwakarma/sentinel#see-it-work"
          target="_blank"
          rel="noreferrer"
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            className="snl-avatar"
            src="https://framerusercontent.com/images/hfneFL6CHBi5BnNvCeOaqU9HqE4.png"
            alt=""
          />
          <span className="snl-book-text">
            <span className="snl-book-primary">Watch an agent get stopped</span>
            <span className="snl-book-secondary">
              <span className="snl-dot" />
              60-second demo
            </span>
          </span>
        </a>
      </div>

      <div className="snl-blur" aria-hidden="true" />
    </section>
  );
}

function TrustedBy() {
  return (
    <section className="snl-trusted">
      <p className="snl-trusted-label">Sits in front of the stacks you already build on</p>
      <div className="snl-trusted-marquee">
        <div className="snl-marquee">
          {Array.from({ length: 4 }).flatMap((_, dup) =>
            STACKS.map((s) => (
              <span
                className="snl-logo-item"
                key={`${dup}-${s.name}`}
                style={{ fontFamily: s.font, fontWeight: s.weight }}
              >
                {s.name}
              </span>
            )),
          )}
        </div>
      </div>
    </section>
  );
}

const FLOW = [
  {
    n: "01",
    title: "The agent asks first",
    body: "Before running a high-risk tool, your agent calls the decision point — one HTTP request. Works with LangChain, CrewAI, MCP, or plain code.",
  },
  {
    n: "02",
    title: "Policy decides",
    body: "Declarative per-tool rules — a glob plus a condition on the arguments — evaluate by priority. First match wins; unmatched calls fall through to your default.",
  },
  {
    n: "03",
    title: "You get a verdict",
    body: "Allow, deny, or hold for a human — every decision recorded in an immutable audit log with who, what, and why.",
  },
];

const FEATURES = [
  ["Full traces", "Every run is a span tree — prompt, guardrails, model, cost — PII-redacted at rest."],
  ["Guardrails", "PII redaction and prompt-injection blocking before the model, leak-blocking after."],
  ["Provider fallback", "Anthropic → OpenAI → Gemini. Kill the primary and the run still completes."],
  ["Cost attribution", "Spend per tenant and per agent, with a monthly cap: block, warn, or degrade."],
  ["Kill switch", "Freeze an agent and every action it attempts is denied instantly. No redeploy."],
  ["Eval CI gate", "Score faithfulness and guardrail-pass-rate; block prompt regressions before they ship."],
];

function HowItWorks() {
  return (
    <section className="snl-section">
      <span className="snl-kicker">How it works</span>
      <h2 className="snl-h2">
        Ask before <span className="serif">acting</span>.
      </h2>
      <p className="snl-lede">
        Sentinel sits between your agent and the things it can do. Three steps stand between an
        agent&apos;s intent and a real side effect.
      </p>
      <div className="snl-flow">
        {FLOW.map((s) => (
          <div className="snl-flow-card" key={s.n}>
            <span className="snl-flow-num">{s.n}</span>
            <h3 className="snl-flow-title">{s.title}</h3>
            <p className="snl-flow-body">{s.body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function Verdicts() {
  return (
    <section className="snl-section" style={{ paddingTop: 0 }}>
      <span className="snl-kicker">The contract</span>
      <h2 className="snl-h2">Three verdicts, one endpoint.</h2>
      <div className="snl-verdicts">
        <div className="snl-vcard">
          <span className="snl-verdict snl-verdict--allow">ALLOW</span>
          <p className="snl-vbody">No policy blocked it. The agent proceeds and the action is logged.</p>
        </div>
        <div className="snl-vcard">
          <span className="snl-verdict snl-verdict--deny">DENY</span>
          <p className="snl-vbody">
            A policy — or the kill switch — forbids it. The agent is told it may not proceed.
          </p>
        </div>
        <div className="snl-vcard">
          <span className="snl-verdict snl-verdict--hold">HOLD</span>
          <p className="snl-vbody">
            It crosses a line a human should see. The action waits in the approval queue.
          </p>
        </div>
      </div>
    </section>
  );
}

function Features() {
  return (
    <section className="snl-section" style={{ paddingTop: 0 }}>
      <span className="snl-kicker">Under the hood</span>
      <h2 className="snl-h2">
        On top of a full <span className="serif">gateway</span>.
      </h2>
      <p className="snl-lede">
        The decision point rides on everything you already need to run agents in production.
      </p>
      <div className="snl-features">
        {FEATURES.map(([title, body]) => (
          <div className="snl-feature" key={title}>
            <h3>{title}</h3>
            <p>{body}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function ClosingBand({ href, label }: { href: string; label: string }) {
  return (
    <section className="snl-section" style={{ paddingTop: 0 }}>
      <div className="snl-band">
        <h2>Govern your agents today.</h2>
        <p>
          Open source and self-hostable. One endpoint stands between your agent and a mistake it
          can&apos;t take back.
        </p>
        <Link href={href} className="snl-band-btn">
          {label} →
        </Link>
        <pre className="snl-band-code">
{`POST /v1/agents/{id}/actions/check
{ "tool": "refund", "arguments": { "amount": 5000 } }

→ { "decision": "pending", "reason": "refunds over $100 need a human" }`}
        </pre>
      </div>
    </section>
  );
}

export default function Landing() {
  // Signed-in visitors can browse the homepage freely; the CTAs (and the nav)
  // just switch to point at the dashboard instead of sign-up.
  const { isSignedIn } = useClerkAuth();
  const cta = isSignedIn ? "/overview" : "/sign-up";
  const ctaLabel = isSignedIn ? "Open dashboard" : "Start governing";

  return (
    <LandingShell>
      <Hero cta={cta} ctaLabel={ctaLabel} />
      <HowItWorks />
      <Verdicts />
      <Features />
      <ClosingBand href={cta} label={ctaLabel} />
      <TrustedBy />
    </LandingShell>
  );
}
