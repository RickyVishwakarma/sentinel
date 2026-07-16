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
      <h1 className="text-lg font-semibold text-[#1d1c15]">Cost — month to date</h1>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
        <Card label="Total cost" value={`$${data.total_cost.toFixed(4)}`} />
        <Card label="Monthly cap" value={`$${data.monthly_cost_cap.toFixed(2)}`} />
        <Card label="Cap used" value={`${capUsed.toFixed(2)}%`} />
      </div>

      <div className="rounded-lg border border-[#ddc0b8]/50 bg-white/60 backdrop-blur-xl p-4">
        <div className="mb-1 flex justify-between text-xs text-[#89726b]">
          <span>Cap usage</span>
          <span>
            ${data.total_cost.toFixed(4)} / ${data.monthly_cost_cap.toFixed(2)}
          </span>
        </div>
        <div className="h-2 overflow-hidden rounded-full bg-black/10">
          <div
            className={`h-full rounded-full ${capUsed > 80 ? "bg-amber-400" : "bg-[#FF5E3A]"}`}
            style={{ width: `${Math.max(capUsed, 0.5)}%` }}
          />
        </div>
      </div>

      <div className="overflow-x-auto rounded-lg border border-[#ddc0b8]/50">
        <table className="w-full text-left text-sm">
          <thead className="bg-white/50 text-[11px] uppercase tracking-widest text-[#89726b]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Agent</th>
              <th className="px-4 py-2.5 font-medium">Runs</th>
              <th className="px-4 py-2.5 font-medium">Tokens</th>
              <th className="px-4 py-2.5 font-medium">Cost</th>
              <th className="w-1/3 px-4 py-2.5 font-medium"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-[#ddc0b8]/40">
            {data.by_agent.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-[#89726b]">
                  No runs this month.
                </td>
              </tr>
            ) : (
              data.by_agent.map((a) => (
                <tr key={a.agent_id} className="hover:bg-white/50">
                  <td className="px-4 py-2.5 text-[#1d1c15]">{a.agent}</td>
                  <td className="px-4 py-2.5 text-[#3a2f2a]">{a.runs}</td>
                  <td className="px-4 py-2.5 text-[#3a2f2a]">{a.tokens}</td>
                  <td className="px-4 py-2.5 font-mono text-xs text-[#3a2f2a]">
                    ${a.cost.toFixed(5)}
                  </td>
                  <td className="px-4 py-2.5">
                    <div className="h-1.5 overflow-hidden rounded-full bg-black/10">
                      <div
                        className="h-full rounded-full bg-[#FF5E3A]"
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
