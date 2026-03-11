import { useState, useCallback } from "react";
import { apiRequest } from "@/lib/queryClient";

const TOKEN_KEY = "coldstreak-auth-token";
const USER_KEY = "coldstreak-auth-user";

export interface AuthUser {
  id: number;
  email: string;
  emailVerified: boolean;
}

function loadUser(): AuthUser | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function getAuthToken(): string | null {
  return localStorage.getItem(TOKEN_KEY);
}

export function useAuth() {
  const [user, setUser] = useState<AuthUser | null>(loadUser);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const persist = (token: string, u: AuthUser) => {
    localStorage.setItem(TOKEN_KEY, token);
    localStorage.setItem(USER_KEY, JSON.stringify(u));
    setUser(u);
  };

  const updateUser = useCallback((patch: Partial<AuthUser>) => {
    setUser(prev => {
      if (!prev) return prev;
      const updated = { ...prev, ...patch };
      localStorage.setItem(USER_KEY, JSON.stringify(updated));
      return updated;
    });
  }, []);

  const register = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/auth/register", { email, password });
      const data = await res.json();
      persist(data.token, data.user);
      return true;
    } catch (err: any) {
      const msg = await extractMessage(err);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const login = useCallback(async (email: string, password: string): Promise<boolean> => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiRequest("POST", "/api/auth/login", { email, password });
      const data = await res.json();
      persist(data.token, data.user);
      return true;
    } catch (err: any) {
      const msg = await extractMessage(err);
      setError(msg);
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const logout = useCallback(() => {
    localStorage.removeItem(TOKEN_KEY);
    localStorage.removeItem(USER_KEY);
    setUser(null);
    setError(null);
  }, []);

  const syncLocalData = useCallback(async (clientId: string): Promise<boolean> => {
    const token = getAuthToken();
    if (!token || !clientId) return false;
    setLoading(true);
    try {
      await fetch("/api/auth/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
        body: JSON.stringify({ clientId }),
      });
      return true;
    } catch {
      return false;
    } finally {
      setLoading(false);
    }
  }, []);

  const resendVerification = useCallback(async (): Promise<boolean> => {
    const token = getAuthToken();
    if (!token) return false;
    try {
      await fetch("/api/auth/resend-verification", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}` },
      });
      return true;
    } catch {
      return false;
    }
  }, []);

  const clearError = useCallback(() => setError(null), []);

  return { user, loading, error, register, login, logout, syncLocalData, resendVerification, updateUser, clearError };
}

async function extractMessage(err: unknown): Promise<string> {
  if (err instanceof Error) {
    const m = err.message;
    const colonIdx = m.indexOf(": ");
    if (colonIdx !== -1) {
      try {
        const json = JSON.parse(m.slice(colonIdx + 2));
        if (json?.message) return json.message;
      } catch {}
      return m.slice(colonIdx + 2);
    }
    return m;
  }
  return "Something went wrong";
}
