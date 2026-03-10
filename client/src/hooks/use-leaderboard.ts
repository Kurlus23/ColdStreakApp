import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { api, buildUrl } from "@shared/routes";
import { type LeaderboardEntry } from "@shared/schema";

export function useLeaderboard(locationId: string | null) {
  return useQuery<LeaderboardEntry[]>({
    queryKey: ["/api/leaderboard", locationId],
    enabled: !!locationId,
    queryFn: async () => {
      const res = await fetch(buildUrl(api.leaderboard.list.path, { locationId: locationId! }), {
        credentials: "include",
      });
      if (!res.ok) throw new Error("Failed to fetch leaderboard");
      return res.json();
    },
  });
}

export function useSubmitLeaderboard() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (entry: {
      locationId: string;
      username: string;
      score: number | string;
      duration: number;
      temperature: number;
    }) => {
      const res = await fetch(api.leaderboard.submit.path, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ ...entry, score: String(entry.score) }),
      });
      if (!res.ok) throw new Error("Failed to submit to leaderboard");
      return res.json();
    },
    onSuccess: (_, vars) => {
      queryClient.invalidateQueries({ queryKey: ["/api/leaderboard", vars.locationId] });
    },
  });
}
