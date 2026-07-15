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
    <div className="flex min-h-screen items-center justify-center bg-zinc-950 px-4">
      <div className="w-full max-w-sm">
        <Link href="/" className="mb-8 flex items-center gap-2">
          <span className="inline-block h-3 w-3 rounded-sm bg-sky-400" />
          <span className="text-sm font-semibold tracking-wide text-zinc-100">SENTINEL</span>
          <span className="text-xs text-zinc-500">agent control plane</span>
        </Link>

        <div className="rounded-xl border border-zinc-800 bg-zinc-900/60 p-6">
          <h1 className="text-lg font-semibold text-zinc-100">Sign in</h1>
          <p className="mt-1 text-xs text-zinc-500">
            Access the control plane for your tenant.
          </p>

          <form onSubmit={submit} className="mt-5 space-y-4">
            <label className="block text-xs text-zinc-400">
              Email
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="username"
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <label className="block text-xs text-zinc-400">
              Password
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="mt-1 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 text-sm text-zinc-100"
              />
            </label>
            <details className="text-xs text-zinc-500">
              <summary className="cursor-pointer hover:text-zinc-300">Gateway URL</summary>
              <input
                value={gateway}
                onChange={(e) => setGateway(e.target.value)}
                className="mt-2 block w-full rounded border border-zinc-700 bg-zinc-950 px-3 py-2 font-mono text-xs text-zinc-300"
              />
            </details>

            {err && (
              <p className="rounded border border-red-500/30 bg-red-500/5 px-3 py-2 font-mono text-xs text-red-400">
                {err}
              </p>
            )}

            <button
              type="submit"
              disabled={busy || !email || !password}
              className="w-full rounded bg-sky-500 px-4 py-2 text-sm font-medium text-zinc-950 hover:bg-sky-400 disabled:opacity-50"
            >
              {busy ? "Signing in…" : "Sign in"}
            </button>
          </form>
        </div>

        <p className="mt-4 text-center text-xs text-zinc-600">
          Demo tenant seeded by{" "}
          <span className="font-mono text-zinc-500">python -m app.seed</span> — password{" "}
          <span className="font-mono text-zinc-500">sentinel123</span>.
        </p>
      </div>
    </div>
  );
}
