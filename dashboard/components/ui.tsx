"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { ProviderStatus, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/* Luminous Horizon theme, applied to the app chrome:
   warm off-white canvas, glassy blurred surfaces, sunset-orange accent. */

const ON = "#1d1c15";
const VAR = "#56423c";
const MUTED = "#89726b";
const PRIMARY = "#FF5E3A";

export const glass =
  "border border-white/60 bg-white/50 backdrop-blur-xl shadow-[0_8px_32px_rgba(159,65,34,0.05)]";

export function StatusPill({ status }: { status: string }) {
  const styles: Record<string, string> = {
    ok: "bg-emerald-500/10 text-emerald-700 border-emerald-600/25",
    allow: "bg-emerald-500/10 text-emerald-700 border-emerald-600/25",
    approved: "bg-emerald-500/10 text-emerald-700 border-emerald-600/25",
    blocked: "bg-amber-500/15 text-amber-700 border-amber-600/25",
    pending: "bg-violet-500/10 text-violet-700 border-violet-600/25",
    pending_approval: "bg-violet-500/10 text-violet-700 border-violet-600/25",
    denied: "bg-red-500/10 text-red-700 border-red-600/25",
    deny: "bg-red-500/10 text-red-700 border-red-600/25",
    error: "bg-red-500/10 text-red-700 border-red-600/25",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        styles[status] ?? "border-[#ddc0b8]/60 bg-black/5 text-[#56423c]"
      }`}
    >
      {status}
    </span>
  );
}

export function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className={`rounded-2xl p-5 ${glass}`}>
      <div className="text-[11px] font-bold uppercase tracking-[0.1em]" style={{ color: MUTED }}>
        {label}
      </div>
      <div className="mt-1.5 text-3xl font-extrabold tracking-tight" style={{ color: ON }}>
        {value}
      </div>
      {sub && <div className="mt-1 text-xs" style={{ color: MUTED }}>{sub}</div>}
    </div>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-xs" style={{ color: VAR }}>{children}</span>;
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div className="rounded-2xl border border-[#ba1a1a]/20 bg-[#ffdad6]/40 p-5 text-sm backdrop-blur-xl">
      <p className="font-semibold text-[#93000a]">Could not reach the gateway</p>
      <p className="mt-1 font-mono text-xs text-[#93000a]/80">{error}</p>
      <p className="mt-2 text-xs text-[#93000a]/70">
        Is the gateway running? <span className="font-mono">uvicorn app.main:app</span>
      </p>
    </div>
  );
}

export function Loading() {
  return <div className="p-8 text-sm" style={{ color: MUTED }}>Loading…</div>;
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
      title={
        onlyTemplate
          ? "No model key configured — running on the deterministic template provider. Add a provider key for real answers."
          : `Live providers: ${real.join(", ")}`
      }
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        onlyTemplate
          ? "border-amber-600/25 bg-amber-500/15 text-amber-700"
          : "border-emerald-600/25 bg-emerald-500/10 text-emerald-700"
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
  if (loading)
    return (
      <div className="min-h-screen bg-[#fff9ee] p-10 text-sm" style={{ color: MUTED }}>
        Loading…
      </div>
    );
  if (!session) return null; // redirecting

  return (
    <div
      style={{ fontFamily: "var(--font-jakarta), system-ui, sans-serif" }}
      className="relative min-h-screen bg-[#fff9ee]"
    >
      {/* soft atmospheric wash, matching the landing */}
      <div className="pointer-events-none fixed inset-0 -z-10 bg-gradient-to-b from-[#38BDF8]/10 via-[#C084FC]/5 to-transparent" />

      <header className="sticky top-0 z-20 border-b border-white/60 bg-white/50 backdrop-blur-xl">
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-4 py-3">
          <Link href="/overview" className="flex items-center gap-2">
            <span className="grid h-7 w-7 place-items-center rounded-full bg-gradient-to-br from-[#FF5E3A] to-[#FF2A6D] text-white">
              <svg className="h-3.5 w-3.5" viewBox="0 0 24 24" fill="none">
                <path
                  d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinejoin="round"
                />
              </svg>
            </span>
            <span className="text-base font-extrabold tracking-tight" style={{ color: ON }}>
              Sentinel
            </span>
          </Link>

          <nav className="flex flex-wrap gap-1 text-sm">
            {NAV.map((n) => {
              const active =
                pathname === n.href || (n.href !== "/overview" && pathname.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-full px-3.5 py-1.5 font-medium transition-colors ${
                    active
                      ? "border border-white/70 bg-white/80 shadow-sm"
                      : "hover:bg-white/50"
                  }`}
                  style={{ color: active ? PRIMARY : VAR }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ProviderBadge />
            <div className="hidden text-right sm:block">
              <div className="text-xs font-semibold" style={{ color: ON }}>
                {session.email}
              </div>
              <div className="text-[10px] font-bold uppercase tracking-[0.1em]" style={{ color: MUTED }}>
                {session.tenant} · {session.role}
              </div>
            </div>
            <button
              onClick={() => {
                logout();
                router.replace("/login");
              }}
              className="rounded-full border border-white/70 bg-white/50 px-4 py-1.5 text-xs font-medium shadow-sm transition-colors hover:bg-white/80"
              style={{ color: VAR }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-4 py-8">{children}</main>
    </div>
  );
}
