"use client";

import Link from "next/link";
import { useRef, useState } from "react";
import { AgentOut, RunResponse, apiFetch, streamRun, useApi } from "@/lib/api";
import { ErrorBox, Loading, Mono, StatusPill } from "@/components/ui";

const ALL_GUARDRAILS = [
  ["pii_redaction", "Redact PII (pre)"],
  ["prompt_injection", "Block prompt injection (pre)"],
  ["output_blocklist", "Block secret leaks (post)"],
  ["hitl_approval", "Hold flagged runs for approval"],
];

function NewAgentForm({ onCreated }: { onCreated: () => void }) {
  const [open, setOpen] = useState(false);
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("You are a concise, helpful assistant.");
  const [model, setModel] = useState("claude-opus-4-8");
  const [guardrails, setGuardrails] = useState<string[]>([
    "pii_redaction",
    "prompt_injection",
    "output_blocklist",
  ]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function toggle(g: string) {
    setGuardrails((cur) => (cur.includes(g) ? cur.filter((x) => x !== g) : [...cur, g]));
  }

  async function create() {
    setBusy(true);
    setErr(null);
    try {
      await apiFetch<AgentOut>("/v1/agents", {
        method: "POST",
        body: JSON.stringify({
          name: name.trim(),
          model: model.trim(),
          system_prompt: prompt,
          guardrails,
          fallback_chain: ["anthropic", "openai", "gemini"],
        }),
      });
      setName("");
      setOpen(false);
      onCreated();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="rounded bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#262626]"
      >
        + New agent
      </button>
    );
  }

  return (
    <div className="space-y-3 rounded-lg border border-black/10 bg-white p-4">
      <div className="flex gap-3">
        <label className="flex-1 text-xs text-[#6b6b6b]">
          Name
          <input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="support-bot"
            className="mt-1 block w-full rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 text-sm text-[#0a0a0a]"
          />
        </label>
        <label className="flex-1 text-xs text-[#6b6b6b]">
          Model
          <input
            value={model}
            onChange={(e) => setModel(e.target.value)}
            className="mt-1 block w-full rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 font-mono text-xs text-[#0a0a0a]"
          />
        </label>
      </div>
      <label className="block text-xs text-[#6b6b6b]">
        System prompt
        <textarea
          value={prompt}
          onChange={(e) => setPrompt(e.target.value)}
          rows={2}
          className="mt-1 block w-full rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 text-sm text-[#0a0a0a]"
        />
      </label>
      <div className="flex flex-wrap gap-3">
        {ALL_GUARDRAILS.map(([id, label]) => (
          <label key={id} className="flex items-center gap-1.5 text-xs text-[#6b6b6b]">
            <input
              type="checkbox"
              checked={guardrails.includes(id)}
              onChange={() => toggle(id)}
              className="accent-[#0a0a0a]"
            />
            {label}
          </label>
        ))}
      </div>
      {err && <p className="font-mono text-xs text-red-600">{err}</p>}
      <div className="flex gap-2">
        <button
          onClick={create}
          disabled={busy || !name.trim()}
          className="rounded bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#262626] disabled:opacity-50"
        >
          {busy ? "Creating…" : "Create agent"}
        </button>
        <button
          onClick={() => setOpen(false)}
          className="rounded border border-black/10 px-4 py-2 text-sm text-[#6b6b6b] hover:bg-white"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}

interface PlayResult {
  status: string;
  provider: string | null;
  runId: string | null;
  totalTokens: number;
  cost: number;
  latencyMs: number;
  violations: Record<string, unknown>[];
  streamed: boolean;
  approvalId?: string | null;
}

function Playground({ agent }: { agent: AgentOut }) {
  const [input, setInput] = useState("How do I reset my password?");
  const [output, setOutput] = useState("");
  const [result, setResult] = useState<PlayResult | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const outRef = useRef<HTMLPreElement>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    setOutput("");
    setResult(null);
    let streamedProvider: string | null = null;
    try {
      const outcome = await streamRun(agent.id, input, {
        onProvider: (p) => {
          streamedProvider = p;
        },
        onDelta: (t) => {
          setOutput((o) => o + t); // typewriter: deltas append as they arrive
          outRef.current?.scrollTo({ top: outRef.current.scrollHeight });
        },
        onBlocked: (d) => {
          setOutput((o) => (o ? `${o}\n\n${d.message}` : d.message));
        },
        onDone: (d) => {
          setResult({
            status: d.status,
            provider: d.provider ?? streamedProvider,
            runId: d.run_id,
            totalTokens: d.total_tokens,
            cost: d.cost,
            latencyMs: d.latency_ms,
            violations: d.violations,
            streamed: true,
          });
        },
      });
      if (outcome !== "streamed") {
        // plain JSON path: pre-call block, or HITL fallback to buffered run
        const r = outcome as RunResponse;
        setOutput(r.output);
        setResult({
          status: r.status,
          provider: r.provider,
          runId: r.run_id,
          totalTokens: r.total_tokens,
          cost: r.cost,
          latencyMs: r.latency_ms,
          violations: r.violations,
          streamed: false,
          approvalId: r.approval_id,
        });
      }
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-black/[0.08] pt-3">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && run()}
          placeholder="Send an input through the gateway…"
          className="flex-1 rounded border border-black/10 bg-[#fbfbfb] px-3 py-2 text-sm text-[#0a0a0a] placeholder:text-[#9b9b9b]"
        />
        <button
          onClick={run}
          disabled={busy || !input.trim()}
          className="rounded bg-[#0a0a0a] px-4 py-2 text-sm font-medium text-white hover:bg-[#262626] disabled:opacity-50"
        >
          {busy ? "Streaming…" : "Run"}
        </button>
      </div>
      {err && <p className="font-mono text-xs text-red-600">{err}</p>}
      {(output || result) && (
        <div className="space-y-2 rounded-lg border border-black/[0.08] bg-[#fbfbfb] p-4">
          <pre
            ref={outRef}
            className="max-h-64 overflow-y-auto whitespace-pre-wrap font-mono text-xs text-[#0a0a0a]"
          >
            {output}
            {busy && <span className="animate-pulse text-[#0a0a0a]">▍</span>}
          </pre>
          {result && (
            <div className="flex flex-wrap items-center gap-3 border-t border-black/[0.08] pt-2 text-xs text-[#6b6b6b]">
              <StatusPill status={result.status} />
              {result.streamed && (
                <span className="rounded-full border border-black/10 bg-black/[0.04] px-2 py-0.5 text-[#0a0a0a]">
                  streamed
                </span>
              )}
              <span>provider: {result.provider ?? "—"}</span>
              <span>{result.totalTokens} tok</span>
              <span>${result.cost.toFixed(5)}</span>
              <span>{result.latencyMs} ms</span>
              {result.approvalId && (
                <Link href="/approvals" className="text-amber-600 hover:underline">
                  Held — review in Approvals →
                </Link>
              )}
              {result.runId && (
                <Link
                  href={`/runs/${result.runId}`}
                  className="ml-auto text-[#0a0a0a] hover:underline"
                >
                  View trace →
                </Link>
              )}
            </div>
          )}
          {result && result.violations.length > 0 && (
            <pre className="whitespace-pre-wrap rounded bg-amber-500/5 p-2 font-mono text-xs text-amber-600">
              {JSON.stringify(result.violations, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

function FreezeButton({ agent, onChanged }: { agent: AgentOut; onChanged: () => void }) {
  const [busy, setBusy] = useState(false);
  async function toggle() {
    setBusy(true);
    try {
      await apiFetch(`/v1/agents/${agent.id}/${agent.frozen ? "unfreeze" : "freeze"}`, {
        method: "POST",
      });
      onChanged();
    } finally {
      setBusy(false);
    }
  }
  return (
    <button
      onClick={toggle}
      disabled={busy}
      title={agent.frozen ? "Resume: allow actions again" : "Kill switch: deny all actions"}
      className={`rounded border px-3 py-1.5 text-xs font-medium disabled:opacity-50 ${
        agent.frozen
          ? "border-emerald-500/40 text-emerald-600 hover:bg-emerald-500/10"
          : "border-red-500/40 text-red-600 hover:bg-red-500/10"
      }`}
    >
      {busy ? "…" : agent.frozen ? "Unfreeze" : "Freeze"}
    </button>
  );
}

export default function AgentsPage() {
  const { data: agents, error, loading, refresh } = useApi<AgentOut[]>("/v1/agents");

  if (error) return <ErrorBox error={error} />;
  if (loading || !agents) return <Loading />;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-[#0a0a0a]">Agents</h1>
      <NewAgentForm onCreated={refresh} />
      {agents.length === 0 ? (
        <div className="rounded-lg border border-dashed border-black/10 bg-white p-8 text-center text-sm text-[#6b6b6b]">
          <p>No agents yet — create your first one above.</p>
          <p className="mt-1 text-xs text-[#6b6b6b]">
            Give it a name, a system prompt, and pick guardrails. Then send it a message from the
            playground to watch the full pipeline run.
          </p>
        </div>
      ) : (
        agents.map((a) => (
          <div key={a.id} className="rounded-lg border border-black/[0.08] bg-white p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-[#0a0a0a]">{a.name}</span>
              <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-[#6b6b6b]">
                v{a.current_version}
              </span>
              {a.frozen && (
                <span className="rounded-full border border-red-500/30 bg-red-500/10 px-2 py-0.5 text-xs text-red-600">
                  frozen
                </span>
              )}
              <Mono>{a.id}</Mono>
              <div className="ml-auto flex items-center gap-3">
                <FreezeButton agent={a} onChanged={refresh} />
                <Link href={`/evals?agent=${a.id}`} className="text-xs text-[#0a0a0a] hover:underline">
                  Eval history →
                </Link>
              </div>
            </div>
            <Playground agent={a} />
          </div>
        ))
      )}
    </div>
  );
}
