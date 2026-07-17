"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useClerk } from "@clerk/nextjs";
import { ProviderStatus, apiFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth";

/* Black-and-white minimal — the same system as the landing:
   white canvas, near-black text, Inter, tight negative letter-spacing,
   hairline borders, pill controls. */

const TEXT = "#0a0a0a";
const MUTED = "#6b6b6b";
const BORDER = "rgba(0,0,0,0.08)";

const FONT = { fontFamily: "var(--font-inter), system-ui, sans-serif" } as const;

export function StatusPill({ status }: { status: string }) {
  // Meaning still needs colour — but muted, to sit inside a B&W system.
  const styles: Record<string, string> = {
    ok: "border-[rgba(23,201,100,0.3)] bg-[rgba(23,201,100,0.1)] text-[#0a7d3c]",
    allow: "border-[rgba(23,201,100,0.3)] bg-[rgba(23,201,100,0.1)] text-[#0a7d3c]",
    approved: "border-[rgba(23,201,100,0.3)] bg-[rgba(23,201,100,0.1)] text-[#0a7d3c]",
    blocked: "border-[rgba(180,120,0,0.3)] bg-[rgba(180,120,0,0.1)] text-[#6b4700]",
    pending: "border-[rgba(180,120,0,0.3)] bg-[rgba(180,120,0,0.1)] text-[#6b4700]",
    pending_approval: "border-[rgba(180,120,0,0.3)] bg-[rgba(180,120,0,0.1)] text-[#6b4700]",
    denied: "border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.08)] text-[#b42318]",
    deny: "border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.08)] text-[#b42318]",
    error: "border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.08)] text-[#b42318]",
  };
  return (
    <span
      className={`inline-block rounded-full border px-2.5 py-0.5 text-xs font-semibold tracking-[-0.01em] ${
        styles[status] ?? "border-black/10 bg-black/[0.03] text-[#6b6b6b]"
      }`}
    >
      {status}
    </span>
  );
}

export function Card({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-2xl border p-5" style={{ borderColor: BORDER }}>
      <div
        className="text-[11px] font-semibold uppercase tracking-[0.08em]"
        style={{ color: MUTED }}
      >
        {label}
      </div>
      <div
        className="mt-2 text-3xl font-semibold tracking-[-0.05em]"
        style={{ color: TEXT }}
      >
        {value}
      </div>
      {sub && (
        <div className="mt-1 text-xs" style={{ color: MUTED }}>
          {sub}
        </div>
      )}
    </div>
  );
}

export function Mono({ children }: { children: React.ReactNode }) {
  return (
    <span className="font-mono text-xs tracking-normal" style={{ color: MUTED }}>
      {children}
    </span>
  );
}

export function ErrorBox({ error }: { error: string }) {
  return (
    <div
      className="rounded-2xl border p-5 text-sm"
      style={{ borderColor: "rgba(180,35,24,0.25)", background: "rgba(180,35,24,0.04)" }}
    >
      <p className="font-semibold text-[#b42318]">Could not reach the gateway</p>
      <p className="mt-1 font-mono text-xs text-[#b42318]/80">{error}</p>
      <p className="mt-2 text-xs" style={{ color: MUTED }}>
        Is the gateway running? <span className="font-mono">uvicorn app.main:app</span>
      </p>
    </div>
  );
}

export function Loading() {
  return (
    <div className="p-8 text-sm" style={{ color: MUTED }}>
      Loading…
    </div>
  );
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

// Public/marketing + Clerk auth routes render bare (own chrome, no app guard).
const PUBLIC = ["/", "/login", "/product", "/pricing", "/faq", "/contact"];
const PUBLIC_PREFIXES = ["/sign-in", "/sign-up"];

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
          ? "No model key configured — running on the deterministic template provider."
          : `Live providers: ${real.join(", ")}`
      }
      className={`rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
        onlyTemplate
          ? "border-[rgba(180,120,0,0.3)] bg-[rgba(180,120,0,0.1)] text-[#6b4700]"
          : "border-[rgba(23,201,100,0.3)] bg-[rgba(23,201,100,0.1)] text-[#0a7d3c]"
      }`}
    >
      {onlyTemplate ? "template mode" : `live: ${real.join(", ")}`}
    </span>
  );
}

