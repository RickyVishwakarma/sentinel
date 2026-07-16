"use client";

import { AuditEntry, useApi } from "@/lib/api";
import { ErrorBox, Loading, Mono } from "@/components/ui";

function actionColor(action: string): string {
  if (action.includes("block")) return "text-amber-600";
  if (action.includes("error")) return "text-red-600";
  return "text-[#0a0a0a]";
}

export default function AuditPage() {
  const { data, error, loading, refresh } = useApi<{ entries: AuditEntry[] }>("/v1/audit");

  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#0a0a0a]">Audit log</h1>
        <button
          onClick={refresh}
          className="rounded border border-black/10 px-3 py-1.5 text-xs text-[#6b6b6b] hover:bg-white"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-black/[0.08]">
        <table className="w-full text-left text-sm">
          <thead className="bg-[#fbfbfb] text-[11px] uppercase tracking-widest text-[#6b6b6b]">
            <tr>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Actor</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Target</th>
              <th className="px-4 py-2.5 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-black/[0.06]">
            {data.entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-[#6b6b6b]">
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              data.entries.map((e) => (
                <tr key={e.id} className="align-top hover:bg-[#fbfbfb]">
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#6b6b6b]">
                    {new Date(e.ts).toLocaleString()}
                  </td>
                  <td className="px-4 py-2.5">
                    <Mono>{e.actor.length > 12 ? `${e.actor.slice(0, 12)}…` : e.actor}</Mono>
                  </td>
                  <td className={`px-4 py-2.5 font-medium ${actionColor(e.action)}`}>
                    {e.action}
                  </td>
                  <td className="px-4 py-2.5">
                    <Mono>{e.target ? `${e.target.slice(0, 12)}…` : "—"}</Mono>
                  </td>
                  <td className="px-4 py-2.5">
                    <pre className="max-w-md whitespace-pre-wrap font-mono text-xs text-[#6b6b6b]">
                      {JSON.stringify(e.metadata)}
                    </pre>
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
