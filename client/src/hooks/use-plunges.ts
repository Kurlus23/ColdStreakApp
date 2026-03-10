import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl, type PlungeInput } from "@shared/routes";

export function usePlunges() {
  return useQuery({
    queryKey: [api.plunges.list.path],
    queryFn: async () => {
      const res = await fetch(api.plunges.list.path, { credentials: "include" });
      if (!res.ok) throw new Error("Failed to fetch plunge history");
      return api.plunges.list.responses[200].parse(await res.json());
    },
  });
}

export function useCreatePlunge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: PlungeInput) => {
      const validated = api.plunges.create.input.parse(data);
      const res = await fetch(api.plunges.create.path, {
        method: api.plunges.create.method,
        headers: { "Content-Type": "application/json" },
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
    },
  });
}

export function useDeletePlunge() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(buildUrl(api.plunges.delete.path, { id }), {
        method: api.plunges.delete.method,
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to delete plunge");
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [api.plunges.list.path] });
    },
  });
}
