import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface ProUser {
  id: number;
  email: string;
  active: boolean;
  planType: string;
  foundingPlunger: boolean;
  stripeSessionId: string | null;
  stripeSubscriptionId: string | null;
  expiresAt: string | null;
  createdAt: string;
}

export default function Admin() {
  const { toast } = useToast();
  const token = localStorage.getItem("coldstreak-token");

  const { data: proUsers, isLoading, error } = useQuery<ProUser[]>({
    queryKey: ["/api/admin/pro-users"],
    enabled: !!token,
  });

  const toggleMutation = useMutation({
    mutationFn: ({ email, active }: { email: string; active: boolean }) =>
      apiRequest("PATCH", `/api/admin/pro-users/${encodeURIComponent(email)}`, { active }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pro-users"] });
      toast({ title: "Pro status updated" });
    },
    onError: () => {
      toast({ title: "Failed to update", description: "Are you logged in as admin?", variant: "destructive" });
    },
  });

  if (!token) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white">
        <p>Not logged in.</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white">
        <p>Access denied or server error.</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white p-6">
      <h1 className="text-2xl font-bold mb-6">Admin — Pro Users</h1>

      {isLoading && <p className="text-blue-300">Loading…</p>}

      {proUsers && proUsers.length === 0 && (
        <p className="text-blue-300">No pro users found.</p>
      )}

      <div className="flex flex-col gap-4 max-w-2xl">
        {proUsers?.map((u) => (
          <div
            key={u.id}
            data-testid={`admin-pro-user-${u.id}`}
            className="bg-blue-900/60 rounded-xl p-4 flex flex-col gap-2"
          >
            <div className="flex items-center justify-between gap-3 flex-wrap">
              <div>
                <p className="font-semibold text-sm">{u.email}</p>
                <p className="text-xs text-blue-300 mt-0.5">
                  {u.planType} {u.foundingPlunger && "· Founding Plunger"}
                  {u.expiresAt && ` · Expires ${new Date(u.expiresAt).toLocaleDateString()}`}
                </p>
              </div>
              <div className="flex items-center gap-3">
                <Badge
                  data-testid={`badge-active-${u.id}`}
                  className={u.active ? "bg-green-600 text-white" : "bg-red-600 text-white"}
                >
                  {u.active ? "Active" : "Inactive"}
                </Badge>
                <Button
                  data-testid={`btn-toggle-${u.id}`}
                  size="sm"
                  variant="outline"
                  className="border-blue-400 text-blue-200 hover:bg-blue-800"
                  disabled={toggleMutation.isPending}
                  onClick={() => toggleMutation.mutate({ email: u.email, active: !u.active })}
                >
                  {u.active ? "Deactivate" : "Activate"}
                </Button>
              </div>
            </div>
            {u.stripeSessionId && (
              <p className="text-xs text-blue-400 break-all">Session: {u.stripeSessionId}</p>
            )}
            {u.stripeSubscriptionId && (
              <p className="text-xs text-blue-400 break-all">Sub: {u.stripeSubscriptionId}</p>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
