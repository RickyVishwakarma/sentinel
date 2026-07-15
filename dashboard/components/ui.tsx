"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProviderStatus, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok: "bg-emerald-500/10 text-emerald-400 border-emerald-500/30",
    blocked: "bg-amber-500/10 text-amber-400 border-amber-500/30",
    pending_approval: "bg-violet-500/10 text-violet-400 border-violet-500/30",
    denied: "bg-red-500/10 text-red-400 border-red-500/30",
    error: "bg-red-500/10 text-red-400 border-red-500/30",
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

export function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
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
        Is the gateway running? <span className="font-mono">uvicorn app.main:app</span>
      </p>
    </div>
  );
}

export function Loading() {
  return <div className="p-8 text-sm text-zinc-500">Loading…</div>;
}

const NAV = [
  { href: "/overview", label: "Overview" },
  { href: "/runs", label: "Runs" },
  { href: "/agents", label: "Agents" },
  { href: "/policies", label: "Policies" },
  { href: "/approvals", label: "Approvals" },
  { href: "/evals", label: "Evals" },
  { href: "/cost", label: "Cost" },
  { href: "/audit", label: "Audit" },
];

const PUBLIC = ["/", "/login"];

function ProviderBadge() {
  const [live, setLive] = useState<string[] | null>(null);
  useEffect(() => {
    apiFetch<{ providers: ProviderStatus[] }>("/v1/providers")
      .then((d) => setLive(d.providers.filter((p) => p.available).map((p) => p.id)))
      .catch(() => setLive([]));
  }, []);
  if (live === null) return null;
  const real = live.filter((p) => p !== "template");
  const onlyTemplate = real.length === 0;
  return (
    <span
      title={onlyTemplate
        ? "No model key configured — running on the deterministic template provider. Add ANTHROPIC_API_KEY for real answers."
        : `Live providers: ${real.join(", ")}`}
      className={`rounded-full border px-2 py-0.5 text-xs ${
        onlyTemplate
          ? "border-amber-500/30 bg-amber-500/10 text-amber-400"
          : "border-emerald-500/30 bg-emerald-500/10 text-emerald-400"
      }`}
    >
      {onlyTemplate ? "template mode" : `live: ${real.join(", ")}`}
    </span>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading, logout } = useAuth();
  const isPublic = PUBLIC.includes(pathname);

  // Client-side route guard (hooks must run unconditionally — guard inside).
  useEffect(() => {
    if (!isPublic && !loading && !session) router.replace("/login");
  }, [isPublic, loading, session, router]);

  // Landing + login render bare (their own layout, no app chrome / no guard).
  if (isPublic) return <>{children}</>;
  if (loading) return <div className="p-10 text-sm text-zinc-500">Loading…</div>;
  if (!session) return null; // redirecting

  return (
    <div className="min-h-screen bg-zinc-950 text-zinc-200">
      <header className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/90 backdrop-blur">
        <div className="mx-auto flex max-w-6xl items-center gap-6 px-4 py-3">
          <Link href="/overview" className="flex items-center gap-2">
            <span className="inline-block h-2.5 w-2.5 rounded-sm bg-sky-400" />
            <span className="text-sm font-semibold tracking-wide text-zinc-100">SENTINEL</span>
          </Link>
          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((n) => (
              <Link
                key={n.href}
                href={n.href}
                className={`rounded px-3 py-1.5 transition-colors ${
                  pathname === n.href || (n.href !== "/overview" && pathname.startsWith(n.href))
                    ? "bg-zinc-800 text-zinc-100"
                    : "text-zinc-400 hover:bg-zinc-900 hover:text-zinc-200"
                }`}
              >
                {n.label}
              </Link>
            ))}
          </nav>
          <div className="ml-auto flex items-center gap-3">
            <ProviderBadge />
            <div className="hidden text-right sm:block">
              <div className="text-xs text-zinc-300">{session.email}</div>
              <div className="text-[10px] uppercase tracking-widest text-zinc-500">
                {session.tenant} · {session.role}
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="rounded border border-zinc-700 px-3 py-1.5 text-xs text-zinc-400 hover:bg-zinc-900"
            >
              Sign out
            </button>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-6xl px-4 py-6">{children}</main>
    </div>
  );
}
