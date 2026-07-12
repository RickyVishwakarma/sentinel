"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { apiKey, apiUrl, setApiConfig } from "@/lib/api";

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    blocked: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    error: "bg-red-500/10 text-red-400 border-red-500/30",
    pending_approval: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    pending: "bg-sky-500/10 text-sky-400 border-sky-500/30",
    approved: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    denied: "bg-red-500/10 text-red-400 border-red-500/30",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2 py-0.5 text-xs font-medium ${
        styles[status] ?? "bg-zinc-500/10 text-zinc-400 border-zinc-500/30"
      }`}
    >
      {status}
    </span>
  );
}

export function Card({
  label,
  value,
  sub,
}: {
  label: string;
  value: string;
  sub?: string;
}) {
  return (
    <div className="rounded-lg border border-zinc-800 bg-zinc-900/60 p-4">
      <div className="text-[11px] uppercase tracking-widest text-zinc-500">{label}</div>
      <div className="mt-1 text-2xl font-semibold text-zinc-100">{value}</div>
      {sub && <div className="mt-1 text-xs text-zinc-500">{sub}</div>}
    </div>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs text-zinc-400">{children}</span>;
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div className="rounded-lg border border-red-500/30 bg-red-500/5 p-4 text-sm text-red-300">
      <p className="font-medium">Could not reach the gateway</p>
      <p className="mt-1 font-mono text-xs">{error}</p>
      <p className="mt-2 text-xs text-red-400/80">
        Is the gateway running? <span className="font-mono">uvicorn app.main:app</span> — and
        check the API key in the top-right.
      </p>
    </div>
  );
}

export function Loading() {
  return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
}

const NAV = [
  { href: "/", label: "Runs" },
  { href: "/agents", label: "Agents" },
  { href: "/approvals", label: "Approvals" },
  { href: "/evals", label: "Evals" },
  { href: "/cost", label: "Cost" },
  { href: "/audit", label: "Audit" },
];

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const [showSettings, setShowSettings] = useState(false);
  const [url, setUrl] = useState("");
  const [key, setKey] = useState("");

  useEffect(() => {
    setUrl(apiUrl());
    setKey(apiKey());
  }, []);

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <header className="border-b border-zinc-800 bg-zinc-950/90 backdrop-blur sticky top-0 z-10">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" />
            <span className="text-sm font-semibold tracking-wide text-zinc-100">
              SENTINEL
            </span>
            <span className="hidden text-xs text-zinc-500 sm:inline">
              agent control plane
            </span>
          </Link>
          <nav className="flex gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded px-3 py-1.5 transition-colors ${
                  pathname === n.href
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <button
            onClick={() => setShowSettings((s) => !s)}
            className="ml-auto rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
          >
            API key
          </button>
        </div>
        {showSettings && (
          <div className="border-t border-zinc-800 bg-zinc-900/60">
            <div className="mx-auto flex max-w-6xl flex-wrap items-end gap-3 px-4 py-3">
              <label className="text-xs text-zinc-400">
                Gateway URL
                <input
                  value={url}
                  onChange={(e) => setUrl(e.target.value)}
                  className="mt-1 block w-72 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200"
                />
              </label>
              <label className="text-xs text-zinc-400">
                API key
                <input
                  value={key}
                  onChange={(e) => setKey(e.target.value)}
                  className="mt-1 block w-72 rounded border border-zinc-700 bg-zinc-950 px-2 py-1.5 font-mono text-xs text-zinc-200"
                />
              </label>
              <button
                onClick={() => {
                  setApiConfig(url.trim(), key.trim());
                  location.reload();
                }}
                className="rounded bg-sky-500 px-4 py-1.5 text-xs font-medium text-zinc-950 hover:bg-sky-400"
              >
                Save
              </button>
            </div>
          </div>
        )}
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
