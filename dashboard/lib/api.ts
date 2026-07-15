"use client";

import { useCallback, useEffect, useState } from "react";

/** Client for the Sentinel gateway. Key + URL live in localStorage so the
 *  dashboard is a pure static frontend against any gateway instance. */

export const DEFAULT_URL = "http://localhost:8000";
export const DEFAULT_KEY = "sentinel-demo-key";

export function apiUrl(): string {
  if (typeof window === "undefined") return DEFAULT_URL;
  return localStorage.getItem("sentinel_api_url") || DEFAULT_URL;
}

export function apiKey(): string {
  if (typeof window === "undefined") return DEFAULT_KEY;
  // Prefer the logged-in session's key; fall back to a manually-set key.
  try {
    const raw = localStorage.getItem("sentinel_session");
    if (raw) {
      const k = JSON.parse(raw)?.api_key;
      if (k) return k;
    }
  } catch {}
  return localStorage.getItem("sentinel_api_key") || DEFAULT_KEY;
}

export function setApiUrl(url: string) {
  localStorage.setItem("sentinel_api_url", url);
}

export async function apiFetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${apiUrl()}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(`${res.status}: ${detail}`);
  }
  return res.json();
}

export function useApi<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [tick, setTick] = useState(0);

  const refresh = useCallback(() => setTick((t) => t + 1), []);

  useEffect(() => {
    if (!path) return;
    let cancelled = false;
    setLoading(true);
    apiFetch<T>(path)
      .then((d) => {
        if (!cancelled) {
          setData(d);
          setError(null);
        }
      })
      .catch((e) => {
        if (!cancelled) setError(String(e.message ?? e));
      })
      .finally(() => {
        if (!cancelled) setLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [path, tick]);

  return { data, error, loading, refresh };
}

/* ---- API shapes (mirror app/routers/*) ---- */

export interface RunSummary {
  id: string;
  agent_version_id: string;
  status: "ok" | "blocked" | "error" | "pending_approval" | "denied";
  provider: string | null;
  total_tokens: number;
  cost: number;
  latency_ms: number;
  trace_id: string;
  created_at: string | null;
}

export interface Span {
  id: string;
  trace_id: string;
  parent_id: string | null;
  seq: number;
  type: string;
  name: string;
  input: string;
  output: string;
  tokens: number;
  latency_ms: number;
  cost: number;
  meta: Record<string, unknown>;
  ts: string | null;
}

export interface RunDetail {
  run: RunSummary;
  trace: Span[];
}

export interface AgentOut {
  id: string;
  name: string;
  current_version: number;
  frozen?: boolean;
}

export interface Policy {
  id: string;
  agent_id: string | null;
  tool: string;
  effect: "allow" | "deny" | "require_approval";
  condition: { field: string; op: string; value: unknown } | null;
  priority: number;
  description: string;
  enabled: boolean;
  created_at: string | null;
}

export interface CostReport {
  tenant_id: string;
  from: string;
  to: string;
  total_cost: number;
  monthly_cost_cap: number;
  by_agent: { agent_id: string; agent: string; cost: number; tokens: number; runs: number }[];
}

export interface AuditEntry {
  id: string;
  actor: string;
  action: string;
  target: string;
  metadata: Record<string, unknown>;
  ts: string;
}

export interface RunResponse {
  run_id: string;
  trace_id: string;
  status: string;
  provider: string | null;
  output: string;
  total_tokens: number;
  cost: number;
  latency_ms: number;
  violations: Record<string, unknown>[];
  approval_id?: string | null;
}

export interface ProviderStatus {
  id: string;
  available: boolean;
}

export interface EvalHistoryEntry {
  id: string;
  version: number;
  eval_set: string;
  metric: string;
  score: number;
  baseline: number;
  passed: boolean;
  created_at: string | null;
}

export interface StreamCallbacks {
  onMeta?: (d: { run_id: string; trace_id: string }) => void;
  onProvider?: (provider: string) => void;
  onDelta?: (text: string) => void;
  onBlocked?: (d: { message: string; violations: unknown[] }) => void;
  onDone?: (d: {
    run_id: string;
    trace_id: string;
    status: string;
    provider: string | null;
    total_tokens: number;
    cost: number;
    latency_ms: number;
    violations: Record<string, unknown>[];
  }) => void;
}

/** Drive the SSE streaming endpoint. Returns "streamed" after a completed
 *  stream, or a full RunResponse when the gateway answered with plain JSON
 *  (pre-call guardrail block, or the HITL 409 → buffered-endpoint fallback). */
export async function streamRun(
  agentId: string,
  input: string,
  cb: StreamCallbacks,
): Promise<"streamed" | RunResponse> {
  const res = await fetch(`${apiUrl()}/v1/agents/${agentId}/run/stream`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey()}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ input }),
  });

  // HITL agents can't stream (409) — fall back to the buffered endpoint.
  if (res.status === 409) {
    return apiFetch<RunResponse>(`/v1/agents/${agentId}/run`, {
      method: "POST",
      body: JSON.stringify({ input }),
    });
  }
  if (!res.ok) {
    let detail = res.statusText;
    try {
      detail = (await res.json()).detail ?? detail;
    } catch {}
    throw new Error(`${res.status}: ${detail}`);
  }
  if ((res.headers.get("content-type") ?? "").includes("application/json")) {
    return (await res.json()) as RunResponse; // pre-call guardrail block
  }

  const reader = res.body!.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  for (;;) {
    const { done, value } = await reader.read();
    if (done) break;
    buf += decoder.decode(value, { stream: true });
    let sep;
    while ((sep = buf.indexOf("\n\n")) >= 0) {
      const block = buf.slice(0, sep);
      buf = buf.slice(sep + 2);
      const lines = block.split("\n");
      const event = lines[0]?.replace(/^event: /, "");
      let data: never;
      try {
        data = JSON.parse(lines[1]?.replace(/^data: /, "") ?? "{}") as never;
      } catch {
        continue;
      }
      if (event === "meta") cb.onMeta?.(data);
      else if (event === "provider")
        cb.onProvider?.((data as { provider: string }).provider);
      else if (event === "delta") cb.onDelta?.((data as { text: string }).text);
      else if (event === "blocked") cb.onBlocked?.(data);
      else if (event === "done") cb.onDone?.(data);
    }
  }
  return "streamed";
}
