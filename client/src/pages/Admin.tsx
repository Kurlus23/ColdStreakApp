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

interface CommunityLocation {
  id: number;
  name: string;
  city: string | null;
  state: string | null;
  country: string;
  isBusiness: boolean;
  businessVerified: boolean | null;
  isHidden: boolean | null;
  nominationCount: number;
  submittedBy: string | null;
}

interface AdminEvent {
  id: number;
  name: string;
  eventDate: string;
  endDate: string | null;
  locationName: string | null;
  createdByUsername: string | null;
  participantCount: number;
  isActive: boolean;
  isPrivate: boolean;
  status: string;
  organizerNote: string | null;
  shareCode: string;
  createdAt: string;
  maxAttendees: number | null;
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
    if (expiry === null || expiry < now) return "red";
    return "orange";
  }
  if (expiry !== null && expiry < now) return "red";
  if (expiry !== null && expiry - now < sevenDays) return "expiring-soon";
  return "active";
}

const FLAG_PRIORITY: Record<UserFlag, number> = { red: 0, orange: 1, "expiring-soon": 2, active: 3 };
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

function fmtDate(d: string) {
  return new Date(d).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" });
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

  type VisitStats = {
    totalClients: number;
    newClients24h: number;
    newClients7d: number;
    newClients30d: number;
    activeClients24h: number;
    activeClients7d: number;
  };
  const { data: visitStats } = useQuery<VisitStats>({
    queryKey: ["/api/admin/visits/stats"],
    enabled: !!auth.user,
  });

  type UserActivity = {
    id: number; email: string; username: string | null; displayName: string | null;
    emailVerified: boolean; isAdmin: boolean; isPro: boolean;
    signedUpAt: string;
    totalPlunges: number; uniqueDays: number; currentStreak: number; longestStreak: number;
    firstPlungeAt: string | null; lastPlungeAt: string | null;
    coldestTemp: number | null; longestDurationSec: number | null;
    lastApiSeenAt: string | null; totalApiVisits: number; platforms: string | null;
  };
  const { data: userActivity } = useQuery<UserActivity[]>({
    queryKey: ["/api/admin/user-activity"],
    enabled: !!auth.user,
  });

  const { data: supportMessages } = useQuery<SupportMessage[]>({
    queryKey: ["/api/admin/support-messages"],
    enabled: !!auth.user,
  });

  const { data: allLocations } = useQuery<CommunityLocation[]>({
    queryKey: ["/api/community-locations"],
    enabled: !!auth.user,
  });

  const { data: adminEvents } = useQuery<AdminEvent[]>({
    queryKey: ["/api/admin/events"],
    enabled: !!auth.user,
  });

  const resolveMutation = useMutation({
    mutationFn: (id: number) => apiRequest("PATCH", `/api/admin/support-messages/${id}/resolve`),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["/api/admin/support-messages"] }),
  });

  const replyMutation = useMutation({
    mutationFn: ({ id, replyText }: { id: number; replyText: string }) =>
      apiRequest("POST", `/api/admin/support-messages/${id}/reply`, { replyText }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/support-messages"] });
      setReplyingTo(null);
      setReplyText("");
      toast({ title: "Reply sent", description: "Email delivered and message marked resolved." });
    },
    onError: (err: any) => {
      toast({ title: "Reply failed", description: err?.message ?? "Server error", variant: "destructive" });
    },
  });

  // ── Panel expand states ─────────────────────────────────────────────────
  const [supportExpanded, setSupportExpanded] = useState(false);
  const [replyingTo, setReplyingTo] = useState<number | null>(null);
  const [replyText, setReplyText] = useState("");
  const [freeUsersExpanded, setFreeUsersExpanded] = useState(false);
  const [businessExpanded, setBusinessExpanded] = useState(false);
  const [communityExpanded, setCommunityExpanded] = useState(false);
  const [eventsExpanded, setEventsExpanded] = useState(true);
  const [confirmDeleteLoc, setConfirmDeleteLoc] = useState<number | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const [confirmDeleteEvent, setConfirmDeleteEvent] = useState<number | null>(null);
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

  // ── Free-user management ─────────────────────────────────────────────────
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

  // ── Location management ──────────────────────────────────────────────────
  const deleteLocationMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/community-locations/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      setConfirmDeleteLoc(null);
      toast({ title: "Location deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  const toggleLocationVisibilityMutation = useMutation({
    mutationFn: ({ id, hidden }: { id: number; hidden: boolean }) =>
      apiRequest("PATCH", `/api/admin/locations/${id}/visibility`, { hidden }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      toast({ title: "Visibility updated" });
    },
    onError: (err: any) => {
      toast({ title: "Failed to update visibility", description: err?.message ?? "Server error", variant: "destructive" });
    },
  });

  // ── Event management ─────────────────────────────────────────────────────
  const deleteEventMutation = useMutation({
    mutationFn: async (id: number) => {
      const res = await fetch(`/api/admin/events/${id}`, {
        method: "DELETE",
        headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.message ?? `HTTP ${res.status}`);
      return data;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["/api/admin/events"] });
      setConfirmDeleteEvent(null);
      toast({ title: "Event deleted" });
    },
    onError: (err: Error) => {
      toast({ title: "Delete failed", description: err.message, variant: "destructive" });
    },
  });

  // ── Derived data ─────────────────────────────────────────────────────────
  const sortedUsers = useMemo(() => {
    if (!proUsers) return [];
    const withFlags = proUsers.map((u) => ({ ...u, flag: getUserFlag(u) }));
    if (sortMode === "issues-first") return [...withFlags].sort((a, b) => FLAG_PRIORITY[a.flag] - FLAG_PRIORITY[b.flag]);
    if (sortMode === "active-first") return [...withFlags].sort((a, b) => FLAG_PRIORITY[b.flag] - FLAG_PRIORITY[a.flag]);
    if (sortMode === "lifetime-first") return [...withFlags].sort((a, b) => {
      if (a.planType === "lifetime" && b.planType !== "lifetime") return -1;
      if (b.planType === "lifetime" && a.planType !== "lifetime") return 1;
      return 0;
    });
    if (sortMode === "monthly-first") return [...withFlags].sort((a, b) => {
      if (a.planType === "monthly" && b.planType !== "monthly") return -1;
      if (b.planType === "monthly" && a.planType !== "monthly") return 1;
      return 0;
    });
    return withFlags;
  }, [proUsers, sortMode]);

  const flagCounts = useMemo(() => {
    if (!proUsers) return { red: 0, orange: 0, "expiring-soon": 0, active: 0 };
    const counts = { red: 0, orange: 0, "expiring-soon": 0, active: 0 };
    proUsers.forEach((u) => { counts[getUserFlag(u)]++; });
    return counts;
  }, [proUsers]);

  const businessLocations = useMemo(() => (allLocations ?? []).filter(l => l.isBusiness), [allLocations]);
  const communityLocations = useMemo(() => (allLocations ?? []).filter(l => !l.isBusiness), [allLocations]);

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
    active: "bg-green-600", trialing: "bg-cyan-600", canceled: "bg-red-600",
    incomplete: "bg-yellow-600", past_due: "bg-orange-600",
  };

  return (
    <div className="min-h-screen bg-blue-950 text-white p-4 xl:p-6">

      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between mb-5">
        <h1 className="text-xl font-bold">ColdStreak Admin</h1>
        <button
          data-testid="button-admin-signout"
          onClick={() => auth.logout()}
          className="text-blue-400 text-xs hover:text-red-400 transition-colors"
        >Sign out</button>
      </div>

      {/* ── Top tools: Lookup + Verify ──────────────────────────────────── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-5 max-w-5xl">
        {/* Customer Lookup */}
        <div className="bg-blue-900/60 rounded-xl p-4">
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
                          <span className="text-blue-400">renews {new Date(sub.currentPeriodEnd).toLocaleDateString()}</span>
                        </div>
                        <p className="text-blue-400 break-all font-mono">{sub.subscriptionId}</p>
                        {sub.customerEmail && sub.customerEmail !== lookupResult.email && (
                          <p className="text-orange-400">⚠ Stripe email: {sub.customerEmail}</p>
                        )}
                        <Button
                          size="sm"
                          className="bg-green-700 hover:bg-green-600 text-white text-xs mt-1"
                          onClick={() => verifyMutation.mutate(sub.subscriptionId)}
                          disabled={verifyMutation.isPending}
                        >
                          Grant Pro from this subscription
                        </Button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Verify + Override */}
        <div className="space-y-4">
          <div className="bg-blue-900/60 rounded-xl p-4">
            <p className="text-sm font-semibold text-blue-200 mb-1">Verify Stripe Payment → Grant Pro</p>
            <p className="text-xs text-blue-400 mb-3">Paste a checkout session ID (<span className="font-mono">cs_…</span>), subscription ID (<span className="font-mono">sub_…</span>), or payment ID (<span className="font-mono">pi_…</span>).</p>
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

          <div>
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
        </div>
      </div>

      {/* ── Visitor ground-truth (server-side, independent of GA) ───────── */}
      {visitStats && (
        <div className="mb-6 max-w-5xl">
          <div className="mb-2 flex items-center justify-between">
            <h2 className="text-base font-bold text-white">Real Visitors <span className="text-xs font-normal text-slate-400">(server-side, our own count)</span></h2>
          </div>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
            {[
              { label: "Total devices", value: visitStats.totalClients, testid: "stat-visits-total" },
              { label: "New 24h", value: visitStats.newClients24h, testid: "stat-visits-new-24h" },
              { label: "New 7d", value: visitStats.newClients7d, testid: "stat-visits-new-7d" },
              { label: "New 30d", value: visitStats.newClients30d, testid: "stat-visits-new-30d" },
              { label: "Active 24h", value: visitStats.activeClients24h, testid: "stat-visits-active-24h" },
              { label: "Active 7d", value: visitStats.activeClients7d, testid: "stat-visits-active-7d" },
            ].map((s) => (
              <div
                key={s.label}
                data-testid={s.testid}
                className="px-3 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50"
              >
                <div className="text-[11px] uppercase tracking-wide text-slate-400">{s.label}</div>
                <div className="text-2xl font-bold text-white tabular-nums">{s.value}</div>
              </div>
            ))}
          </div>
          <p className="mt-2 text-xs text-slate-500">
            One row per device (per <code>localStorage</code> client id). This is what actually hit our API — separate from Google Analytics "users".
          </p>
        </div>
      )}

      {/* ── Per-user activity report ───────────────────────────────────── */}
      {userActivity && (
        <div className="mb-6 max-w-7xl">
          <h2 className="text-base font-bold text-white mb-2">
            User Activity <span className="text-xs font-normal text-slate-400">({userActivity.length} accounts)</span>
          </h2>
          <div className="overflow-x-auto rounded-xl border border-slate-700/50 bg-slate-800/40">
            <table className="min-w-full text-xs">
              <thead className="bg-slate-900/60 text-slate-300">
                <tr>
                  <th className="text-left px-3 py-2">Email</th>
                  <th className="text-left px-3 py-2">Role</th>
                  <th className="text-right px-3 py-2">Plunges</th>
                  <th className="text-right px-3 py-2">Days</th>
                  <th className="text-right px-3 py-2">Streak</th>
                  <th className="text-right px-3 py-2">Best</th>
                  <th className="text-right px-3 py-2">Coldest °F</th>
                  <th className="text-right px-3 py-2">Longest</th>
                  <th className="text-left px-3 py-2">Signed Up</th>
                  <th className="text-left px-3 py-2">Last Plunge</th>
                  <th className="text-left px-3 py-2">Last API Hit</th>
                  <th className="text-left px-3 py-2">Platforms</th>
                </tr>
              </thead>
              <tbody>
                {userActivity.map((u) => {
                  const fmtDate = (s: string | null) => s ? new Date(s).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "2-digit" }) : "—";
                  const fmtDur = (sec: number | null) => {
                    if (sec == null) return "—";
                    const m = Math.floor(sec / 60);
                    const s = sec % 60;
                    return m > 0 ? `${m}m ${s}s` : `${s}s`;
                  };
                  const role = u.isAdmin ? "admin" : u.isPro ? "pro" : "free";
                  const roleColor = u.isAdmin ? "bg-purple-900/40 text-purple-300 border-purple-700/50"
                    : u.isPro ? "bg-amber-900/40 text-amber-300 border-amber-700/50"
                    : "bg-slate-700/40 text-slate-300 border-slate-600/50";
                  const stalled = u.totalPlunges === 0;
                  return (
                    <tr
                      key={u.id}
                      data-testid={`row-user-activity-${u.id}`}
                      className={`border-t border-slate-700/40 ${stalled ? "bg-red-950/20" : "hover:bg-slate-800/40"}`}
                    >
                      <td className="px-3 py-2 text-slate-200">
                        <div className="font-medium">{u.email}</div>
                        {(u.username || u.displayName) && (
                          <div className="text-[11px] text-slate-400">
                            {u.displayName ?? u.username}{u.username && u.displayName ? ` (@${u.username})` : ""}
                          </div>
                        )}
                        {!u.emailVerified && <div className="text-[10px] text-amber-400">unverified</div>}
                      </td>
                      <td className="px-3 py-2">
                        <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] uppercase ${roleColor}`}>{role}</span>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-white font-semibold">{u.totalPlunges}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{u.uniqueDays}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-blue-300">{u.currentStreak}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-400">{u.longestStreak}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-cyan-300">{u.coldestTemp ?? "—"}</td>
                      <td className="px-3 py-2 text-right tabular-nums text-slate-300">{fmtDur(u.longestDurationSec)}</td>
                      <td className="px-3 py-2 text-slate-400">{fmtDate(u.signedUpAt)}</td>
                      <td className="px-3 py-2 text-slate-400">{fmtDate(u.lastPlungeAt)}</td>
                      <td className="px-3 py-2 text-slate-400">{fmtDate(u.lastApiSeenAt)}</td>
                      <td className="px-3 py-2 text-slate-400">{u.platforms ?? "—"}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Streak = consecutive days ending today/yesterday. "Last API Hit" only fills in for sessions after the visitor tracker rolled out (today's deploy).
          </p>
        </div>
      )}

      {/* ── Users row: Pro (left) | Free (right) ───────────────────────── */}
      {isLoading && <p className="text-blue-300 mb-4">Loading…</p>}

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 mb-6 max-w-5xl">

        {/* Pro Users */}
        {proUsers && (
          <div>
            <div className="mb-3 flex flex-wrap items-center gap-3">
              <h2 className="text-base font-bold text-white">Pro Users <span className="text-sm font-normal text-blue-400">({proUsers.length})</span></h2>
              <div className="flex gap-2 flex-wrap text-xs">
                {flagCounts.red > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-red-900/40 border border-red-700/50 text-red-300">
                    <span className="w-2 h-2 rounded-full bg-red-500 inline-block" />{flagCounts.red} expired
                  </span>
                )}
                {flagCounts.orange > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-orange-900/40 border border-orange-700/50 text-orange-300">
                    <span className="w-2 h-2 rounded-full bg-orange-400 inline-block" />{flagCounts.orange} cancelled
                  </span>
                )}
                {flagCounts["expiring-soon"] > 0 && (
                  <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-yellow-900/40 border border-yellow-700/50 text-yellow-300">
                    <span className="w-2 h-2 rounded-full bg-yellow-400 inline-block" />{flagCounts["expiring-soon"]} expiring
                  </span>
                )}
                <span className="flex items-center gap-1 px-2 py-1 rounded-lg bg-green-900/30 border border-green-700/40 text-green-300">
                  <span className="w-2 h-2 rounded-full bg-green-500 inline-block" />{flagCounts.active} active
                </span>
              </div>
            </div>

            {/* Sort controls */}
            <div className="mb-3 flex items-center gap-1 bg-blue-900/60 rounded-lg p-1 w-fit">
              {(["issues-first", "default", "active-first", "lifetime-first", "monthly-first"] as SortMode[]).map((mode) => (
                <button
                  key={mode}
                  data-testid={`sort-${mode}`}
                  onClick={() => setSortMode(mode)}
                  className={`px-2.5 py-1 rounded text-xs font-medium transition-colors ${
                    sortMode === mode ? "bg-blue-600 text-white" : "text-blue-400 hover:text-blue-200"
                  }`}
                >
                  {mode === "issues-first" ? "Issues" : mode === "active-first" ? "Active" : mode === "lifetime-first" ? "⭐ Lifetime" : mode === "monthly-first" ? "Monthly" : "Default"}
                </button>
              ))}
            </div>

            <div className="flex flex-col gap-3">
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
                          <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${FLAG_BADGE[u.flag]}`}>{FLAG_LABEL[u.flag]}</span>
                        )}
                      </div>
                      <p className="text-xs text-blue-300 mt-0.5">
                        {u.planType} {u.foundingPlunger && "· Founding Plunger"}
                        {u.expiresAt && ` · Expires ${new Date(u.expiresAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-wrap">
                      <Badge data-testid={`badge-active-${u.id}`} className={u.active ? "bg-green-600 text-white" : "bg-red-600 text-white"}>
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
                            {deleteMutation.isPending ? "Deleting…" : "Yes, Delete"}
                          </Button>
                          <Button size="sm" variant="outline" className="border-blue-600 text-blue-300" onClick={() => setConfirmDelete(null)}>Cancel</Button>
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
                  {u.stripeSessionId && <p className="text-xs text-blue-400 break-all">Session: {u.stripeSessionId}</p>}
                  {u.stripeSubscriptionId && <p className="text-xs text-blue-400 break-all">Sub: {u.stripeSubscriptionId}</p>}
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Free Users */}
        {freeUsers && (
          <div>
            <button
              data-testid="button-toggle-free-users"
              onClick={() => setFreeUsersExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 rounded-xl bg-slate-800/60 border border-slate-700/50 hover:bg-slate-800 transition-colors text-left mb-3"
            >
              <span className="font-bold text-slate-200 text-base">
                Free Users <span className="text-sm font-normal text-slate-400">({freeUsers.length})</span>
              </span>
              <span className="text-slate-400 text-xs">{freeUsersExpanded ? "▲ Hide" : "▼ Show"}</span>
            </button>

            {freeUsersExpanded && (
              <div className="flex flex-col gap-2">
                {freeUsers.length === 0 ? (
                  <p className="text-slate-400 text-sm px-2">No free users found.</p>
                ) : (
                  freeUsers.map((u) => (
                    <div
                      key={u.id}
                      data-testid={`admin-free-user-${u.id}`}
                      className={`rounded-xl px-4 py-3 flex flex-col gap-2 border ${
                        u.isDisabled ? "bg-gray-900/60 border-gray-700/40 opacity-70" : "bg-blue-900/60 border-blue-700/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-slate-200 break-all">{u.email}</p>
                            {u.isDisabled && <Badge className="bg-red-700 text-white text-[10px] px-1.5 py-0.5">Disabled</Badge>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {u.username ? `@${u.username}` : u.displayName ? `@${u.displayName}` : "no username"}
                            {u.displayName && u.username ? ` · ${u.displayName}` : ""}
                            {" · "}Joined {new Date(u.createdAt).toLocaleDateString()}
                          </p>
                        </div>
                        <Badge className="bg-slate-600 text-slate-200 text-xs shrink-0">Free</Badge>
                      </div>

                      {editingUser === u.id && (
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
                          <Button size="sm" variant="outline" className="border-slate-600 text-slate-300" onClick={() => setEditingUser(null)}>Cancel</Button>
                        </div>
                      )}

                      <div className="flex items-center gap-2 flex-wrap mt-0.5">
                        <Button
                          data-testid={`btn-edit-user-${u.id}`}
                          size="sm" variant="outline"
                          className="border-slate-600 text-slate-300 hover:bg-slate-700 text-xs"
                          onClick={() => { setEditingUser(editingUser === u.id ? null : u.id); setEditDisplayName(u.displayName ?? ""); }}
                        >
                          {editingUser === u.id ? "Cancel Edit" : "Edit Name"}
                        </Button>
                        <Button
                          data-testid={`btn-disable-user-${u.id}`}
                          size="sm" variant="outline"
                          className={u.isDisabled ? "border-green-700/60 text-green-400 hover:bg-green-900/30 text-xs" : "border-orange-700/60 text-orange-400 hover:bg-orange-900/30 text-xs"}
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
                              {deleteUserMutation.isPending ? "Deleting…" : "Yes, Delete"}
                            </Button>
                            <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 text-xs" onClick={() => setConfirmDeleteUser(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button
                            data-testid={`btn-delete-user-${u.id}`}
                            size="sm" variant="outline"
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

      {/* ── Bottom panels: [Inbox + Business] | [Community + Events] ─────── */}
      <div className="grid grid-cols-1 xl:grid-cols-2 gap-6 max-w-5xl">

        {/* Left column: Inbox + Business Locations */}
        <div className="space-y-4">

          {/* Support Inbox */}
          {supportMessages && (
            <div className="border border-slate-700 rounded-xl overflow-hidden">
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
                              <div className="flex items-center gap-1.5 shrink-0">
                                <Button
                                  size="sm" variant="outline"
                                  className="border-cyan-700 text-cyan-400 hover:bg-cyan-900/30 text-xs"
                                  onClick={() => { if (replyingTo === m.id) { setReplyingTo(null); setReplyText(""); } else { setReplyingTo(m.id); setReplyText(""); } }}
                                >
                                  {replyingTo === m.id ? "Cancel" : "Reply"}
                                </Button>
                                <Button size="sm" variant="outline" className="border-green-700 text-green-400 hover:bg-green-900/30 text-xs" onClick={() => resolveMutation.mutate(m.id)} disabled={resolveMutation.isPending}>
                                  Resolve
                                </Button>
                              </div>
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
                          {replyingTo === m.id && (
                            <div className="pt-1 space-y-2 border-t border-slate-700/60 mt-1">
                              {!m.email && <p className="text-xs text-orange-400">⚠ No email address — reply cannot be sent.</p>}
                              <textarea
                                data-testid={`input-reply-${m.id}`}
                                value={replyText}
                                onChange={(e) => setReplyText(e.target.value)}
                                placeholder={m.email ? `Reply to ${m.email}…` : "No email available"}
                                rows={4}
                                disabled={!m.email}
                                className="w-full bg-slate-800 border border-slate-600 text-white text-xs rounded-lg px-3 py-2 focus:outline-none focus:border-cyan-500 placeholder-slate-500 resize-none disabled:opacity-40"
                              />
                              <Button
                                data-testid={`btn-send-reply-${m.id}`}
                                size="sm"
                                className="bg-cyan-600 hover:bg-cyan-500 text-white text-xs"
                                disabled={!m.email || !replyText.trim() || replyMutation.isPending}
                                onClick={() => replyMutation.mutate({ id: m.id, replyText: replyText.trim() })}
                              >
                                {replyMutation.isPending ? "Sending…" : "Send Reply & Resolve"}
                              </Button>
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

          {/* Business Locations */}
          <div className="border border-amber-800/40 rounded-xl overflow-hidden">
            <button
              data-testid="button-toggle-business"
              onClick={() => setBusinessExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-amber-950/60 text-left"
            >
              <span className="font-semibold text-amber-200 text-sm">
                🏢 Business Locations
                <span className="ml-2 text-xs font-normal text-amber-400">({businessLocations.length})</span>
              </span>
              <span className="text-amber-500 text-xs">{businessExpanded ? "▲ Hide" : "▼ Show"}</span>
            </button>
            {businessExpanded && (
              <div className="p-3 space-y-2 bg-amber-950/20">
                {businessLocations.length === 0 ? (
                  <p className="text-amber-500 text-sm text-center py-4">No business locations yet.</p>
                ) : (
                  businessLocations.map((loc) => (
                    <div
                      key={loc.id}
                      data-testid={`admin-business-${loc.id}`}
                      className={`rounded-xl px-4 py-3 flex flex-col gap-2 border ${
                        loc.isHidden ? "bg-gray-900/60 border-gray-700/40 opacity-70" : "bg-amber-950/40 border-amber-700/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-slate-200">{loc.name}</p>
                            {loc.businessVerified && <Badge className="bg-green-700 text-white text-[10px] px-1.5 py-0.5">Verified</Badge>}
                            {loc.isHidden && <Badge className="bg-gray-600 text-white text-[10px] px-1.5 py-0.5">Hidden</Badge>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}
                            {loc.submittedBy ? ` · by ${loc.submittedBy}` : ""} · ID #{loc.id} · {loc.nominationCount} vote{loc.nominationCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          data-testid={`btn-toggle-loc-visibility-${loc.id}`}
                          size="sm" variant="outline"
                          className={loc.isHidden ? "border-green-700/60 text-green-400 hover:bg-green-900/30 text-xs" : "border-gray-600 text-gray-400 hover:bg-gray-800/40 text-xs"}
                          disabled={toggleLocationVisibilityMutation.isPending}
                          onClick={() => toggleLocationVisibilityMutation.mutate({ id: loc.id, hidden: !loc.isHidden })}
                        >
                          {loc.isHidden ? "Unhide" : "Hide"}
                        </Button>
                        {confirmDeleteLoc === loc.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              data-testid={`btn-confirm-delete-loc-${loc.id}`}
                              size="sm"
                              className="bg-red-600 hover:bg-red-500 text-white text-xs"
                              disabled={deleteLocationMutation.isPending}
                              onClick={() => deleteLocationMutation.mutate(loc.id)}
                            >
                              {deleteLocationMutation.isPending ? "Deleting…" : "Yes, Delete"}
                            </Button>
                            <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 text-xs" onClick={() => setConfirmDeleteLoc(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button
                            data-testid={`btn-delete-loc-${loc.id}`}
                            size="sm" variant="outline"
                            className="border-red-700/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 text-xs"
                            disabled={deleteLocationMutation.isPending || toggleLocationVisibilityMutation.isPending}
                            onClick={() => setConfirmDeleteLoc(loc.id)}
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
        </div>

        {/* Right column: Community Locations + Events */}
        <div className="space-y-4">

          {/* Community Locations */}
          <div className="border border-blue-700/40 rounded-xl overflow-hidden">
            <button
              data-testid="button-toggle-community"
              onClick={() => setCommunityExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-blue-900/60 text-left"
            >
              <span className="font-semibold text-blue-200 text-sm">
                📍 Community Locations
                <span className="ml-2 text-xs font-normal text-blue-400">({communityLocations.length})</span>
              </span>
              <span className="text-blue-400 text-xs">{communityExpanded ? "▲ Hide" : "▼ Show"}</span>
            </button>
            {communityExpanded && (
              <div className="p-3 space-y-2 bg-blue-950/40">
                {communityLocations.length === 0 ? (
                  <p className="text-blue-400 text-sm text-center py-4">No community locations yet.</p>
                ) : (
                  communityLocations.map((loc) => (
                    <div
                      key={loc.id}
                      data-testid={`admin-location-${loc.id}`}
                      className={`rounded-xl px-4 py-3 flex flex-col gap-2 border ${
                        loc.isHidden ? "bg-gray-900/60 border-gray-700/40 opacity-70" : "bg-blue-900/60 border-blue-700/30"
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3 flex-wrap">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <p className="font-semibold text-sm text-slate-200">{loc.name}</p>
                            {loc.isHidden && <Badge className="bg-gray-600 text-white text-[10px] px-1.5 py-0.5">Hidden</Badge>}
                          </div>
                          <p className="text-xs text-slate-400 mt-0.5">
                            {[loc.city, loc.state, loc.country].filter(Boolean).join(", ")}
                            {loc.submittedBy ? ` · by ${loc.submittedBy}` : ""} · ID #{loc.id} · {loc.nominationCount} vote{loc.nominationCount !== 1 ? "s" : ""}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <Button
                          data-testid={`btn-toggle-community-visibility-${loc.id}`}
                          size="sm" variant="outline"
                          className={loc.isHidden ? "border-green-700/60 text-green-400 hover:bg-green-900/30 text-xs" : "border-gray-600 text-gray-400 hover:bg-gray-800/40 text-xs"}
                          disabled={toggleLocationVisibilityMutation.isPending}
                          onClick={() => toggleLocationVisibilityMutation.mutate({ id: loc.id, hidden: !loc.isHidden })}
                        >
                          {loc.isHidden ? "Unhide" : "Hide"}
                        </Button>
                        {confirmDeleteLoc === loc.id ? (
                          <div className="flex items-center gap-1">
                            <Button
                              data-testid={`btn-confirm-delete-loc-${loc.id}`}
                              size="sm"
                              className="bg-red-600 hover:bg-red-500 text-white text-xs"
                              disabled={deleteLocationMutation.isPending}
                              onClick={() => deleteLocationMutation.mutate(loc.id)}
                            >
                              {deleteLocationMutation.isPending ? "Deleting…" : "Yes, Delete"}
                            </Button>
                            <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 text-xs" onClick={() => setConfirmDeleteLoc(null)}>Cancel</Button>
                          </div>
                        ) : (
                          <Button
                            data-testid={`btn-delete-community-${loc.id}`}
                            size="sm" variant="outline"
                            className="border-red-700/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 text-xs"
                            disabled={deleteLocationMutation.isPending || toggleLocationVisibilityMutation.isPending}
                            onClick={() => setConfirmDeleteLoc(loc.id)}
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

          {/* Events */}
          <div className="border border-cyan-700/40 rounded-xl overflow-hidden">
            <button
              data-testid="button-toggle-events"
              onClick={() => setEventsExpanded((v) => !v)}
              className="w-full flex items-center justify-between px-4 py-3 bg-cyan-900/40 text-left"
            >
              <span className="font-semibold text-cyan-200 text-sm">
                ❄️ Events
                <span className="ml-2 text-xs font-normal text-cyan-400">({adminEvents?.length ?? 0})</span>
              </span>
              <span className="text-cyan-500 text-xs">{eventsExpanded ? "▲ Hide" : "▼ Show"}</span>
            </button>
            {eventsExpanded && (
              <div className="p-3 space-y-2 bg-cyan-950/20">
                {!adminEvents ? (
                  <p className="text-cyan-400 text-sm text-center py-4">Loading events…</p>
                ) : adminEvents.length === 0 ? (
                  <p className="text-cyan-500 text-sm text-center py-4">No events created yet.</p>
                ) : (
                  adminEvents.map((evt) => {
                    const isPast = new Date(evt.eventDate) < new Date();
                    return (
                      <div
                        key={evt.id}
                        data-testid={`admin-event-${evt.id}`}
                        className={`rounded-xl px-4 py-3 flex flex-col gap-2 border ${
                          isPast ? "bg-blue-950/60 border-blue-800/40 opacity-70" : "bg-cyan-950/40 border-cyan-700/30"
                        }`}
                      >
                        <div className="flex items-start justify-between gap-3 flex-wrap">
                          <div className="min-w-0 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <p className="font-semibold text-sm text-white">{evt.name}</p>
                              {evt.isPrivate && <Badge className="bg-blue-800 text-blue-200 text-[10px] px-1.5 py-0.5">Private</Badge>}
                              {evt.status === "postponed" && <Badge className="bg-amber-700 text-white text-[10px] px-1.5 py-0.5">Postponed</Badge>}
                              {evt.status === "cancelled" && <Badge className="bg-red-700 text-white text-[10px] px-1.5 py-0.5">Cancelled</Badge>}
                              {isPast && <Badge className="bg-slate-700 text-slate-300 text-[10px] px-1.5 py-0.5">Past</Badge>}
                            </div>
                            <p className="text-xs text-cyan-400 mt-0.5">
                              {fmtDate(evt.eventDate)}
                              {evt.locationName ? ` · ${evt.locationName}` : ""}
                              {evt.createdByUsername ? ` · by ${evt.createdByUsername}` : ""}
                            </p>
                            <p className="text-xs text-cyan-600 mt-0.5">
                              {evt.participantCount} attendee{evt.participantCount !== 1 ? "s" : ""}
                              {evt.maxAttendees ? ` / ${evt.maxAttendees} max` : ""}
                              {" · "}Code: <span className="font-mono">{evt.shareCode}</span>
                            </p>
                            {evt.organizerNote && (
                              <p className="text-xs text-amber-400 mt-0.5 italic">"{evt.organizerNote}"</p>
                            )}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 flex-wrap">
                          <a
                            href={`/event/${evt.shareCode}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-cyan-400 hover:text-cyan-300 underline"
                          >
                            View page ↗
                          </a>
                          {confirmDeleteEvent === evt.id ? (
                            <div className="flex items-center gap-1">
                              <Button
                                data-testid={`btn-confirm-delete-event-${evt.id}`}
                                size="sm"
                                className="bg-red-600 hover:bg-red-500 text-white text-xs"
                                disabled={deleteEventMutation.isPending}
                                onClick={() => deleteEventMutation.mutate(evt.id)}
                              >
                                {deleteEventMutation.isPending ? "Deleting…" : "Yes, Delete"}
                              </Button>
                              <Button size="sm" variant="outline" className="border-slate-600 text-slate-300 text-xs" onClick={() => setConfirmDeleteEvent(null)}>Cancel</Button>
                            </div>
                          ) : (
                            <Button
                              data-testid={`btn-delete-event-${evt.id}`}
                              size="sm" variant="outline"
                              className="border-red-700/50 text-red-400 hover:bg-red-900/30 hover:border-red-500 text-xs"
                              disabled={deleteEventMutation.isPending}
                              onClick={() => setConfirmDeleteEvent(evt.id)}
                            >
                              Delete
                            </Button>
                          )}
                        </div>
                      </div>
                    );
                  })
                )}
              </div>
            )}
          </div>

        </div>
      </div>
    </div>
  );
}
