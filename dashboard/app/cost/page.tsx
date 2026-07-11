"use client";

import { CostReport, useApi } from "@/lib/api";
import { Card, ErrorBox, Loading } from "@/components/ui";

export default function CostPage() {
  const { data, error, loading } = useApi<CostReport>("/v1/cost");

  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;

  const capUsed = data.monthly_cost_cap
    ? Math.min(100, (data.total_cost / data.monthly_cost_cap) * 100)
    : 0;
  const maxCost = Math.max(...data.by_agent.map((a) => a.cost), 1e-9);

  return (
    <div className="space-y-6">
      <h1 className="text-lg font-semibold text-zinc-100">Cost — month to date</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card label="Total cost" value={`$${data.total_cost.toFixed(4)}`} />
        <Card label="Monthly cap" value={`$${data.monthly_cost_cap.toFixed(2)}`} />
        <Card label="Cap used" value={`${capUsed.toFixed(2)}%`} />
      </div>

      <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
        <div className="mb-1 flex justify-between text-xs text-zinc-500">
          <span>Cap usage</span>
          <span>
            ${data.total_cost.toFixed(4)} / ${data.monthly_cost_cap.toFixed(2)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-zinc-800">
          <div
            className={`h-full rounded-full ${capUsed > 80 ? "bg-amber-400" : "bg-sky-400"}`}
            style={{ width: `${Math.max(capUsed, 0.5)}%` }}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-[11px] uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium">Runs</th>
              <th className="px-4 py-2.5 font-medium">Tokens</th>
              <th className="px-4 py-2.5 font-medium">Cost</th>
              <th className="w-1/3 px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {data.by_agent.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-zinc-500">
                  No runs this month.
                </td>
              </tr>
            ) : (
              data.by_agent.map((a) => (
                <tr key={a.agent_id} className="hover:bg-zinc-900/50">
                  <td className="px-4 py-2.5 text-zinc-200">{a.agent}</td>
                  <td className="px-4 py-2.5 text-zinc-300">{a.runs}</td>
                  <td className="px-4 py-2.5 text-zinc-300">{a.tokens}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-zinc-300">
                    ${a.cost.toFixed(5)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-zinc-800">
                      <div
                        className="h-full rounded-full bg-sky-400"
                        style={{ width: `${(a.cost / maxCost) * 100}%` }}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
