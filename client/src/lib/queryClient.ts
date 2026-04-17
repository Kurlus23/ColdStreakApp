import { QueryClient, QueryFunction } from "@tanstack/react-query";
import { getAuthToken } from "@/hooks/use-auth";

// Lazily read the per-device clientId so every API call carries it as a header
// (separate from the body/query so it works for plain GETs too).
function getStoredClientId(): string | null {
  try {
    const KEY = "coldstreak-client-id";
    let id = localStorage.getItem(KEY);
    if (!id) {
      id = (typeof crypto !== "undefined" && "randomUUID" in crypto)
        ? crypto.randomUUID()
        : `cs-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
      localStorage.setItem(KEY, id);
    }
    return id;
  } catch { return null; }
}

async function throwIfResNotOk(res: Response) {
  if (!res.ok) {
    const text = (await res.text()) || res.statusText;
    // If we have a stored token but the server says 401, the token is
    // expired or revoked — clear auth state immediately so the user
    // isn't stuck in a "logged in but nothing works" state.
    if (res.status === 401 && localStorage.getItem("coldstreak-auth-token")) {
      localStorage.removeItem("coldstreak-auth-token");
      localStorage.removeItem("coldstreak-auth-user");
      window.dispatchEvent(new Event("coldstreak:force-logout"));
    }
    throw new Error(`${res.status}: ${text}`);
  }
}

function authHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...(extra || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  const cid = getStoredClientId();
  if (cid) headers["X-Client-Id"] = cid;
  return headers;
}

export async function apiRequest(
  method: string,
  url: string,
  data?: unknown | undefined,
): Promise<Response> {
  const res = await fetch(url, {
    method,
    headers: authHeaders(data ? { "Content-Type": "application/json" } : {}),
    body: data ? JSON.stringify(data) : undefined,
    credentials: "include",
  });

  await throwIfResNotOk(res);
  return res;
}

type UnauthorizedBehavior = "returnNull" | "throw";
export const getQueryFn: <T>(options: {
  on401: UnauthorizedBehavior;
}) => QueryFunction<T> =
  ({ on401: unauthorizedBehavior }) =>
  async ({ queryKey }) => {
    const res = await fetch(queryKey.join("/") as string, {
      credentials: "include",
      headers: authHeaders(),
    });

    if (unauthorizedBehavior === "returnNull" && res.status === 401) {
      return null;
    }

    await throwIfResNotOk(res);
    return await res.json();
  };

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      queryFn: getQueryFn({ on401: "throw" }),
      refetchInterval: false,
      refetchOnWindowFocus: false,
      staleTime: Infinity,
      retry: false,
    },
    mutations: {
      retry: false,
    },
  },
});
