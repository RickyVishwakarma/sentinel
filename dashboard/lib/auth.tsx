"use client";

import { createContext, useCallback, useContext, useEffect, useState } from "react";
import { useAuth as useClerkAuth } from "@clerk/nextjs";
import { apiUrl } from "@/lib/api";

/* Clerk owns the human identity; Sentinel still owns tenant + role.
   On load we hand Clerk's session token to the gateway, which verifies it and
   hands back the tenant's API key — the credential every other call already
   uses. Machines skip all of this and present an API key directly. */

export interface Session {
  api_key: string;
  email: string;
  name?: string | null;
  avatar_url?: string | null;
  role: string;
  tenant: string;
  tenant_id: string;
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  error: string | null;
  logout: () => void;
}

const KEY = "sentinel_session";
const AuthContext = createContext<AuthState | null>(null);

function readSession(): Session | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Session) : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const { isLoaded, isSignedIn, getToken } = useClerkAuth();
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isLoaded) return;

    // Signed out of Clerk → drop any cached gateway session.
    if (!isSignedIn) {
      localStorage.removeItem(KEY);
      setSession(null);
      setLoading(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const token = await getToken();
        if (!token) throw new Error("no Clerk session token");
        const res = await fetch(`${apiUrl()}/v1/auth/clerk`, {
          method: "POST",
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!res.ok) {
          let detail = res.statusText;
          try {
            detail = (await res.json()).detail ?? detail;
          } catch {}
          throw new Error(detail);
        }
        const s = (await res.json()) as Session;
        if (cancelled) return;
        localStorage.setItem(KEY, JSON.stringify(s));
        setSession(s);
        setError(null);
      } catch (e) {
        if (cancelled) return;
        // Gateway down? Keep any cached session so the UI can still render and
        // surface its own error, rather than bouncing to sign-in.
        const cached = readSession();
        setSession(cached);
        if (!cached) setError(String((e as Error).message ?? e));
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [isLoaded, isSignedIn, getToken]);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading: loading || !isLoaded, error, logout }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth must be used within AuthProvider");
  return ctx;
}

/** Read the active session's API key (used by lib/api.ts for requests). */
export function sessionApiKey(): string | null {
  return readSession()?.api_key ?? null;
}
