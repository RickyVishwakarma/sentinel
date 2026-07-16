"use client";

import Link from "next/link";
import { LandingShell } from "@/components/landing-chrome";

const STEPS = [
  {
    n: "01",
    title: "Your agent asks before it acts",
    body: "Before running a high-risk tool, the agent calls the decision point. One HTTP request — no SDK, no framework lock-in. It works the same whether you built on LangChain, CrewAI, MCP, or plain code.",
    code: `POST /v1/agents/{id}/actions/check

{ "tool": "refund",
  "arguments": { "amount": 5000, "customer": "acme" } }`,
  },
  {
    n: "02",
    title: "Policy decides — allow, deny, or hold",
    body: "Rules are declarative: a tool glob plus an optional condition on the call's arguments. They evaluate by ascending priority and the first match wins. Unmatched calls fall through to your default.",
    code: `{ "tool": "delete_*", "effect": "deny", "priority": 10 }
{ "tool": "refund", "priority": 20,
  "condition": { "field": "amount", "op": "gt", "value": 100 },
  "effect": "require_approval" }`,
  },
  {
    n: "03",
    title: "A human clears what crosses the line",
    body: "A held action pauses in the approval queue with the tool and its arguments in full. The agent polls until a person decides. Approve and it proceeds; deny and it never runs — either way the decision is recorded with who and why.",
    code: `GET /v1/actions/{id}
→ { "decision": "pending" }   … a human approves …
→ { "decision": "approved" }`,
  },
  {
    n: "04",
    title: "Freeze everything, instantly",
    body: "When something looks wrong you do not want to hunt for a deploy. Freeze an agent and every action it attempts is denied at once — no redeploy, no config push. Unfreeze to resume.",
    code: `POST /v1/agents/{id}/freeze
→ every subsequent action: DENY (agent is frozen)`,
  },
];

const GATEWAY = [
  ["Full traces", "Every run is a span tree — prompt, guardrails, model call, cost — PII-redacted at rest."],
  ["Guardrails", "PII redaction and prompt-injection blocking before the model, leak-blocking after."],
  ["Provider fallback", "Anthropic → OpenAI → Gemini. Kill the primary and the run still completes."],
  ["Cost attribution", "Spend per tenant and per agent, with a monthly cap: block, warn, or degrade."],
];

export default function ProductPage() {
  return (
    <LandingShell>
      <div className="snl-page">
        <div className="snl-page-head">
          <span className="snl-eyebrow">Product</span>
          <h1 className="snl-page-title">
            How an action gets <span className="serif">governed</span>.
          </h1>
          <p className="snl-page-lede">
            Sentinel sits between your agent and the things it can do. Four steps stand between an
            agent&apos;s intent and a real side effect.
          </p>
        </div>

        <div className="snl-steps">
          {STEPS.map((s) => (
            <div className="snl-step" key={s.n}>
              <span className="snl-step-num">{s.n}</span>
              <div>
                <h2 className="snl-step-title">{s.title}</h2>
                <p className="snl-step-body">{s.body}</p>
                <pre className="snl-code">{s.code}</pre>
              </div>
            </div>
          ))}
        </div>

        <div style={{ marginTop: 96 }}>
          <h2 className="snl-section-title">Three verdicts, one contract</h2>
          <div className="snl-steps">
            <div className="snl-step">
              <span className="snl-verdict snl-verdict--allow">ALLOW</span>
              <p className="snl-step-body">
                No policy blocked it. The agent proceeds and the action is logged.
              </p>
            </div>
            <div className="snl-step">
              <span className="snl-verdict snl-verdict--deny">DENY</span>
              <p className="snl-step-body">
                A policy — or the kill switch — forbids it. The agent is told it may not proceed.
              </p>
            </div>
            <div className="snl-step">
              <span className="snl-verdict snl-verdict--hold">HOLD</span>
              <p className="snl-step-body">
                It crosses a line a human should see. The action waits in the approval queue.
              </p>
            </div>
          </div>
        </div>

        <div style={{ marginTop: 96 }}>
          <h2 className="snl-section-title">On top of a full AI gateway</h2>
          <div className="snl-steps">
            {GATEWAY.map(([title, body]) => (
              <div className="snl-step" key={title}>
                <span className="snl-step-num">·</span>
                <div>
                  <h3 className="snl-step-title">{title}</h3>
                  <p className="snl-step-body">{body}</p>
                </div>
              </div>
            ))}
          </div>
        </div>

        <div style={{ marginTop: 72, textAlign: "center" }}>
          <Link href="/login" className="snl-btn-primary">
            Start governing
          </Link>
        </div>
      </div>
    </LandingShell>
  );
}
