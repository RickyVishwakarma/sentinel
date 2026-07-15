"use client";

import Link from "next/link";
import { AgentOut, CostReport, RunSummary, useApi } from "@/lib/api";
import { useAuth } from "@/lib/auth";
import { Card, ErrorBox, Loading, Mono, StatusPill } from "@/components/ui";

export default function OverviewPage() {
  const { session } = useAuth();
  const runs = useApi<RunSummary[]>("/v1/runs?limit=100");
  const agents = useApi<AgentOut[]>("/v1/agents");
  const cost = useApi<CostReport>("/v1/cost");

  if (runs.error) return <ErrorBox error={runs.error} />;
  if (runs.loading || agents.loading || cost.loading || !runs.data || !agents.data || !cost.data)
    return <Loading />;

  const total = runs.data.length;
  const blocked = runs.data.filter((r) => r.status === "blocked").length;
  const held = runs.data.filter((r) => r.status === "pending_approval").length;
  const recent = runs.data.slice(0, 6);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-lg font-semibold text-zinc-100">
          Welcome back{session?.email ? `, ${session.email.split("@")[0]}` : ""}
        </h1>
        <p className="text-sm text-zinc-500">
          {session?.tenant} · control-plane overview
        </p>
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Card label="Agents" value={String(agents.data.length)} sub="registered" />
        <Card label="Runs (recent)" value={String(total)} sub={`${blocked} blocked`} />
        <Card label="Held for approval" value={String(held)} sub="human-in-the-loop" />
        <Card
          label="Cost (MTD)"
          value={`$${cost.data.total_cost.toFixed(4)}`}
          sub={`cap $${cost.data.monthly_cost_cap.toFixed(0)} · ${cost.data.by_agent.length} agents`}
        />
      </div>

      {agents.data.length === 0 ? (
        <div className="rounded-lg border border-dashed border-zinc-700 bg-zinc-900/40 p-8 text-center">
          <p className="text-sm text-zinc-300">No agents yet.</p>
          <p className="mt-1 text-xs text-zinc-500">
            Register your first agent, then send it a message to see the full pipeline in action.
          </p>
          <Link
            href="/agents"
            className="mt-4 inline-block rounded bg-sky-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-400"
          >
            + Create an agent
          </Link>
        </div>
      ) : (
        <div>
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-sm font-medium text-zinc-300">Recent runs</h2>
            <Link href="/runs" className="text-xs text-sky-400 hover:underline">
              All runs →
            </Link>
          </div>
          {recent.length === 0 ? (
            <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-6 text-sm text-zinc-500">
              No runs yet — try the playground on the{" "}
              <Link href="/agents" className="text-sky-400 hover:underline">
                Agents
              </Link>{" "}
              page.
            </div>
          ) : (
            <div className="overflow-x-auto rounded-lg border border-zinc-800">
              <table className="w-full text-left text-sm">
                <thead className="bg-zinc-900 text-[11px] uppercase tracking-widest text-zinc-500">
                  <tr>
                    <th className="px-4 py-2.5 font-medium">Status</th>
                    <th className="px-4 py-2.5 font-medium">Provider</th>
                    <th className="px-4 py-2.5 font-medium">Tokens</th>
                    <th className="px-4 py-2.5 font-medium">Latency</th>
                    <th className="px-4 py-2.5 font-medium">Trace</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-zinc-800/80">
                  {recent.map((r) => (
                    <tr key={r.id} className="hover:bg-zinc-900/50">
                      <td className="px-4 py-2.5">
                        <StatusPill status={r.status} />
                      </td>
                      <td className="px-4 py-2.5 text-zinc-300">{r.provider ?? "—"}</td>
                      <td className="px-4 py-2.5 text-zinc-300">{r.total_tokens}</td>
                      <td className="px-4 py-2.5 text-zinc-300">{r.latency_ms} ms</td>
                      <td className="px-4 py-2.5">
                        <Link href={`/runs/${r.id}`} className="text-sky-400 hover:underline">
                          <Mono>{r.trace_id.slice(0, 12)}…</Mono>
                        </Link>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
