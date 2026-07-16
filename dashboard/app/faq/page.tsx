"use client";

import { useState } from "react";
import { Plus } from "lucide-react";
import { LandingShell } from "@/components/landing-chrome";

const FAQS = [
  {
    q: "What is Sentinel?",
    a: "A control plane for AI agents. It sits above whatever framework you build on and puts every high-risk tool call through policy before it runs — allow, deny, or hold for a human — with a full audit trail of what your agents did or were stopped from doing.",
  },
  {
    q: "How is this different from an AI gateway?",
    a: "Most gateways govern the token: they proxy the model call, trace it, and attribute cost. Sentinel does that too, but the unit of governance is the action. The risk in an autonomous agent is not the paragraph it writes — it is the refund it issues, the row it deletes, the email it sends. That is what Sentinel gates.",
  },
  {
    q: "How does action governance actually work?",
    a: "Before running a tool, your agent POSTs the tool name and arguments to the decision point. Policies — a tool glob plus an optional condition on the arguments — evaluate by priority; first match wins. You get back allow, deny, or pending. A pending action waits in the approval queue until a person decides, and the agent polls for the outcome.",
  },
  {
    q: "Does it work with my agent framework?",
    a: "Yes. The decision point is one HTTP endpoint, so anything that can make a request can use it — LangChain, CrewAI, MCP tools, Vercel AI SDK, or plain code. Sentinel deliberately does not replace your framework; it sits above it.",
  },
  {
    q: "Can I self-host it?",
    a: "That is the default. Sentinel runs on your own Postgres, Mongo, and Redis — or on zero-setup SQLite for local development — and nothing leaves your network. This matters if you cannot send prompts to a third party.",
  },
  {
    q: "What happens to my data?",
    a: "Span inputs and outputs are PII-redacted before they are written, so raw customer data does not sit in your traces. Traces expire on a retention window you set (30 days by default), enforced by a startup sweep and an admin purge endpoint. Runs are kept as billing records.",
  },
  {
    q: "What if the model provider goes down?",
    a: "Each agent has a fallback chain — Anthropic, then OpenAI, then Gemini. If the primary errors or has no key configured, the gateway moves down the chain automatically and the run still completes. A deterministic template provider sits at the end, so a run can never fail purely for lack of a provider.",
  },
  {
    q: "Is there a kill switch?",
    a: "Yes, and it is one call. Freeze an agent and every action it attempts is denied immediately — no redeploy, no config push, no waiting. Unfreeze when you have figured out what went wrong.",
  },
];

export default function FaqPage() {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <LandingShell>
      <div className="snl-page">
        <div className="snl-page-head">
          <span className="snl-eyebrow">FAQs</span>
          <h1 className="snl-page-title">
            Questions, <span className="serif">answered</span>.
          </h1>
          <p className="snl-page-lede">
            What Sentinel is, what it is not, and how it behaves when things go wrong.
          </p>
        </div>

        <div className="snl-faq">
          {FAQS.map((f, i) => (
            <div className={`snl-faq-item${open === i ? " is-open" : ""}`} key={f.q}>
              <button
                className="snl-faq-q"
                onClick={() => setOpen(open === i ? null : i)}
                aria-expanded={open === i}
              >
                {f.q}
                <Plus size={20} className="snl-faq-icon" />
              </button>
              <div className="snl-faq-a">
                <p>{f.a}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </LandingShell>
  );
}
