import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type PlungeInput, type PlungeUpdateInput } from "@shared/routes";
import { getAuthToken } from "@/hooks/use-auth";
import { Capacitor } from "@capacitor/core";

const REVIEW_COUNT_KEY = "coldstreak-plunge-saved-count";
const REVIEW_PROMPTED_KEY = "coldstreak-review-prompted";
const REVIEW_TRIGGER_COUNT = 3;

async function maybeRequestReview() {
  try {
    if (!Capacitor.isNativePlatform()) return;
    const count = Number(localStorage.getItem(REVIEW_COUNT_KEY) ?? 0) + 1;
    localStorage.setItem(REVIEW_COUNT_KEY, String(count));
    if (count === REVIEW_TRIGGER_COUNT && !localStorage.getItem(REVIEW_PROMPTED_KEY)) {
      localStorage.setItem(REVIEW_PROMPTED_KEY, "true");
      const { InAppReview } = await import("@capacitor-community/in-app-review");
      await InAppReview.requestReview();
    }
  } catch {
    // silently ignore — review prompt is best-effort
  }
}

export function getClientId(): string {
  const KEY = "coldstreak-client-id";
  let id = localStorage.getItem(KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(KEY, id);
  }
  return id;
}

function buildHeaders(extra?: Record<string, string>): Record<string, string> {
  const token = getAuthToken();
  const headers: Record<string, string> = { ...(extra || {}) };
  if (token) headers["Authorization"] = `Bearer ${token}`;
  return headers;
}

export function usePlunges() {
  return useQuery({
    queryKey: [api.plunges.list.path],
    queryFn: async () => {
      const token = getAuthToken();
      const clientId = getClientId();
      const url = token
        ? api.plunges.list.path
        : `${api.plunges.list.path}?clientId=${encodeURIComponent(clientId)}`;
      const res = await fetch(url, {
        credentials: "include",
        headers: buildHeaders(),
      });
      if (!res.ok) throw new Error("Failed to fetch plunge history");
      return api.plunges.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreatePlunge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlungeInput) => {
      const clientId = getClientId();
      const validated = api.plunges.create.input.parse({ ...data, clientId });
      const res = await fetch(api.plunges.create.path, {
        method: api.plunges.create.method,
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(validated),
        credentials: "include",
      });
      if (!res.ok) {
        if (res.status === 400) {
          const error = api.plunges.create.responses[400].parse(await res.json());
          throw new Error(error.message);
        }
        throw new Error("Failed to log plunge");
      }
      return api.plunges.create.responses[201].parse(await res.json());
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.plunges.list.path] });
      maybeRequestReview();
    },
  });
}

export function useUpdatePlunge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, patch }: { id: number; patch: PlungeUpdateInput }) => {
      const res = await fetch(buildUrl(api.plunges.update.path, { id }), {
        method: api.plunges.update.method,
        headers: buildHeaders({ "Content-Type": "application/json" }),
        body: JSON.stringify(patch),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to update plunge");
      return await res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.plunges.list.path] });
    },
  });
}

export function useDeletePlunge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.plunges.delete.path, { id }), {
        method: api.plunges.delete.method,
        headers: buildHeaders(),
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete plunge");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.plunges.list.path] });
    },
  });
}
