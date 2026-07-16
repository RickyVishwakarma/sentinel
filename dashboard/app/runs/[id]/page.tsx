"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RunDetail, Span, useApi } from "@/lib/api";
import { Card, ErrorBox, Loading, Mono, StatusPill } from "@/components/ui";

const TYPE_COLORS: Record<string, string> = {
  prompt: "bg-[#89726b]",
  guardrail: "bg-amber-400",
  llm: "bg-[#FF5E3A]",
  tool: "bg-violet-400",
  cost: "bg-emerald-400",
};

function SpanRow({ span }: { span: Span }) {
  const [open, setOpen] = useState(false);
  const violations = (span.meta?.violations as unknown[] | undefined) ?? [];
  const hasDetail = span.input || span.output || Object.keys(span.meta ?? {}).length > 0;

  return (
    <div className="rounded-lg border border-[#ddc0b8]/50 bg-white/60 backdrop-blur-xl">
      <button
        onClick={() => hasDetail && setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="w-6 text-right font-mono text-xs text-[#a2938c]">{span.seq}</span>
        <span className={`h-2.5 w-2.5 rounded-sm ${TYPE_COLORS[span.type] ?? "bg-[#89726b]"}`} />
        <span className="w-24 text-[11px] uppercase tracking-widest text-[#89726b]">
          {span.type}
        </span>
        <span className="text-sm text-[#1d1c15]">{span.name}</span>
        {violations.length > 0 && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
            {violations.length} violation{violations.length > 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto flex gap-4 font-mono text-xs text-[#89726b]">
          {span.tokens > 0 && <span>{span.tokens} tok</span>}
          {span.latency_ms > 0 && <span>{span.latency_ms} ms</span>}
          {span.cost > 0 && <span>${span.cost.toFixed(5)}</span>}
        </span>
        {hasDetail && <span className="text-[#a2938c]">{open ? "▾" : "▸"}</span>}
      </button>
      {open && (
        <div className="space-y-3 border-t border-[#ddc0b8]/50 px-4 py-3 text-xs">
          {span.input && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-[#89726b]">Input</div>
              <pre className="whitespace-pre-wrap rounded bg-white/70 p-3 font-mono text-[#3a2f2a]">
                {span.input}
              </pre>
            </div>
          )}
          {span.output && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-[#89726b]">Output</div>
              <pre className="whitespace-pre-wrap rounded bg-white/70 p-3 font-mono text-[#3a2f2a]">
                {span.output}
              </pre>
            </div>
          )}
          {Object.keys(span.meta ?? {}).length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-[#89726b]">
                Metadata
              </div>
              <pre className="whitespace-pre-wrap rounded bg-white/70 p-3 font-mono text-[#56423c]">
                {JSON.stringify(span.meta, null, 2)}
              </pre>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default function RunDetailPage() {
  const { id } = useParams<{ id: string }>();
  const { data, error, loading } = useApi<RunDetail>(id ? `/v1/runs/${id}` : null);

  if (error) return <ErrorBox error={error} />;
  if (loading || !data) return <Loading />;

  const { run, trace } = data;

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Link href="/" className="text-sm text-[#89726b] hover:text-[#3a2f2a]">
          ← Runs
        </Link>
        <h1 className="text-lg font-semibold text-[#1d1c15]">Run</h1>
        <Mono>{run.id}</Mono>
        <StatusPill status={run.status} />
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Card label="Provider" value={run.provider ?? "—"} />
        <Card label="Tokens" value={String(run.total_tokens)} />
        <Card label="Cost" value={`$${run.cost.toFixed(5)}`} />
        <Card label="Latency" value={`${run.latency_ms} ms`} />
      </div>

      <div>
        <div className="mb-2 flex items-center gap-2">
          <h2 className="text-sm font-medium text-[#3a2f2a]">Trace</h2>
          <Mono>{run.trace_id}</Mono>
        </div>
        <div className="space-y-2">
          {trace.length === 0 ? (
            <div className="rounded-lg border border-[#ddc0b8]/50 bg-white/60 backdrop-blur-xl p-6 text-sm text-[#89726b]">
              No spans recorded for this trace.
            </div>
          ) : (
            trace.map((s) => <SpanRow key={s.id ?? s.seq} span={s} />)
          )}
        </div>
      </div>
    </div>
  );
}
