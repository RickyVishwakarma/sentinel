"use client";

import { Suspense, useMemo } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { AgentOut, EvalHistoryEntry, useApi } from "@/lib/api";
import { ErrorBox, Loading } from "@/components/ui";

const METRICS = ["answer_relevance", "faithfulness", "guardrail_pass_rate", "llm_judge"];

interface EvalRunRow {
  key: string;
  created_at: string | null;
  version: number;
  eval_set: string;
  metrics: Record<string, { score: number; baseline: number; passed: boolean }>;
  passed: boolean;
}

function groupRuns(entries: EvalHistoryEntry[]): EvalRunRow[] {
  const byRun = new Map<string, EvalRunRow>();
  for (const e of entries) {
    // one eval run writes all its metrics in the same commit — group by
    // version + set + second-truncated timestamp
    const key = `${e.version}|${e.eval_set}|${e.created_at?.slice(0, 19)}`;
    let row = byRun.get(key);
    if (!row) {
      row = {
        key,
        created_at: e.created_at,
        version: e.version,
        eval_set: e.eval_set,
        metrics: {},
        passed: true,
      };
      byRun.set(key, row);
    }
    row.metrics[e.metric] = { score: e.score, baseline: e.baseline, passed: e.passed };
    row.passed = row.passed && e.passed;
  }
  return [...byRun.values()];
}

function Score({ m }: { m?: { score: number; baseline: number; passed: boolean } }) {
  if (!m) return <span className="text-[#9b9b9b]">—</span>;
  return (
    <span className={`font-mono text-xs ${m.passed ? "text-emerald-600" : "text-red-600"}`}>
      {m.score.toFixed(3)}
      <span className="text-[#9b9b9b]"> / {m.baseline.toFixed(2)}</span>
    </span>
  );
}

function EvalsView() {
  const params = useSearchParams();
  const router = useRouter();
  const { data: agents } = useApi<AgentOut[]>("/v1/agents");
  const agentId = params.get("agent") ?? agents?.[0]?.id ?? null;
  const { data, error, loading } = useApi<{ agent: string; entries: EvalHistoryEntry[] }>(
    agentId ? `/v1/evals/history?agent_id=${agentId}` : null,
  );

  const rows = useMemo(() => groupRuns(data?.entries ?? []), [data]);

  if (error) return <ErrorBox error={error} />;
  if (!agents || (agentId && (loading || !data))) return <Loading />;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-4">
        <h1 className="text-lg font-semibold text-[#0a0a0a]">Evals</h1>
        <select
          value={agentId ?? ""}
          onChange={(e) => router.push(`/evals?agent=${e.target.value}`)}
          className="rounded border border-black/10 bg-[#fbfbfb] px-3 py-1.5 text-sm text-[#0a0a0a]"
        >
          {agents.map((a) => (
            <option key={a.id} value={a.id}>
              {a.name} (v{a.current_version})
            </option>
          ))}
        </select>
      </div>

      {rows.length === 0 ? (
        <div className="rounded-lg border border-black/[0.08] bg-white p-8 text-sm text-[#6b6b6b]">
          No eval runs recorded for this agent yet. Run one:
          <pre className="mt-3 rounded bg-[#fbfbfb] p-3 font-mono text-xs text-[#6b6b6b]">
            python -m cli.eval_runner --url http://localhost:8000 \
            {"\n"}  --api-key sentinel-demo-key --agent-id {agentId} \
            {"\n"}  --file evals/support-bot.json
          </pre>
        </div>
      ) : (
        <div className="overflow-x-auto rounded-lg border border-black/[0.08]">
          <table className="w-full text-left text-sm">
            <thead className="bg-[#fbfbfb] text-[11px] uppercase tracking-widest text-[#6b6b6b]">
              <tr>
                <th className="px-4 py-2.5 font-medium">Time</th>
                <th className="px-4 py-2.5 font-medium">Version</th>
                <th className="px-4 py-2.5 font-medium">Eval set</th>
                {METRICS.map((m) => (
                  <th key={m} className="px-4 py-2.5 font-medium">
                    {m.replace(/_/g, " ")}
                  </th>
                ))}
                <th className="px-4 py-2.5 font-medium">Gate</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-black/[0.06]">
              {rows.map((r) => (
                <tr key={r.key} className="hover:bg-[#fbfbfb]">
                  <td className="whitespace-nowrap px-4 py-2.5 text-[#6b6b6b]">
                    {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                  </td>
                  <td className="px-4 py-2.5">
                    <span className="rounded-full border border-black/10 px-2 py-0.5 text-xs text-[#0a0a0a]">
                      v{r.version}
                    </span>
                  </td>
                  <td className="px-4 py-2.5 text-[#0a0a0a]">{r.eval_set}</td>
                  {METRICS.map((m) => (
                    <td key={m} className="px-4 py-2.5">
                      <Score m={r.metrics[m]} />
                    </td>
                  ))}
                  <td className="px-4 py-2.5">
                    <span
                      className={`rounded-full border px-2 py-0.5 text-xs font-medium ${
                        r.passed
                          ? "border-emerald-500/30 bg-emerald-500/10 text-emerald-600"
                          : "border-red-500/30 bg-red-500/10 text-red-600"
                      }`}
                    >
                      {r.passed ? "PASS" : "FAIL"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      <p className="text-xs text-[#9b9b9b]">
        Scores are shown as <span className="font-mono">score / baseline</span>. A metric below
        its baseline fails the CI gate and blocks the build.
      </p>
    </div>
  );
}

export default function EvalsPage() {
  return (
    <Suspense fallback={<Loading />}>
      <EvalsView />
    </Suspense>
  );
}
