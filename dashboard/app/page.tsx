"use client";

import Link from "next/link";
import { useAuth } from "@/lib/auth";
import { LandingShell } from "@/components/landing-chrome";
import "./landing.css";

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

export default function Landing() {
  const { session } = useAuth();
  const cta = session ? "/overview" : "/login";
  const ctaLabel = session ? "Open dashboard" : "Start governing";

  return (
    <LandingShell>
      <Hero cta={cta} ctaLabel={ctaLabel} />
      <TrustedBy />
    </LandingShell>
  );
}
