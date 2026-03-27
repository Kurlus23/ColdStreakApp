import { useState } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
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
  const auth = useAuth();

  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");

  const { data: proUsers, isLoading, error } = useQuery<ProUser[]>({
    queryKey: ["/api/admin/pro-users"],
    enabled: !!auth.user,
  });

  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [verifySessionId, setVerifySessionId] = useState("");
  const [overrideEmail, setOverrideEmail] = useState("");
  const [overridePlan, setOverridePlan] = useState<"monthly" | "annual" | "lifetime" | "promo">("monthly");
  const [showOverride, setShowOverride] = useState(false);

  const verifySessionMutation = useMutation({
    mutationFn: async (sessionId: string) => {
      const res = await fetch(`/api/stripe/verify?session_id=${encodeURIComponent(sessionId)}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pro-users"] });
      setVerifySessionId("");
      toast({ title: "Payment verified ✓", description: `${data.email} granted ${data.planType} pro.` });
    },
    onError: (err: Error) => {
      toast({ title: "Verification failed", description: err.message, variant: "destructive" });
    },
  });

  const overrideMutation = useMutation({
    mutationFn: ({ email, planType }: { email: string; planType: string }) =>
      apiRequest("POST", "/api/admin/pro-users", { email, planType }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pro-users"] });
      setOverrideEmail("");
      toast({ title: "Override applied", description: `${overrideEmail} granted ${overridePlan} (no payment check).` });
    },
    onError: (err: any) => {
      toast({ title: "Override failed", description: err?.message ?? "Server error", variant: "destructive" });
    },
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

  const deleteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(`/api/admin/pro-users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: {
          Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}`,
        },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pro-users"] });
      setConfirmDelete(null);
      toast({ title: "Pro record deleted", description: "User can now purchase fresh." });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const handleLogin = async () => {
    setLoginError("");
    const ok = await auth.login(username, password);
    if (!ok) setLoginError(auth.error ?? "Login failed. Check credentials.");
  };

  if (!auth.user) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center px-5">
        <div className="w-full max-w-sm bg-blue-900/80 rounded-2xl border border-blue-700/50 p-6 space-y-4">
          <h1 className="text-xl font-extrabold italic text-white text-center">ColdStreak Admin</h1>
          <p className="text-blue-400 text-sm text-center">Sign in to continue</p>

          <input
            data-testid="input-admin-username"
            type="text"
            placeholder="Username"
            autoCapitalize="none"
            autoCorrect="off"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && document.getElementById("admin-password")?.focus()}
            className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
          />
          <input
            id="admin-password"
            data-testid="input-admin-password"
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLogin()}
            className="w-full bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2.5 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
          />

          {loginError && <p className="text-red-400 text-xs">{loginError}</p>}

          <button
            data-testid="button-admin-login"
            onClick={handleLogin}
            disabled={auth.loading || !username || !password}
            className="w-full py-2.5 rounded-xl bg-cyan-500 hover:bg-cyan-400 text-blue-950 text-sm font-bold transition-colors disabled:opacity-50"
          >
            {auth.loading ? "Signing in…" : "Sign In"}
          </button>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white">
        <div className="text-center space-y-3">
          <p className="text-red-400">Access denied — admin accounts only.</p>
          <button
            onClick={() => { auth.logout(); }}
            className="text-blue-400 text-sm underline hover:text-blue-300"
          >Sign out</button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-blue-950 text-white p-6">
      <div className="flex items-center justify-between mb-6 max-w-2xl">
        <h1 className="text-2xl font-bold">Admin — Pro Users</h1>
        <button
          data-testid="button-admin-signout"
          onClick={() => auth.logout()}
          className="text-blue-400 text-xs hover:text-red-400 transition-colors"
        >Sign out</button>
      </div>

      {/* Verify Stripe payment and grant Pro */}
      <div className="mb-4 max-w-2xl bg-blue-900/60 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-200 mb-1">Verify Stripe Payment → Grant Pro</p>
        <p className="text-xs text-blue-400 mb-3">Paste the Stripe session ID (cs_…) from the Stripe dashboard. Pro is only granted if Stripe confirms payment.</p>
        <div className="flex gap-2 flex-wrap">
          <input
            data-testid="input-verify-session"
            type="text"
            placeholder="cs_test_… or cs_live_…"
            value={verifySessionId}
            onChange={(e) => setVerifySessionId(e.target.value.trim())}
            className="flex-1 min-w-0 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <Button
            data-testid="button-verify-session"
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
            disabled={verifySessionMutation.isPending || !verifySessionId.startsWith("cs_")}
            onClick={() => verifySessionMutation.mutate(verifySessionId)}
          >
            {verifySessionMutation.isPending ? "Verifying…" : "Verify & Grant"}
          </Button>
        </div>
      </div>

      {/* Admin override — no Stripe check */}
      <div className="mb-6 max-w-2xl">
        <button
          className="text-xs text-yellow-500/70 hover:text-yellow-400 underline"
          onClick={() => setShowOverride((v) => !v)}
        >
          {showOverride ? "Hide" : "Show"} admin override (no payment verification)
        </button>
        {showOverride && (
          <div className="mt-3 bg-yellow-900/30 border border-yellow-600/40 rounded-xl p-4">
            <p className="text-xs text-yellow-400 mb-3">⚠️ Bypass Stripe — use only for refunds, gifts, or support cases where payment is confirmed externally.</p>
            <div className="flex gap-2 flex-wrap">
              <input
                data-testid="input-override-email"
                type="email"
                placeholder="user@example.com"
                value={overrideEmail}
                onChange={(e) => setOverrideEmail(e.target.value)}
                className="flex-1 min-w-0 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
              />
              <select
                data-testid="select-override-plan"
                value={overridePlan}
                onChange={(e) => setOverridePlan(e.target.value as typeof overridePlan)}
                className="bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm focus:outline-none focus:border-cyan-400"
              >
                <option value="monthly">Monthly</option>
                <option value="annual">Annual</option>
                <option value="lifetime">Lifetime</option>
                <option value="promo">Promo</option>
              </select>
              <Button
                data-testid="button-override-grant"
                size="sm"
                className="bg-yellow-600 hover:bg-yellow-500 text-white"
                disabled={overrideMutation.isPending || !overrideEmail.includes("@")}
                onClick={() => overrideMutation.mutate({ email: overrideEmail.trim(), planType: overridePlan })}
              >
                {overrideMutation.isPending ? "Applying…" : "Override Grant"}
              </Button>
            </div>
          </div>
        )}
      </div>

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
              <div className="flex items-center gap-2 flex-wrap">
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
                  disabled={toggleMutation.isPending || deleteMutation.isPending}
                  onClick={() => toggleMutation.mutate({ email: u.email, active: !u.active })}
                >
                  {u.active ? "Deactivate" : "Activate"}
                </Button>
                {confirmDelete === u.email ? (
                  <div className="flex items-center gap-1">
                    <Button
                      data-testid={`btn-confirm-delete-${u.id}`}
                      size="sm"
                      className="bg-red-600 hover:bg-red-500 text-white"
                      disabled={deleteMutation.isPending}
                      onClick={() => deleteMutation.mutate(u.email)}
                    >
                      {deleteMutation.isPending ? "Cancelling & Deleting…" : "Yes, Cancel & Delete"}
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      className="border-blue-600 text-blue-300"
                      onClick={() => setConfirmDelete(null)}
                    >
                      Cancel
                    </Button>
                  </div>
                ) : (
                  <Button
                    data-testid={`btn-delete-${u.id}`}
                    size="sm"
                    variant="outline"
                    className="border-red-700/50 text-red-400 hover:bg-red-900/30 hover:border-red-500"
                    disabled={toggleMutation.isPending || deleteMutation.isPending}
                    onClick={() => setConfirmDelete(u.email)}
                  >
                    Delete
                  </Button>
                )}
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
