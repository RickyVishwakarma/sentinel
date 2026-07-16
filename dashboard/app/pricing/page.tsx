"use client";

import Link from "next/link";
import { LandingShell } from "@/components/landing-chrome";

function Tick() {
  return (
    <svg className="snl-tick" width="14" height="14" viewBox="0 0 24 24" fill="none">
      <path d="M20 6L9 17l-5-5" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

const PLANS = [
  {
    name: "Open source",
    price: "$0",
    unit: "/forever",
    note: "Run the whole control plane on your own infrastructure. Prompts never leave your network.",
    features: [
      "Policy decision point + kill switch",
      "Approval queue and audit log",
      "Traces, guardrails, cost attribution",
      "Eval CI gate",
      "Postgres · Mongo · Redis, or zero-setup SQLite",
    ],
    cta: "Self-host it",
    href: "https://github.com/RickyVishwakarma/sentinel",
    external: true,
  },
  {
    name: "Cloud",
    price: "$20",
    unit: "/month",
    note: "The same control plane, hosted and updated for you.",
    features: [
      "Everything in Open source",
      "Managed gateway and Postgres",
      "Multi-tenant RBAC",
      "Email support",
    ],
    cta: "Start governing",
    href: "/login",
    featured: true,
    badge: "Planned",
  },
  {
    name: "Enterprise",
    price: "Talk",
    unit: "to us",
    note: "For teams putting agents near money, customers, or production.",
    features: [
      "Air-gapped or VPC deployment",
      "SSO / OIDC in front of RBAC",
      "Custom SLAs and retention policy",
      "Design-partner access",
    ],
    cta: "Get in touch",
    href: "/contact",
  },
];

export default function PricingPage() {
  return (
    <LandingShell>
      <div className="snl-page">
        <div className="snl-page-head">
          <span className="snl-eyebrow">Pricing</span>
          <h1 className="snl-page-title">
            Free to <span className="serif">self-host</span>. Always.
          </h1>
          <p className="snl-page-lede">
            The governance layer is open source and runs entirely on your infrastructure. Pay only
            if you would rather we ran it.
          </p>
        </div>

        <div className="snl-plans">
          {PLANS.map((p) => (
            <div className={`snl-plan${p.featured ? " snl-plan--featured" : ""}`} key={p.name}>
              {p.badge && <span className="snl-plan-badge">{p.badge}</span>}
              <h2 className="snl-plan-name">{p.name}</h2>
              <div className="snl-plan-price">
                {p.price}
                <span>{p.unit}</span>
              </div>
              <p className="snl-plan-note">{p.note}</p>
              <ul className="snl-plan-list">
                {p.features.map((f) => (
                  <li key={f}>
                    <Tick />
                    {f}
                  </li>
                ))}
              </ul>
              {p.external ? (
                <a
                  className="snl-plan-cta"
                  href={p.href}
                  target="_blank"
                  rel="noreferrer"
                >
                  {p.cta}
                </a>
              ) : (
                <Link
                  className={`snl-plan-cta${p.featured ? " snl-plan-cta--solid" : ""}`}
                  href={p.href}
                >
                  {p.cta}
                </Link>
              )}
            </div>
          ))}
        </div>

        <p
          style={{
            maxWidth: 620,
            margin: "48px auto 0",
            textAlign: "center",
            fontSize: 14,
            lineHeight: 1.6,
            color: "var(--muted)",
          }}
        >
          Being straight with you: Sentinel is early. The open-source tier is real and runs today —
          Cloud and Enterprise are where it is headed, not a billing page that already works.
        </p>
      </div>
    </LandingShell>
  );
}
