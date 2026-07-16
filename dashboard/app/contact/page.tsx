"use client";

import { LandingShell } from "@/components/landing-chrome";

const REPO = "https://github.com/RickyVishwakarma/sentinel";

const CHANNELS = [
  {
    title: "Read the source",
    body: "Sentinel is open source. The gateway, the policy engine, the approval queue — all of it is on GitHub, including the governed-agent demo.",
    action: "Browse the repo",
    href: REPO,
  },
  {
    title: "Report a bug",
    body: "Something broken, or a policy that behaves in a way you did not expect? Open an issue with the trace id and we will dig in.",
    action: "Open an issue",
    href: `${REPO}/issues/new`,
  },
  {
    title: "Become a design partner",
    body: "Shipping agents that spend money or touch production? We want to hear what you had to hack together to approve and audit those actions.",
    action: "Start a discussion",
    href: `${REPO}/discussions`,
  },
  {
    title: "See it stop an agent",
    body: "The fastest way to understand Sentinel is to watch a real agent get allowed, denied, and held in one run. It takes about a minute.",
    action: "Run the demo",
    href: `${REPO}#see-it-work`,
  },
];

export default function ContactPage() {
  return (
    <LandingShell>
      <div className="snl-page">
        <div className="snl-page-head">
          <span className="snl-eyebrow">Get in touch</span>
          <h1 className="snl-page-title">
            Tell us what your agents are <span className="serif">about to do</span>.
          </h1>
          <p className="snl-page-lede">
            Sentinel is early and built in the open. The most useful thing you can send is the story
            of an agent action you did not want to happen automatically.
          </p>
        </div>

        <div className="snl-contact">
          {CHANNELS.map((c) => (
            <a
              className="snl-contact-card"
              key={c.title}
              href={c.href}
              target="_blank"
              rel="noreferrer"
            >
              <h3>{c.title}</h3>
              <p>{c.body}</p>
              <span>{c.action} →</span>
            </a>
          ))}
        </div>
      </div>
    </LandingShell>
  );
}
