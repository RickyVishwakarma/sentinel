"use client";

import { AuditEntry, useApi } from "@/lib/api";
import { ErrorBox, Loading, Mono } from "@/components/ui";

function actionColor(action: string): string {
  if (action.includes("block")) return "text-amber-400";
  if (action.includes("error")) return "text-red-400";
  return "text-zinc-300";
}

export default function AuditPage() {
  const { data, error, loading, refresh } = useApi<{ entries: AuditEntry[] }>("/v1/audit");

  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-zinc-100">Audit log</h1>
        <button
          onClick={refresh}
          className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
        >
          Refresh
        </button>
      </div>

      <div className="overflow-x-auto rounded-lg border border-zinc-800">
        <table className="w-full text-left text-sm">
          <thead className="bg-zinc-900 text-[11px] uppercase tracking-widest text-zinc-500">
            <tr>
              <th className="px-4 py-2.5 font-medium">Time</th>
              <th className="px-4 py-2.5 font-medium">Actor</th>
              <th className="px-4 py-2.5 font-medium">Action</th>
              <th className="px-4 py-2.5 font-medium">Target</th>
              <th className="px-4 py-2.5 font-medium">Detail</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-zinc-800/80">
            {data.entries.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-4 py-6 text-zinc-500">
                  No audit entries yet.
                </td>
              </tr>
            ) : (
              data.entries.map((e) => (
                <tr key={e.id} className="align-top hover:bg-zinc-900/50">
                  <td className="whitespace-nowrap px-4 py-2.5 text-zinc-400">
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
                    <pre className="max-w-md whitespace-pre-wrap font-mono text-xs text-zinc-500">
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
