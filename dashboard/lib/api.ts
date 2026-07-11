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
  return localStorage.getItem("sentinel_api_key") || DEFAULT_KEY;
}

export function setApiConfig(url: string, key: string) {
  localStorage.setItem("sentinel_api_url", url);
  localStorage.setItem("sentinel_api_key", key);
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
  status: "ok" | "blocked" | "error";
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
}
