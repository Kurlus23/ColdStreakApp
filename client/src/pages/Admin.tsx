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

interface LookupResult {
  email: string;
  dbRecord: ProUser | null;
  stripeSubscriptions: {
    subscriptionId: string;
    status: string;
    planType: string;
    currentPeriodEnd: string;
    customerId: string;
    customerEmail: string | null;
  }[];
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

  // Email lookup
  const [lookupEmail, setLookupEmail] = useState("");
  const [lookupResult, setLookupResult] = useState<LookupResult | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);

  const handleLookup = async () => {
    if (!lookupEmail.includes("@")) return;
    setLookupLoading(true);
    setLookupResult(null);
    try {
      const res = await fetch(`/api/admin/lookup?email=${encodeURIComponent(lookupEmail.trim())}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.message ?? "Lookup failed");
      setLookupResult(data);
    } catch (err: any) {
      toast({ title: "Lookup failed", description: err.message, variant: "destructive" });
    } finally {
      setLookupLoading(false);
    }
  };

  // Verify Stripe ID (session cs_ or subscription sub_)
  const [verifyId, setVerifyId] = useState("");
  const [overrideEmail, setOverrideEmail] = useState("");
  const [overridePlan, setOverridePlan] = useState<"monthly" | "annual" | "lifetime" | "promo">("monthly");
  const [showOverride, setShowOverride] = useState(false);

  const isSubId = verifyId.startsWith("sub_");
  const isSessionId = verifyId.startsWith("cs_");

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      if (id.startsWith("sub_")) {
        const res = await fetch("/api/admin/verify-subscription", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}`,
          },
          body: JSON.stringify({ subscriptionId: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
        return data;
      } else {
        const res = await fetch(`/api/stripe/verify?session_id=${encodeURIComponent(id)}`, {
          headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
        return data;
      }
    },
    onSuccess: (data) => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pro-users"] });
      setVerifyId("");
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
          <button onClick={() => { auth.logout(); }} className="text-blue-400 text-sm underline hover:text-blue-300">Sign out</button>
        </div>
      </div>
    );
  }

  const statusColor: Record<string, string> = {
    active: "bg-green-600",
    trialing: "bg-cyan-600",
    canceled: "bg-red-600",
    incomplete: "bg-yellow-600",
    past_due: "bg-orange-600",
  };

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

      {/* Customer email lookup */}
      <div className="mb-4 max-w-2xl bg-blue-900/60 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-200 mb-1">Customer Lookup</p>
        <p className="text-xs text-blue-400 mb-3">Search by email — shows DB record and all Stripe subscriptions.</p>
        <div className="flex gap-2">
          <input
            data-testid="input-lookup-email"
            type="email"
            placeholder="customer@example.com"
            value={lookupEmail}
            onChange={(e) => setLookupEmail(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleLookup()}
            className="flex-1 min-w-0 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400"
          />
          <Button
            data-testid="button-lookup"
            size="sm"
            className="bg-blue-600 hover:bg-blue-500 text-white"
            disabled={lookupLoading || !lookupEmail.includes("@")}
            onClick={handleLookup}
          >
            {lookupLoading ? "Searching…" : "Look Up"}
          </Button>
        </div>

        {lookupResult && (
          <div className="mt-4 space-y-3">
            {/* DB record */}
            <div className="bg-blue-800/60 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-300 mb-2">Database Record</p>
              {lookupResult.dbRecord ? (
                <div className="space-y-1 text-xs">
                  <div className="flex gap-4 flex-wrap">
                    <span><span className="text-blue-400">Plan:</span> <span className="text-white font-mono">{lookupResult.dbRecord.planType}</span></span>
                    <span><span className="text-blue-400">Active:</span> <span className={lookupResult.dbRecord.active ? "text-green-400" : "text-red-400"}>{lookupResult.dbRecord.active ? "Yes" : "No"}</span></span>
                    <span><span className="text-blue-400">Founding Plunger:</span> <span className="text-white">{lookupResult.dbRecord.foundingPlunger ? "Yes" : "No"}</span></span>
                  </div>
                  {lookupResult.dbRecord.expiresAt && (
                    <p><span className="text-blue-400">Expires:</span> <span className="text-white">{new Date(lookupResult.dbRecord.expiresAt).toLocaleDateString()}</span></p>
                  )}
                  {lookupResult.dbRecord.stripeSubscriptionId && (
                    <p><span className="text-blue-400">Sub ID:</span> <span className="text-white font-mono break-all">{lookupResult.dbRecord.stripeSubscriptionId}</span></p>
                  )}
                  {lookupResult.dbRecord.stripeSessionId && (
                    <p><span className="text-blue-400">Session ID:</span> <span className="text-white font-mono break-all">{lookupResult.dbRecord.stripeSessionId}</span></p>
                  )}
                  <p><span className="text-blue-400">Created:</span> <span className="text-white">{new Date(lookupResult.dbRecord.createdAt).toLocaleString()}</span></p>
                </div>
              ) : (
                <p className="text-xs text-yellow-400">No DB record found for this email.</p>
              )}
            </div>

            {/* Stripe subscriptions */}
            <div className="bg-blue-800/60 rounded-lg p-3">
              <p className="text-xs font-semibold text-blue-300 mb-2">Stripe Subscriptions ({lookupResult.stripeSubscriptions.length})</p>
              {lookupResult.stripeSubscriptions.length === 0 ? (
                <p className="text-xs text-yellow-400">No Stripe subscriptions found for this email.</p>
              ) : (
                <div className="space-y-2">
                  {lookupResult.stripeSubscriptions.map((sub) => (
                    <div key={sub.subscriptionId} className="border border-blue-700/50 rounded-lg p-2 space-y-1 text-xs">
                      <div className="flex items-center gap-2 flex-wrap">
                        <span className={`px-2 py-0.5 rounded text-white text-xs font-semibold ${statusColor[sub.status] ?? "bg-gray-600"}`}>{sub.status}</span>
                        <span className="text-white font-semibold">{sub.planType}</span>
                      </div>
                      <p><span className="text-blue-400">Sub ID:</span> <span className="text-white font-mono break-all">{sub.subscriptionId}</span></p>
                      <p><span className="text-blue-400">Renews / expires:</span> <span className="text-white">{new Date(sub.currentPeriodEnd).toLocaleDateString()}</span></p>
                      <p><span className="text-blue-400">Customer ID:</span> <span className="text-white font-mono">{sub.customerId}</span></p>
                      {(sub.status === "active" || sub.status === "trialing") && (
                        <Button
                          size="sm"
                          className="bg-cyan-700 hover:bg-cyan-600 text-white mt-1 h-7 text-xs"
                          disabled={verifyMutation.isPending}
                          onClick={() => verifyMutation.mutate(sub.subscriptionId)}
                        >
                          Grant Pro from this subscription
                        </Button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Verify Stripe payment (cs_ session or sub_ subscription) */}
      <div className="mb-4 max-w-2xl bg-blue-900/60 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-200 mb-1">Verify Stripe Payment → Grant Pro</p>
        <p className="text-xs text-blue-400 mb-3">Paste a Stripe checkout session ID (<span className="font-mono">cs_…</span>) or subscription ID (<span className="font-mono">sub_…</span>). Pro is only granted if Stripe confirms it.</p>
        <div className="flex gap-2 flex-wrap">
          <input
            data-testid="input-verify-id"
            type="text"
            placeholder="cs_test_… or sub_…"
            value={verifyId}
            onChange={(e) => setVerifyId(e.target.value.trim())}
            className="flex-1 min-w-0 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <Button
            data-testid="button-verify"
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
            disabled={verifyMutation.isPending || (!isSubId && !isSessionId)}
            onClick={() => verifyMutation.mutate(verifyId)}
          >
            {verifyMutation.isPending ? "Verifying…" : "Verify & Grant"}
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
            <p className="text-xs text-yellow-400 mb-3">Bypass Stripe — use only for refunds, gifts, or support cases where payment is confirmed externally.</p>
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
      {proUsers && proUsers.length === 0 && <p className="text-blue-300">No pro users found.</p>}

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
