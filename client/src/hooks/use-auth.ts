import { useState, useCallback, useEffect } from "react";
import { apiRequest, queryClient } from "@/lib/queryClient";

const TOKEN_KEY = "coldstreak-auth-token";
const USER_KEY = "coldstreak-auth-user";

export interface AuthUser {
  id: number;
  email: string;
  emailVerified: boolean;
  isAdmin?: boolean;
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

  useEffect(() => {
    const handler = () => {
      setUser(null);
      queryClient.clear();
    };
    window.addEventListener("coldstreak:force-logout", handler);
    return () => window.removeEventListener("coldstreak:force-logout", handler);
  }, []);

  // On mount: silently validate the stored token against the server.
  // If expired or revoked, clear auth state immediately so the user
  // is never stuck in a "logged in but nothing works" state.
  useEffect(() => {
    const token = localStorage.getItem(TOKEN_KEY);
    if (!token) return;
    fetch("/api/auth/me", { headers: { Authorization: `Bearer ${token}` } })
      .then(res => {
        if (res.status === 401) {
          localStorage.removeItem(TOKEN_KEY);
          localStorage.removeItem(USER_KEY);
          setUser(null);
          queryClient.clear();
        } else if (res.ok) {
          res.json().then((fresh: AuthUser) => {
            localStorage.setItem(USER_KEY, JSON.stringify(fresh));
            setUser(fresh);
          });
        }
      })
      .catch(() => { /* network offline — keep existing state */ });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
    localStorage.removeItem("coldstreak-is-pro");
    localStorage.removeItem("coldstreak-pro-email");
    setUser(null);
    setError(null);
    // Drop all cached server data so the next account on this device cannot
    // see the previous user's listings, dashboards, badges, etc.
    queryClient.clear();
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
