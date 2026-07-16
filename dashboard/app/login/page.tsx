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
      style={{
        fontFamily: "var(--font-inter), system-ui, sans-serif",
        letterSpacing: "-0.02em",
      }}
      className="flex min-h-screen items-center justify-center bg-white px-4 text-[#0a0a0a]"
    >
      <div className="w-full max-w-sm">
        <Link
          href="/"
          className="mb-10 block text-center text-[30px] font-semibold italic tracking-[-0.08em]"
          style={{ fontFamily: "var(--font-source-serif), Georgia, serif" }}
        >
          Sentinel
          <sup
            className="ml-0.5 align-super text-[14px] font-semibold not-italic"
            style={{ fontFamily: "var(--font-inter), sans-serif" }}
          >
            ®
          </sup>
        </Link>

        <div className="rounded-3xl border border-black/[0.08] p-8">
          <h1 className="text-[28px] font-semibold tracking-[-0.05em]">Sign in</h1>
          <p className="mt-1 text-sm text-[#6b6b6b]">Access the control plane for your tenant.</p>

          <form onSubmit={submit} className="mt-7 space-y-4">
            <label className="block text-xs font-semibold text-[#6b6b6b]">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="mt-1.5 block w-full rounded-full border border-black/10 bg-[#fbfbfb] px-4 py-2.5 text-sm text-[#0a0a0a] outline-none transition-colors focus:border-[#0a0a0a]"
              />
            </label>
            <label className="block text-xs font-semibold text-[#6b6b6b]">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1.5 block w-full rounded-full border border-black/10 bg-[#fbfbfb] px-4 py-2.5 text-sm text-[#0a0a0a] outline-none transition-colors focus:border-[#0a0a0a]"
              />
            </label>
            <details className="text-xs text-[#9b9b9b]">
              <summary className="cursor-pointer hover:text-[#0a0a0a]">Gateway URL</summary>
              <input
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                className="mt-2 block w-full rounded-full border border-black/10 bg-[#fbfbfb] px-4 py-2 font-mono text-xs tracking-normal text-[#6b6b6b] outline-none focus:border-[#0a0a0a]"
              />
            </details>

            {err && (
              <p className="rounded-2xl border border-[rgba(180,35,24,0.25)] bg-[rgba(180,35,24,0.04)] px-3 py-2 font-mono text-xs text-[#b42318]">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full rounded-full bg-[#0a0a0a] px-4 py-3.5 text-sm font-semibold text-white transition-all hover:-translate-y-px hover:shadow-[0_4px_20px_rgba(0,0,0,0.12)] disabled:opacity-40"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-5 text-center text-xs text-[#9b9b9b]">
          Demo tenant seeded by{" "}
          <span className="font-mono tracking-normal text-[#6b6b6b]">python -m app.seed</span> —
          password <span className="font-mono tracking-normal text-[#6b6b6b]">sentinel123</span>.
        </p>
      </div>
    </div>
  );
}
