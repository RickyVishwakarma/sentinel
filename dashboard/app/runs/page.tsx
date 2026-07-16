"use client";

import Link from "next/link";
import { RunSummary, useApi } from "@/lib/api";
import { Card, ErrorBox, Loading, Mono, StatusPill } from "@/components/ui";

function fmtTime(iso: string | null): string {
  if (!iso) return "—";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}

export default function RunsPage() {
  const { data: runs, error, loading, refresh } = useApi<RunSummary[]>("/v1/runs?limit=100");

  if (error) return <ErrorBox error={error} />;
  if (loading || !runs) return <Loading />;

  const total = runs.length;
  const blocked = runs.filter((r) => r.status === "blocked").length;
  const cost = runs.reduce((s, r) => s + r.cost, 0);
  const avgLatency = total ? Math.round(runs.reduce((s, r) => s + r.latency_ms, 0) / total) : 0;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#0a0a0a]">Runs</h1>
        <button
          onClick={refresh}
          className="rounded border border-black/10 px-3 py-1.5 text-xs text-[#6b6b6b] hover:bg-white"
        >
          Refresh
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Runs (recent)" value={String(total)} />
        <Card
          label="Blocked"
          value={String(blocked)}
          sub={total ? `${Math.round((blocked / total) * 100)}% of recent runs` : undefined}
        />
        <Card label="Cost" value={`$${cost.toFixed(4)}`} sub="recent runs" />
        <Card label="Avg latency" value={`${avgLatency} ms`} sub="gateway, end to end" />
      </div>

      {total === 0 ? (
        <div className="rounded-lg border border-black/[0.08] bg-white p-8 text-sm text-[#6b6b6b]">
          No runs yet. Fire one at the gateway or use the playground on the{" "}
          <Link href="/agents" className="text-[#0a0a0a] hover:underline">
            Agents
          </Link>{" "}
          page.
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/[0.08]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#fbfbfb] text-[11px] uppercase tracking-widest text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Status</th>
                <th className="px-4 py-2.5 font-medium">Provider</th>
                <th className="px-4 py-2.5 font-medium">Tokens</th>
                <th className="px-4 py-2.5 font-medium">Cost</th>
                <th className="px-4 py-2.5 font-medium">Latency</th>
                <th className="px-4 py-2.5 font-medium">Trace</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {runs.map((r) => (
                <tr key={r.id} className="hover:bg-[#fbfbfb]">
                  <td className="px-4 py-2.5 text-[#6b6b6b]">{fmtTime(r.created_at)}</td>
                  <td className="px-4 py-2.5">
                    <StatusPill status={r.status} />
                  </td>
                  <td className="px-4 py-2.5 text-[#0a0a0a]">{r.provider ?? "—"}</td>
                  <td className="px-4 py-2.5 text-[#0a0a0a]">{r.total_tokens}</td>
                  <td className="px-4 py-2.5 text-[#0a0a0a]">${r.cost.toFixed(4)}</td>
                  <td className="px-4 py-2.5 text-[#0a0a0a]">{r.latency_ms} ms</td>
                  <td className="px-4 py-2.5">
                    <Link href={`/runs/${r.id}`} className="text-[#0a0a0a] hover:underline">
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
  );
}
