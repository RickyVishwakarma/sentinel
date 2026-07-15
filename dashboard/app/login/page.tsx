"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";
import { useAuth } from "@/lib/auth";
import { apiUrl, setApiUrl } from "@/lib/api";

export default function LoginPage() {
  const router = useRouter();
  const { session, login } = useAuth();
  const [email, setEmail] = useState("admin@sentinel.dev");
  const [password, setPassword] = useState("");
  const [gateway, setGateway] = useState("");
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    setGateway(apiUrl());
  }, []);
  useEffect(() => {
    if (session) router.replace("/overview");
  }, [session, router]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setErr(null);
    try {
      if (gateway.trim()) setApiUrl(gateway.trim());
      await login(email.trim().toLowerCase(), password);
      router.replace("/overview");
    } catch (e) {
      setErr(String((e as Error).message ?? e));
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      style={{ fontFamily: "var(--font-jakarta), system-ui, sans-serif" }}
      className="relative flex min-h-screen items-center justify-center overflow-hidden bg-[#fff9ee] px-4 text-[#1d1c15]"
    >
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-[#38BDF8]/15 via-[#C084FC]/10 to-[#fff9ee]" />
      <div className="absolute left-1/3 top-1/4 -z-10 h-72 w-72 rounded-full bg-[#FF5E3A]/10 blur-3xl" />

      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center justify-center gap-2">
          <span className="grid h-8 w-8 place-items-center rounded-full bg-gradient-to-br from-[#FF5E3A] to-[#FF2A6D] text-white">
            <svg className="h-4 w-4" viewBox="0 0 24 24" fill="none">
              <path d="M12 3l7 4v5c0 4.5-3 7.5-7 9-4-1.5-7-4.5-7-9V7l7-4z" stroke="currentColor" strokeWidth="2" strokeLinejoin="round" />
            </svg>
          </span>
          <span className="text-xl font-extrabold tracking-tight">Sentinel</span>
        </Link>

        <div className="rounded-3xl border border-white/60 bg-white/50 p-8 shadow-[0_8px_32px_rgba(159,65,34,0.08)] backdrop-blur-xl">
          <h1 className="text-2xl font-extrabold tracking-tight">Sign in</h1>
          <p className="mt-1 text-sm text-[#56423c]">Access the control plane for your tenant.</p>

          <form onSubmit={submit} className="mt-6 space-y-4">
            <label className="block text-xs font-semibold text-[#56423c]">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="mt-1.5 block w-full rounded-full border border-white/70 bg-white/70 px-4 py-2.5 text-sm text-[#1d1c15] shadow-sm outline-none focus:border-[#FF5E3A]/50"
              />
            </label>
            <label className="block text-xs font-semibold text-[#56423c]">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1.5 block w-full rounded-full border border-white/70 bg-white/70 px-4 py-2.5 text-sm text-[#1d1c15] shadow-sm outline-none focus:border-[#FF5E3A]/50"
              />
            </label>
            <details className="text-xs text-[#89726b]">
              <summary className="cursor-pointer hover:text-[#56423c]">Gateway URL</summary>
              <input
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                className="mt-2 block w-full rounded-full border border-white/70 bg-white/70 px-4 py-2 font-mono text-xs text-[#56423c] outline-none focus:border-[#FF5E3A]/50"
              />
            </details>

            {err && (
              <p className="rounded-2xl border border-[#ba1a1a]/20 bg-[#ffdad6]/50 px-3 py-2 font-mono text-xs text-[#93000a]">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full rounded-full bg-gradient-to-br from-[#FF5E3A] to-[#FF2A6D] px-4 py-3 text-sm font-semibold text-white shadow-[0_8px_24px_rgba(255,94,58,0.25)] transition-transform hover:scale-[1.02] disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[#89726b]">
          Demo tenant seeded by{" "}
          <span className="font-mono text-[#56423c]">python -m app.seed</span> — password{" "}
          <span className="font-mono text-[#56423c]">sentinel123</span>.
        </p>
      </div>
    </div>
  );
}
