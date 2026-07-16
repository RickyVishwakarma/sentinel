"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useState } from "react";
import { RunDetail, Span, useApi } from "@/lib/api";
import { Card, ErrorBox, Loading, Mono, StatusPill } from "@/components/ui";

const TYPE_COLORS: Record<string, string> = {
  prompt: "bg-[#9b9b9b]",
  guardrail: "bg-amber-400",
  llm: "bg-[#0a0a0a]",
  tool: "bg-violet-400",
  cost: "bg-emerald-400",
};

function SpanRow({ span }: { span: Span }) {
  const [open, setOpen] = useState(false);
  const violations = (span.meta?.violations as unknown[] | undefined) ?? [];
  const hasDetail = span.input || span.output || Object.keys(span.meta ?? {}).length > 0;

  return (
    <div className="rounded-lg border border-black/[0.08] bg-white">
      <button
        onClick={() => hasDetail && setOpen((o) => !o)}
        className="flex w-full items-center gap-3 px-4 py-3 text-left"
      >
        <span className="w-6 text-right font-mono text-xs text-[#9b9b9b]">{span.seq}</span>
        <span className={`h-2.5 w-2.5 rounded-sm ${TYPE_COLORS[span.type] ?? "bg-[#9b9b9b]"}`} />
        <span className="w-24 text-[11px] uppercase tracking-widest text-[#6b6b6b]">
          {span.type}
        </span>
        <span className="text-sm text-[#0a0a0a]">{span.name}</span>
        {violations.length > 0 && (
          <span className="rounded-full border border-amber-500/30 bg-amber-500/10 px-2 py-0.5 text-xs text-amber-600">
            {violations.length} violation{violations.length > 1 ? "s" : ""}
          </span>
        )}
        <span className="ml-auto flex gap-4 font-mono text-xs text-[#6b6b6b]">
          {span.tokens > 0 && <span>{span.tokens} tok</span>}
          {span.latency_ms > 0 && <span>{span.latency_ms} ms</span>}
          {span.cost > 0 && <span>${span.cost.toFixed(5)}</span>}
        </span>
        {hasDetail && <span className="text-[#9b9b9b]">{open ? "▾" : "▸"}</span>}
      </button>
      {open && (
        <div className="space-y-3 border-t border-black/[0.08] px-4 py-3 text-xs">
          {span.input && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-[#6b6b6b]">Input</div>
              <pre className="whitespace-pre-wrap rounded bg-[#fbfbfb] p-3 font-mono text-[#0a0a0a]">
                {span.input}
              </pre>
            </div>
          )}
          {span.output && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-[#6b6b6b]">Output</div>
              <pre className="whitespace-pre-wrap rounded bg-[#fbfbfb] p-3 font-mono text-[#0a0a0a]">
                {span.output}
              </pre>
            </div>
          )}
          {Object.keys(span.meta ?? {}).length > 0 && (
            <div>
              <div className="mb-1 text-[10px] uppercase tracking-widest text-[#6b6b6b]">
                Metadata
              </div>
              <pre className="whitespace-pre-wrap rounded bg-[#fbfbfb] p-3 font-mono text-[#6b6b6b]">
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
        <Link href="/" className="text-sm text-[#6b6b6b] hover:text-[#0a0a0a]">
          ← Runs
        </Link>
        <h1 className="text-lg font-semibold text-[#0a0a0a]">Run</h1>
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
          <h2 className="text-sm font-medium text-[#0a0a0a]">Trace</h2>
          <Mono>{run.trace_id}</Mono>
        </div>
        <div className="space-y-2">
          {trace.length === 0 ? (
            <div className="rounded-lg border border-black/[0.08] bg-white p-6 text-sm text-[#6b6b6b]">
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