export function Shell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const { session, loading, error, logout } = useAuth();
  const { signOut } = useClerk();
  const isPublic =
    PUBLIC.includes(pathname) || PUBLIC_PREFIXES.some((p) => pathname.startsWith(p));

  if (isPublic) return <>{children}</>;

  // Clerk's middleware already bounces signed-out visitors to /sign-in, so a
  // missing session here means the key exchange is still in flight or failed —
  // never a reason to redirect (that's what caused the sign-in loop).
  if (loading)
    return (
      <div className="min-h-screen bg-white p-10 text-sm" style={{ ...FONT, color: MUTED }}>
        Loading…
      </div>
    );

  if (!session)
    return (
      <div
        className="min-h-screen bg-white p-10"
        style={{ ...FONT, color: TEXT, letterSpacing: "-0.02em" }}
      >
        <div className="mx-auto max-w-lg">
          <ErrorBox error={error ?? "could not establish a gateway session"} />
          <button
            onClick={() => signOut({ redirectUrl: "/" })}
            className="mt-4 rounded-full border px-4 py-1.5 text-xs font-medium"
            style={{ borderColor: BORDER, color: MUTED }}
          >
            Sign out
          </button>
        </div>
      </div>
    );

  return (
    <div
      style={{ ...FONT, color: TEXT, letterSpacing: "-0.02em" }}
      className="min-h-screen bg-white"
    >
      <header
        className="sticky top-0 z-20 border-b bg-white/80 backdrop-blur-xl"
        style={{ borderColor: BORDER }}
      >
        <div className="mx-auto flex max-w-6xl items-center gap-5 px-6 py-3.5">
          <Link
            href="/"
            className="text-[22px] font-semibold italic tracking-[-0.08em]"
            style={{ fontFamily: "var(--font-source-serif), Georgia, serif", color: TEXT }}
          >
            Sentinel
            <sup
              className="ml-0.5 align-super text-[10px] font-semibold not-italic"
              style={{ fontFamily: "var(--font-inter), sans-serif" }}
            >
              ®
            </sup>
          </Link>

          <nav className="flex flex-wrap gap-0.5 text-sm">
            {NAV.map((n) => {
              const active =
                pathname === n.href || (n.href !== "/overview" && pathname.startsWith(n.href));
              return (
                <Link
                  key={n.href}
                  href={n.href}
                  className={`rounded-full px-3.5 py-1.5 font-medium tracking-[-0.02em] transition-colors ${
                    active ? "bg-[#0a0a0a] text-white" : "hover:bg-black/[0.04]"
                  }`}
                  style={active ? undefined : { color: MUTED }}
                >
                  {n.label}
                </Link>
              );
            })}
          </nav>

          <div className="ml-auto flex items-center gap-3">
            <ProviderBadge />
            <div className="hidden text-right sm:block">
              <div className="text-xs font-semibold" style={{ color: TEXT }}>
                {session.email}
              </div>
              <div
                className="text-[10px] font-semibold uppercase tracking-[0.08em]"
                style={{ color: MUTED }}
              >
                {session.tenant} · {session.role}
              </div>
            </div>
            <button
              onClick={async () => {
                logout(); // clear the cached gateway session first
                await signOut({ redirectUrl: "/" });
              }}
              className="rounded-full border px-4 py-1.5 text-xs font-medium transition-colors hover:bg-black/[0.04]"
              style={{ borderColor: BORDER, color: MUTED }}
            >
              Sign out
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-6xl px-6 py-8">{children}</main>
    </div>
  );
}
