import { useState, useMemo } from "react";
import { useQuery, useMutation } from "@tanstack/react-query";
import { queryClient, apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";

interface SupportMessage {
  id: number;
  userId: number | null;
  username: string | null;
  email: string | null;
  category: string;
  message: string;
  deviceInfo: string | null;
  status: string;
  createdAt: string;
}

interface FreeUser {
  id: number;
  email: string;
  username: string | null;
  displayName: string | null;
  isDisabled: boolean;
  createdAt: string;
}

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

type UserFlag = "active" | "expiring-soon" | "orange" | "red";
type SortMode = "default" | "issues-first" | "active-first" | "lifetime-first" | "monthly-first";

function getUserFlag(u: ProUser): UserFlag {
  const now = Date.now();
  const expiry = u.expiresAt ? new Date(u.expiresAt).getTime() : null;
  const sevenDays = 7 * 24 * 60 * 60 * 1000;

  if (!u.active) {
    // Inactive — cancelled or deactivated
    if (expiry === null || expiry < now) return "red";   // fully expired
    return "orange";                                      // cancelled but access window still open
  }
  // Active but expiry already passed — DB inconsistency
  if (expiry !== null && expiry < now) return "red";
  // Active, expires within 7 days
  if (expiry !== null && expiry - now < sevenDays) return "expiring-soon";
  return "active";
}

const FLAG_PRIORITY: Record<UserFlag, number> = {
  red: 0,
  orange: 1,
  "expiring-soon": 2,
  active: 3,
};

const FLAG_LABEL: Record<UserFlag, string> = {
  red: "Expired / Cancelled",
  orange: "Cancelled — Access Remaining",
  "expiring-soon": "Expiring Soon",
  active: "Active",
};

const FLAG_BORDER: Record<UserFlag, string> = {
  red: "border-l-4 border-l-red-500",
  orange: "border-l-4 border-l-orange-400",
  "expiring-soon": "border-l-4 border-l-yellow-400",
  active: "",
};

const FLAG_BADGE: Record<UserFlag, string> = {
  red: "bg-red-700 text-white",
  orange: "bg-orange-500 text-white",
  "expiring-soon": "bg-yellow-500 text-black",
  active: "bg-green-600 text-white",
};

function getPlanStyle(planType: string, active: boolean): string {
  if (!active) return "bg-gray-900/70 border border-gray-700/50";
  switch (planType) {
    case "lifetime": return "bg-amber-950/70 border border-amber-700/50";
    case "annual":   return "bg-green-950/70 border border-green-700/40";
    case "promo":    return "bg-purple-950/70 border border-purple-700/40";
    case "monthly":  return "bg-blue-900/60 border border-blue-700/40";
    default:         return "bg-blue-900/60 border border-blue-700/30";
  }
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

  const { data: freeUsers } = useQuery<FreeUser[]>({
    queryKey: ["/api/admin/free-users"],
    enabled: !!auth.user,
  });

  const { data: supportMessages } = useQuery<SupportMessage[]>({
    queryKey: ["/api/admin/support-messages"],
    enabled: !!auth.user,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/support-messages/${id}/resolve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/support-messages"] }),
  });

  const [supportExpanded, setSupportExpanded] = useState(false);
  const [freeUsersExpanded, setFreeUsersExpanded] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [sortMode, setSortMode] = useState<SortMode>("issues-first");

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
  const isPaymentId = verifyId.startsWith("pi_");

  const verifyMutation = useMutation({
    mutationFn: async (id: string) => {
      const authHeader = { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` };
      if (id.startsWith("sub_")) {
        const res = await fetch("/api/admin/verify-subscription", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ subscriptionId: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
        return data;
      } else if (id.startsWith("pi_")) {
        const res = await fetch("/api/admin/verify-payment", {
          method: "POST",
          headers: { "Content-Type": "application/json", ...authHeader },
          body: JSON.stringify({ paymentIntentId: id }),
        });
        const data = await res.json().catch(() => ({}));
        if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
        return data;
      } else {
        const res = await fetch(`/api/stripe/verify?session_id=${encodeURIComponent(id)}`, {
          headers: authHeader,
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
      toast({ title: "Failed to update", variant: "destructive" });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: async (email: string) => {
      const res = await fetch(`/api/admin/pro-users/${encodeURIComponent(email)}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pro-users"] });
      setConfirmDelete(null);
      toast({ title: "Pro record deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Free-user management ────────────────────────────────────────────────
  const [confirmDeleteUser, setConfirmDeleteUser] = useState<number | null>(null);
  const [editingUser, setEditingUser] = useState<number | null>(null);
  const [editDisplayName, setEditDisplayName] = useState("");

  const disableUserMutation = useMutation({
    mutationFn: ({ id, disabled }: { id: number; disabled: boolean }) =>
      apiRequest("PATCH", `/api/admin/users/${id}`, { disabled }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/free-users"] });
      toast({ title: "Account updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update account", description: err?.message ?? "Server error", variant: "destructive" });
    },
  });

  const deleteUserMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/free-users"] });
      queryClient.invalidateQueries({ queryKey: ["/api/admin/pro-users"] });
      setConfirmDeleteUser(null);
      toast({ title: "Account deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const editUserMutation = useMutation({
    mutationFn: ({ id, displayName }: { id: number; displayName: string }) =>
      apiRequest("PUT", `/api/admin/users/${id}`, { displayName }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/free-users"] });
      setEditingUser(null);
      toast({ title: "Display name updated" });
    },
    onError: (err: any) => {
      toast({ title: "Update failed", description: err?.message ?? "Server error", variant: "destructive" });
    },
  });

  // Sorted users with flag metadata
  const sortedUsers = useMemo(() => {
    if (!proUsers) return [];
    const withFlags = proUsers.map((u) => ({ ...u, flag: getUserFlag(u) }));
    if (sortMode === "issues-first") {
      return [...withFlags].sort((a, b) => FLAG_PRIORITY[a.flag] - FLAG_PRIORITY[b.flag]);
    }
    if (sortMode === "active-first") {
      return [...withFlags].sort((a, b) => FLAG_PRIORITY[b.flag] - FLAG_PRIORITY[a.flag]);
    }
    if (sortMode === "lifetime-first") {
      return [...withFlags].sort((a, b) => {
        if (a.planType === "lifetime" && b.planType !== "lifetime") return -1;
        if (b.planType === "lifetime" && a.planType !== "lifetime") return 1;
        return 0;
      });
    }
    if (sortMode === "monthly-first") {
      return [...withFlags].sort((a, b) => {
        if (a.planType === "monthly" && b.planType !== "monthly") return -1;
        if (b.planType === "monthly" && a.planType !== "monthly") return 1;
        return 0;
      });
    }
    return withFlags;
  }, [proUsers, sortMode]);

  // Counts per flag
  const flagCounts = useMemo(() => {
    if (!proUsers) return { red: 0, orange: 0, "expiring-soon": 0, active: 0 };
    const counts = { red: 0, orange: 0, "expiring-soon": 0, active: 0 };
    proUsers.forEach((u) => { counts[getUserFlag(u)]++; });
    return counts;
  }, [proUsers]);

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
            placeholder="Username or email"
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
          <button onClick={() => auth.logout()} className="text-blue-400 text-sm underline hover:text-blue-300">Sign out</button>
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

      {/* Verify Stripe payment */}
      <div className="mb-4 max-w-2xl bg-blue-900/60 rounded-xl p-4">
        <p className="text-sm font-semibold text-blue-200 mb-1">Verify Stripe Payment → Grant Pro</p>
        <p className="text-xs text-blue-400 mb-3">Paste a checkout session ID (<span className="font-mono">cs_…</span>) or subscription ID (<span className="font-mono">sub_…</span>).</p>
        <div className="flex gap-2 flex-wrap">
          <input
            data-testid="input-verify-id"
            type="text"
            placeholder="cs_… or sub_… or pi_…"
            value={verifyId}
            onChange={(e) => setVerifyId(e.target.value.trim())}
            className="flex-1 min-w-0 bg-blue-800/80 border border-blue-600 rounded-xl px-3 py-2 text-white text-sm placeholder:text-blue-500 focus:outline-none focus:border-cyan-400 font-mono"
          />
          <Button
            data-testid="button-verify"
            size="sm"
            className="bg-cyan-600 hover:bg-cyan-500 text-white"
            disabled={verifyMutation.isPending || (!isSubId && !isSessionId && !isPaymentId)}
            onClick={() => verifyMutation.mutate(verifyId)}
          >
            {verifyMutation.isPending ? "Verifying…" : "Verify & Grant"}
          </Button>
        </div>
      </div>

      {/* Admin override */}
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

      {proUsers && (
        <>
          {/* Summary counts + sort controls */}
          <div className="max-w-2xl mb-4 flex flex-wrap items-center gap-3">
            <div className="flex gap-2 flex-wrap text-xs">
              {flagCounts.red > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-900/40 border border-red-700/50 text-red-300">
                  <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />
                  {flagCounts.red} expired/cancelled
                </span>
              )}
              {flagCounts.orange > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-900/40 border border-orange-700/50 text-orange-300">
                  <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />
                  {flagCounts.orange} cancelled w/ access
                </span>
              )}
              {flagCounts["expiring-soon"] > 0 && (
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-900/40 border border-yellow-700/50 text-yellow-300">
                  <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />
                  {flagCounts["expiring-soon"]} expiring soon
                </span>
              )}
              <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300">
                <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />
                {flagCounts.active} active
              </span>
            </div>

            <div className="ml-auto flex items-center gap-1 bg-blue-900/60 rounded-lg p-1">
              {(["issues-first", "default", "active-first", "lifetime-first", "monthly-first"] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  data-testid={`sort-${mode}`}
                  onClick={() => setSortMode(mode)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    sortMode === mode
                      ? mode === "lifetime-first"
                        ? "bg-amber-600 text-white"
                        : mode === "monthly-first"
                          ? "bg-blue-600 text-white"
                          : "bg-blue-600 text-white"
                      : "text-blue-400 hover:text-blue-200"
                  }`}
                >
                  {mode === "issues-first"
                    ? "Issues"
                    : mode === "active-first"
                      ? "Active"
                      : mode === "lifetime-first"
                        ? "⭐ Lifetime"
                        : mode === "monthly-first"
                          ? "Monthly"
                          : "Default"}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-3 max-w-2xl">
            {sortedUsers.map((u) => (
              <div
                key={u.id}
                data-testid={`admin-pro-user-${u.id}`}
                className={`rounded-xl p-4 flex flex-col gap-2 ${getPlanStyle(u.planType, u.active)} ${FLAG_BORDER[u.flag]}`}
              >
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="font-semibold text-sm">{u.email}</p>
                      {u.flag !== "active" && (
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${FLAG_BADGE[u.flag]}`}>
                          {FLAG_LABEL[u.flag]}
                        </span>
                      )}
                    </div>
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
        </>
      )}

      {/* ── Support Inbox ── */}
      {auth.user && supportMessages && (
        <div className="mt-6 border border-slate-700 rounded-xl overflow-hidden">
          <button
            className="w-full flex items-center justify-between px-4 py-3 bg-slate-800 text-left"
            onClick={() => setSupportExpanded(e => !e)}
          >
            <span className="text-white font-semibold text-sm">
              💬 Support Inbox
              <span className="ml-2 text-xs font-normal text-slate-400">
                ({supportMessages.filter(m => m.status === "open").length} open)
              </span>
            </span>
            <span className="text-slate-400 text-xs">{supportExpanded ? "▲ Hide" : "▼ Show"}</span>
          </button>
          {supportExpanded && (
            <div className="p-4 space-y-3 bg-slate-900">
              {supportMessages.length === 0 ? (
                <p className="text-slate-500 text-sm text-center py-4">No support messages yet.</p>
              ) : (
                supportMessages.map(m => {
                  const categoryLabel: Record<string, string> = { bug: "🐛 Bug", refund: "💳 Refund", feature: "💡 Feature", other: "📬 Other" };
                  let deviceObj: Record<string, string> = {};
                  try { deviceObj = JSON.parse(m.deviceInfo ?? "{}"); } catch {}
                  return (
                    <div key={m.id} className={`rounded-xl border p-3 space-y-2 ${m.status === "resolved" ? "border-slate-700 opacity-50" : "border-cyan-700/50 bg-slate-800/60"}`}>
                      <div className="flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-xs font-bold text-cyan-300">{categoryLabel[m.category] ?? m.category}</span>
                          {m.username && <span className="text-xs text-slate-300">@{m.username}</span>}
                          {m.email && <span className="text-xs text-slate-500">{m.email}</span>}
                          <span className="text-xs text-slate-600">{new Date(m.createdAt).toLocaleDateString()}</span>
                        </div>
                        {m.status === "open" && (
                          <Button size="sm" variant="outline" className="border-green-700 text-green-400 hover:bg-green-900/30 text-xs shrink-0" onClick={() => resolveMutation.mutate(m.id)} disabled={resolveMutation.isPending}>
                            Resolve
                          </Button>
                        )}
                        {m.status === "resolved" && <span className="text-xs text-green-600 shrink-0">✓ Resolved</span>}
                      </div>
                      <p className="text-white text-sm leading-relaxed whitespace-pre-wrap">{m.message}</p>
                      {Object.keys(deviceObj).length > 0 && (
                        <div className="text-[10px] text-slate-600 flex flex-wrap gap-x-3">
                          {deviceObj.platform && <span>Platform: {deviceObj.platform}</span>}
                          {deviceObj.screenWidth && <span>Screen: {deviceObj.screenWidth}×{deviceObj.screenHeight}</span>}
                          {deviceObj.plan && <span>Plan: {deviceObj.plan}</span>}
                        </div>
                      )}
                    </div>
                  );
                })
              )}
            </div>
          )}
        </div>
      )}

      {auth.user && freeUsers && (
        <div className="mt-10 max-w-2xl">
          <button
            data-testid="button-toggle-free-users"
            onClick={() => setFreeUsersExpanded((v) => !v)}
            className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 transition-colors text-left"
          >
            <span className="font-semibold text-slate-200 text-sm">
              Registered Free Users
              <span className="ml-2 text-xs font-normal text-slate-400">({freeUsers.length})</span>
            </span>
            <span className="text-slate-400 text-xs">{freeUsersExpanded ? "▲ Hide" : "▼ Show"}</span>
          </button>

          {freeUsersExpanded && (
            <div className="mt-3 flex flex-col gap-2">
              {freeUsers.length === 0 ? (
                <p className="text-slate-400 text-sm px-2">No free users found.</p>
              ) : (
                freeUsers.map((u) => (
                  <div
                    key={u.id}
                    data-testid={`admin-free-user-${u.id}`}
                    className={`rounded-xl px-4 py-3 flex flex-col gap-2 border ${
                      u.isDisabled
                        ? "bg-gray-900/60 border-gray-700/40 opacity-70"
                        : "bg-blue-900/60 border-blue-700/30"
                    }`}
                  >
                    {/* Top row: info + badges */}
                    <div className="flex items-start justify-between gap-3 flex-wrap">
                      <div className="min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <p className="font-semibold text-sm text-slate-200 break-all">{u.email}</p>
                          {u.isDisabled && (
                            <Badge className="bg-red-700 text-white text-[10px] px-1.5 py-0.5">Disabled</Badge>
                          )}
                        </div>
                        <p className="text-xs text-slate-400 mt-0.5">
                          {u.username ? `@${u.username}` : u.displayName ? `@${u.displayName}` : "no username"}
                          {u.displayName && u.username ? ` · ${u.displayName}` : ""}
                          {" · "}Joined {new Date(u.createdAt).toLocaleDateString()}
                        </p>
                      </div>
                      <Badge className="bg-slate-600 text-slate-200 text-xs shrink-0">Free</Badge>
                    </div>

                    {/* Edit display name inline */}
                    {editingUser === u.id ? (
                      <div className="flex items-center gap-2 mt-1">
                        <input
                          data-testid={`input-display-name-${u.id}`}
                          className="flex-1 px-2 py-1 rounded bg-slate-700 border border-slate-600 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-cyan-500"
                          placeholder="Display name…"
                          value={editDisplayName}
                          onChange={(e) => setEditDisplayName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") editUserMutation.mutate({ id: u.id, displayName: editDisplayName });
                            if (e.key === "Escape") setEditingUser(null);
                          }}
                        />
                        <Button
                          data-testid={`btn-save-name-${u.id}`}
                          size="sm"
                          className="bg-cyan-600 hover:bg-cyan-500 text-white"
                          disabled={editUserMutation.isPending || !editDisplayName.trim()}
                          onClick={() => editUserMutation.mutate({ id: u.id, displayName: editDisplayName })}
                        >
                          Save
                        </Button>
                        <Button size="sm" variant="outline" className="border-slate-600 text-slate-300"
                          onClick={() => setEditingUser(null)}>
                          Cancel
                        </Button>
                      </div>
                    ) : null}

                    {/* Action buttons */}
                    <div className="flex items-center gap-2 flex-wrap mt-0.5">
                      <Button
                        data-testid={`btn-edit-user-${u.id}`}
                        size="sm"
                        variant="outline"
                        className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                        onClick={() => {
                          setEditingUser(editingUser === u.id ? null : u.id);
                          setEditDisplayName(u.displayName ?? "");
                        }}
                      >
                        {editingUser === u.id ? "Cancel Edit" : "Edit Name"}
                      </Button>

                      <Button
                        data-testid={`btn-disable-user-${u.id}`}
                        size="sm"
                        variant="outline"
                        className={
                          u.isDisabled
                            ? "border-green-700/60 text-green-400 hover:bg-green-900/30 text-xs"
                            : "border-orange-700/60 text-orange-400 hover:bg-orange-900/30 text-xs"
                        }
                        disabled={disableUserMutation.isPending}
                        onClick={() => disableUserMutation.mutate({ id: u.id, disabled: !u.isDisabled })}
                      >
                        {u.isDisabled ? "Enable" : "Disable"}
                      </Button>

                      {confirmDeleteUser === u.id ? (
                        <div className="flex items-center gap-1">
                          <Button
                            data-testid={`btn-confirm-delete-user-${u.id}`}
                            size="sm"
                            className="bg-red-600 hover:bg-red-500 text-white text-xs"
                            disabled={deleteUserMutation.isPending}
                            onClick={() => deleteUserMutation.mutate(u.id)}
                          >
                            {deleteUserMutation.isPending ? "Deleting…" : "Yes, Delete Account"}
                          </Button>
                          <Button
                            size="sm"
                            variant="outline"
                            className="border-slate-600 text-slate-300 text-xs"
                            onClick={() => setConfirmDeleteUser(null)}
                          >
                            Cancel
                          </Button>
                        </div>
                      ) : (
                        <Button
                          data-testid={`btn-delete-user-${u.id}`}
                          size="sm"
                          variant="outline"
                          className="border-red-700/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 text-xs"
                          disabled={disableUserMutation.isPending || deleteUserMutation.isPending}
                          onClick={() => setConfirmDeleteUser(u.id)}
                        >
                          Delete
                        </Button>
                      )}
                    </div>
                  </div>
                ))
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
