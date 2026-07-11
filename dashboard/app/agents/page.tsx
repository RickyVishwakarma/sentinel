"use client";

import Link from "next/link";
import { useState } from "react";
import { AgentOut, RunResponse, apiFetch, useApi } from "@/lib/api";
import { ErrorBox, Loading, Mono, StatusPill } from "@/components/ui";

function Playground({ agent }: { agent: AgentOut }) {
  const [input, setInput] = useState("How do I reset my password?");
  const [result, setResult] = useState<RunResponse | null>(null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function run() {
    setBusy(true);
    setErr(null);
    try {
      const res = await apiFetch<RunResponse>(`/v1/agents/${agent.id}/run`, {
        method: "POST",
        body: JSON.stringify({ input }),
      });
      setResult(res);
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="mt-3 space-y-3 border-t border-zinc-800 pt-3">
      <div className="flex gap-2">
        <input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !busy && run()}
          placeholder="Send an input through the gateway…"
          className="flex-1 rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-200 placeholder:text-zinc-600"
        />
        <button
          onClick={run}
          disabled={busy || !input.trim()}
          className="rounded bg-sky-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-50"
        >
          {busy ? "Running…" : "Run"}
        </button>
      </div>
      {err && <p className="font-mono text-xs text-red-400">{err}</p>}
      {result && (
        <div className="space-y-2 rounded-lg border border-zinc-800 bg-zinc-950 p-4">
          <div className="flex flex-wrap items-center gap-3 text-xs text-zinc-500">
            <StatusPill status={result.status} />
            <span>provider: {result.provider ?? "—"}</span>
            <span>{result.total_tokens} tok</span>
            <span>${result.cost.toFixed(5)}</span>
            <span>{result.latency_ms} ms</span>
            <Link
              href={`/runs/${result.run_id}`}
              className="ml-auto text-sky-400 hover:underline"
            >
              View trace →
            </Link>
          </div>
          <pre className="whitespace-pre-wrap font-mono text-xs text-zinc-300">
            {result.output}
          </pre>
          {result.violations.length > 0 && (
            <pre className="whitespace-pre-wrap rounded bg-amber-500/5 p-2 font-mono text-xs text-amber-400">
              {JSON.stringify(result.violations, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

export default function AgentsPage() {
  const { data: agents, error, loading } = useApi<AgentOut[]>("/v1/agents");

  if (error) return <ErrorBox error={error} />;
  if (loading || !agents) return <Loading />;

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-zinc-100">Agents</h1>
      {agents.length === 0 ? (
        <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-8 text-sm text-zinc-500">
          No agents registered. Seed one with <Mono>python -m app.seed</Mono>.
        </div>
      ) : (
        agents.map((a) => (
          <div key={a.id} className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium text-zinc-100">{a.name}</span>
              <span className="rounded-full border border-zinc-700 px-2 py-0.5 text-xs text-zinc-400">
                v{a.current_version}
              </span>
              <Mono>{a.id}</Mono>
            </div>
            <Playground agent={a} />
          </div>
        ))
      )}
    </div>
  );
}
