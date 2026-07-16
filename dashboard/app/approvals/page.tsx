"use client";

import Link from "next/link";
import { useState } from "react";
import { apiFetch, useApi } from "@/lib/api";
import { ErrorBox, Loading, Mono, StatusPill } from "@/components/ui";

interface ApprovalItem {
  id: string;
  kind: "output" | "action";
  run_id: string | null;
  trace_id: string;
  reason: { guardrail?: string; action?: string; detail?: string; policy?: string }[];
  status: string;
  held_output: string | null;
  tool: string | null;
  arguments: Record<string, unknown> | null;
  action_request_id: string | null;
  decided_by: string | null;
  note: string;
  created_at: string | null;
  decided_at: string | null;
}

function ApprovalCard({ item, onDecided }: { item: ApprovalItem; onDecided: () => void }) {
  const [busy, setBusy] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  async function decide(decision: "approve" | "deny") {
    setBusy(decision);
    setErr(null);
    try {
      await apiFetch(`/v1/approvals/${item.id}/decide`, {
        method: "POST",
        body: JSON.stringify({ decision }),
      });
      onDecided();
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(null);
    }
  }

  const isAction = item.kind === "action";
  return (
    <div
      className={`rounded-lg border bg-white/60 backdrop-blur-xl p-4 ${
        isAction ? "border-violet-500/30" : "border-[#ddc0b8]/50"
      }`}
    >
      <div className="flex flex-wrap items-center gap-3">
        <span
          className={`rounded-full border px-2 py-0.5 text-[10px] uppercase tracking-widest ${
            isAction
              ? "border-violet-500/30 bg-violet-500/10 text-violet-300"
              : "border-[#ddc0b8]/70 bg-black/10/60 text-[#56423c]"
          }`}
        >
          {isAction ? "action" : "output"}
        </span>
        <StatusPill status={item.status} />
        <span className="text-xs text-[#89726b]">
          {item.created_at ? new Date(item.created_at).toLocaleString() : "—"}
        </span>
        {item.run_id && (
          <Link href={`/runs/${item.run_id}`} className="text-xs text-[#FF5E3A] hover:underline">
            View trace →
          </Link>
        )}
        {item.status === "pending" && (
          <span className="ml-auto flex gap-2">
            <button
              onClick={() => decide("approve")}
              disabled={busy !== null}
              className="rounded bg-emerald-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-emerald-400 disabled:opacity-50"
            >
              {busy === "approve" ? "…" : "Approve"}
            </button>
            <button
              onClick={() => decide("deny")}
              disabled={busy !== null}
              className="rounded bg-red-500 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-400 disabled:opacity-50"
            >
              {busy === "deny" ? "…" : "Deny"}
            </button>
          </span>
        )}
      </div>

      <div className="mt-3 space-y-2 text-xs">
        {isAction && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-[#89726b]">
              Pending action
            </div>
            <div className="rounded bg-white/70 p-3 font-mono text-[#1d1c15]">
              <span className="text-violet-300">{item.tool}</span>(
              {item.arguments && Object.keys(item.arguments).length > 0 ? (
                <span className="text-[#56423c]">
                  {Object.entries(item.arguments)
                    .map(([k, v]) => `${k}=${JSON.stringify(v)}`)
                    .join(", ")}
                </span>
              ) : null}
              )
            </div>
          </div>
        )}
        <div>
          <div className="mb-1 text-[10px] uppercase tracking-widest text-[#89726b]">
            {isAction ? "Held by policy" : "Flagged because"}
          </div>
          {item.reason.map((r, i) => (
            <div key={i} className="text-amber-600">
              <span className="font-medium">{r.guardrail ?? "policy"}</span>
              <span className="text-[#89726b]"> — {r.detail}</span>
            </div>
          ))}
        </div>
        {item.held_output !== null && item.held_output !== "" && (
          <div>
            <div className="mb-1 text-[10px] uppercase tracking-widest text-[#89726b]">
              Held output
            </div>
            <pre className="whitespace-pre-wrap rounded bg-white/70 p-3 font-mono text-[#3a2f2a]">
              {item.held_output}
            </pre>
          </div>
        )}
        {item.decided_by && (
          <div className="text-[#89726b]">
            decided by <Mono>{item.decided_by.slice(0, 12)}…</Mono>
            {item.decided_at ? ` at ${new Date(item.decided_at).toLocaleString()}` : ""}
            {item.note ? ` — “${item.note}”` : ""}
          </div>
        )}
      </div>
      {err && <p className="mt-2 font-mono text-xs text-red-600">{err}</p>}
    </div>
  );
}

export default function ApprovalsPage() {
  const { data, error, loading, refresh } = useApi<{ entries: ApprovalItem[] }>("/v1/approvals");

  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;

  const pending = data.entries.filter((e) => e.status === "pending");
  const decided = data.entries.filter((e) => e.status !== "pending");

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-lg font-semibold text-[#1d1c15]">
          Approvals{" "}
          {pending.length > 0 && (
            <span className="ml-1 rounded-full border border-[#FF5E3A]/30 bg-[#FF5E3A]/10 px-2 py-0.5 text-xs text-[#FF5E3A]">
              {pending.length} pending
            </span>
          )}
        </h1>
        <button
          onClick={refresh}
          className="rounded border border-[#ddc0b8]/70 px-3 py-1.5 text-xs text-[#56423c] hover:bg-white/60"
        >
          Refresh
        </button>
      </div>

      {data.entries.length === 0 ? (
        <div className="rounded-lg border border-[#ddc0b8]/50 bg-white/60 backdrop-blur-xl p-8 text-sm text-[#89726b]">
          Nothing here. Items land in this queue when a{" "}
          <span className="text-violet-300">policy</span> holds a tool call for approval,
          or a flag-level guardrail fires on an agent with <Mono>hitl_approval</Mono> enabled.
        </div>
      ) : (
        <>
          {pending.map((e) => (
            <ApprovalCard key={e.id} item={e} onDecided={refresh} />
          ))}
          {decided.length > 0 && (
            <>
              <h2 className="pt-2 text-sm font-medium text-[#56423c]">Decided</h2>
              {decided.map((e) => (
                <ApprovalCard key={e.id} item={e} onDecided={refresh} />
              ))}
            </>
          )}
        </>
      )}
    </div>
  );
}
