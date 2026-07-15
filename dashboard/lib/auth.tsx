"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import { apiUrl } from "@/lib/api";

export interface Session {
  api_key: string;
  email: string;
  role: string;
  tenant: string;
  tenant_id: string;
}

interface AuthState {
  session: Session | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
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
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Restore + validate the stored session against the gateway on load.
    const stored = readSession();
    if (!stored) {
      setLoading(false);
      return;
    }
    fetch(`${apiUrl()}/v1/auth/me`, {
      headers: { Authorization: `Bearer ${stored.api_key}` },
    })
      .then((r) => (r.ok ? stored : null))
      .catch(() => stored) // gateway down ≠ logged out; keep the session
      .then((s) => setSession(s))
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (email: string, password: string) => {
    const res = await fetch(`${apiUrl()}/v1/auth/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ email, password }),
    });
    if (!res.ok) {
      let detail = "login failed";
      try {
        detail = (await res.json()).detail ?? detail;
      } catch {}
      throw new Error(detail);
    }
    const s = (await res.json()) as Session;
    localStorage.setItem(KEY, JSON.stringify(s));
    setSession(s);
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(KEY);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ session, loading, login, logout }}>
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
