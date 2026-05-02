import { useState, useEffect, useMemo } from "react";
import { Link, useLocation } from "wouter";
import { useQuery, useMutation } from "@tanstack/react-query";
import { useAuth } from "@/hooks/use-auth";
import { apiRequest, queryClient } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";
import type { UserLocation } from "@shared/schema";
import {
  ArrowLeft, Eye, Snowflake, MousePointerClick, Users, Trash2, ExternalLink,
  AlertTriangle, BadgeCheck, ChevronDown, Calendar, Loader2, LogOut,
} from "lucide-react";
import {
  ResponsiveContainer, LineChart, Line, XAxis, YAxis, Tooltip, CartesianGrid, Legend,
} from "recharts";

type Stats = {
  views: { allTime: number; window: number };
  plunges: { allTime: number; window: number; uniquePlungers: number };
  clicks: Record<string, number>;
};

type TrendPoint = { date: string; views: number; plunges: number; clicks: number };

type LeaderRow = {
  username: string;
  userId: number | null;
  bestScore: number;
  plungeCount: number;
  lastPlungeAt: string;
};

const CLICK_LABELS: Record<string, string> = {
  website: "Website",
  booking: "Book Appointment",
  directions: "Get Directions",
  phone: "Phone",
  yelp: "Yelp Reviews",
  facebook: "Facebook",
};

export default function BusinessDashboard() {
  const auth = useAuth();
  const [, navigate] = useLocation();
  const { toast } = useToast();
  const [activeId, setActiveId] = useState<number | null>(null);
  const [days, setDays] = useState<7 | 30 | 90>(30);
  const [confirmDeleteId, setConfirmDeleteId] = useState<number | null>(null);

  // Auth gate
  useEffect(() => {
    if (!auth.user) navigate("/");
  }, [auth.user, navigate]);

  const { data: listings, isLoading: listingsLoading, error: listingsError } = useQuery<UserLocation[]>({
    queryKey: ["/api/business/my-listings", auth.user?.id],
    enabled: !!auth.user,
  });

  // Auto-select first listing
  useEffect(() => {
    if (!activeId && listings && listings.length > 0) setActiveId(listings[0].id);
  }, [listings, activeId]);

  const activeListing = useMemo(
    () => listings?.find((l) => l.id === activeId) ?? null,
    [listings, activeId],
  );

  const { data: stats, isLoading: statsLoading, error: statsError } = useQuery<Stats>({
    queryKey: ["/api/business", activeId, "stats", days, auth.user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/business/${activeId}/stats?days=${days}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
      });
      if (!r.ok) throw new Error(`stats ${r.status}`);
      return r.json();
    },
    enabled: !!activeId,
  });

  const { data: trend = [], isLoading: trendLoading, error: trendError } = useQuery<TrendPoint[]>({
    queryKey: ["/api/business", activeId, "trend", days, auth.user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/business/${activeId}/trend?days=${days}`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
      });
      if (!r.ok) throw new Error(`trend ${r.status}`);
      return r.json();
    },
    enabled: !!activeId,
  });

  const { data: leaderboard = [], isLoading: leaderLoading, error: leaderError } = useQuery<LeaderRow[]>({
    queryKey: ["/api/business", activeId, "leaderboard", auth.user?.id],
    queryFn: async () => {
      const r = await fetch(`/api/business/${activeId}/leaderboard?limit=50`, {
        headers: { Authorization: `Bearer ${localStorage.getItem("coldstreak-auth-token") ?? ""}` },
      });
      if (!r.ok) throw new Error(`leaderboard ${r.status}`);
      return r.json();
    },
    enabled: !!activeId,
  });

  const deleteListing = useMutation({
    mutationFn: async (id: number) => {
      await apiRequest("DELETE", `/api/community-locations/${id}`);
    },
    onSuccess: (_data, id) => {
      toast({ title: "Listing deleted", description: "Your business listing has been removed." });
      queryClient.invalidateQueries({ queryKey: ["/api/business/my-listings"] });
      queryClient.invalidateQueries({ queryKey: ["/api/community-locations"] });
      setConfirmDeleteId(null);
      if (activeId === id) setActiveId(null);
    },
    onError: (err: any) => {
      toast({ title: "Couldn't delete", description: err?.message ?? "Try again", variant: "destructive" });
    },
  });

  if (!auth.user) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center text-white">
        <p>Redirecting…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-950 via-slate-900 to-blue-950 text-white pb-20">
      {/* Header */}
      <div className="sticky top-0 z-10 bg-blue-950/95 backdrop-blur border-b border-blue-800/40 px-4 py-3 flex items-center gap-3">
        <Link href="/" data-testid="link-back-home">
          <button className="p-2 -ml-2 rounded-lg hover:bg-blue-900/50 transition-colors">
            <ArrowLeft className="w-5 h-5 text-cyan-400" />
          </button>
        </Link>
        <div className="flex-1 min-w-0">
          <h1 className="text-lg font-bold flex items-center gap-2">
            <BadgeCheck className="w-5 h-5 text-yellow-400" /> Business Dashboard
          </h1>
          <p className="text-blue-400 text-xs truncate">{auth.user.email}</p>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 py-5 space-y-5">
        {/* Loading */}
        {listingsLoading && (
          <div className="flex items-center justify-center py-12 text-blue-400">
            <Loader2 className="w-5 h-5 animate-spin mr-2" /> Loading your listings…
          </div>
        )}

        {/* Error */}
        {listingsError && (
          <div className="bg-red-900/30 border border-red-700/40 rounded-xl p-4">
            <p className="text-red-300 text-sm font-semibold">Couldn't load your listings.</p>
            <p className="text-red-400/80 text-xs mt-1">Make sure you're signed in with the email used on the listing's contact info.</p>
          </div>
        )}

        {/* Empty state */}
        {!listingsLoading && listings && listings.length === 0 && (
          <div className="bg-slate-900/60 border border-blue-800/40 rounded-2xl p-8 text-center">
            <BadgeCheck className="w-12 h-12 text-blue-700 mx-auto mb-3" />
            <h2 className="text-lg font-bold mb-2">No verified listings yet</h2>
            <p className="text-blue-400 text-sm max-w-md mx-auto mb-4">
              You don't own any verified business listings under <span className="text-cyan-300">{auth.user.email}</span>.
              Add or claim a listing from the Explore tab and complete verification to see analytics here.
            </p>
            <Link href="/" data-testid="link-explore">
              <button className="bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-bold px-5 py-2.5 rounded-xl text-sm">
                Go to Explore
              </button>
            </Link>
          </div>
        )}

        {/* Listing picker */}
        {listings && listings.length > 0 && (
          <div className="flex flex-wrap gap-2" data-testid="listing-picker">
            {listings.map((l) => (
              <button
                key={l.id}
                data-testid={`button-select-listing-${l.id}`}
                onClick={() => setActiveId(l.id)}
                className={`px-3 py-2 rounded-xl text-sm font-semibold border transition-all ${
                  activeId === l.id
                    ? "bg-cyan-500/20 border-cyan-500/60 text-cyan-200"
                    : "bg-blue-900/40 border-blue-800/40 text-blue-300 hover:border-blue-600/60"
                }`}
              >
                {l.name}
              </button>
            ))}
          </div>
        )}

        {/* Days selector */}
        {activeListing && (
          <div className="flex items-center gap-2 text-xs">
            <Calendar className="w-3.5 h-3.5 text-blue-500" />
            <span className="text-blue-400">Window:</span>
            {[7, 30, 90].map((d) => (
              <button
                key={d}
                data-testid={`button-days-${d}`}
                onClick={() => setDays(d as 7 | 30 | 90)}
                className={`px-2.5 py-1 rounded-lg font-semibold ${
                  days === d ? "bg-cyan-500 text-blue-950" : "bg-blue-900/40 text-blue-300 hover:bg-blue-900/60"
                }`}
              >
                Last {d}d
              </button>
            ))}
          </div>
        )}

        {/* Summary cards */}
        {activeListing && statsError && (
          <div
            data-testid="error-stats"
            className="bg-red-900/30 border border-red-700/40 rounded-xl p-4"
          >
            <p className="text-red-300 text-sm font-semibold">Couldn't load analytics for this listing.</p>
            <p className="text-red-400/80 text-xs mt-1">
              These numbers reflect a load error, not real activity. Try reloading or check your connection.
            </p>
          </div>
        )}
        {activeListing && !statsError && (
          <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
            <SummaryCard
              icon={<Eye className="w-4 h-4" />}
              label={`Views · ${days}d`}
              value={stats?.views.window ?? 0}
              sub={`${stats?.views.allTime ?? 0} all-time`}
              color="cyan"
              loading={statsLoading}
              testId="stat-views"
            />
            <SummaryCard
              icon={<Snowflake className="w-4 h-4" />}
              label={`Plunges · ${days}d`}
              value={stats?.plunges.window ?? 0}
              sub={`${stats?.plunges.allTime ?? 0} all-time`}
              color="blue"
              loading={statsLoading}
              testId="stat-plunges"
            />
            <SummaryCard
              icon={<Users className="w-4 h-4" />}
              label="Unique Plungers"
              value={stats?.plunges.uniquePlungers ?? 0}
              sub="all-time, distinct users"
              color="purple"
              loading={statsLoading}
              testId="stat-unique"
            />
            <SummaryCard
              icon={<MousePointerClick className="w-4 h-4" />}
              label={`Clicks · ${days}d`}
              value={Object.values(stats?.clicks ?? {}).reduce((a, b) => a + b, 0)}
              sub="outbound link taps"
              color="green"
              loading={statsLoading}
              testId="stat-clicks"
            />
          </div>
        )}

        {/* Click breakdown */}
        {activeListing && stats && Object.keys(stats.clicks).length > 0 && (
          <div className="bg-slate-900/60 border border-blue-800/40 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-blue-300 mb-3">Click breakdown · last {days}d</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {Object.entries(stats.clicks).map(([kind, count]) => (
                <div
                  key={kind}
                  data-testid={`click-row-${kind}`}
                  className="flex items-center justify-between bg-blue-950/60 rounded-lg px-3 py-2 border border-blue-800/30"
                >
                  <span className="text-blue-300 text-xs">{CLICK_LABELS[kind] ?? kind}</span>
                  <span className="text-white font-bold text-sm">{count}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Trend chart */}
        {activeListing && (
          <div className="bg-slate-900/60 border border-blue-800/40 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-blue-300 mb-3">Trend · last {days}d</h3>
            {trendError ? (
              <div data-testid="error-trend" className="h-56 flex flex-col items-center justify-center text-red-300 text-sm">
                <p className="font-semibold">Couldn't load trend data.</p>
                <p className="text-xs mt-1 text-red-400/80">Reload to try again.</p>
              </div>
            ) : trendLoading ? (
              <div className="h-56 flex items-center justify-center text-blue-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading chart…
              </div>
            ) : trend.every((p) => p.views === 0 && p.plunges === 0 && p.clicks === 0) ? (
              <div className="h-56 flex flex-col items-center justify-center text-blue-500 text-sm">
                <p>No activity yet in this window.</p>
                <p className="text-xs mt-1 text-blue-600">As users view, plunge, or tap your links, you'll see daily trends here.</p>
              </div>
            ) : (
              <div className="h-56 -mx-2">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={trend} margin={{ top: 8, right: 8, left: -12, bottom: 0 }}>
                    <CartesianGrid strokeDasharray="3 3" stroke="#1e3a5f" />
                    <XAxis
                      dataKey="date"
                      stroke="#5b8db8"
                      fontSize={10}
                      tickFormatter={(d) => d.slice(5)}
                      tickMargin={6}
                    />
                    <YAxis stroke="#5b8db8" fontSize={10} allowDecimals={false} />
                    <Tooltip
                      contentStyle={{ background: "#0c1e3d", border: "1px solid #1e3a5f", borderRadius: 8, fontSize: 12 }}
                      labelStyle={{ color: "#7dd3fc" }}
                    />
                    <Legend iconSize={8} wrapperStyle={{ fontSize: 11 }} />
                    <Line type="monotone" dataKey="views" stroke="#22d3ee" strokeWidth={2} dot={false} name="Views" />
                    <Line type="monotone" dataKey="plunges" stroke="#60a5fa" strokeWidth={2} dot={false} name="Plunges" />
                    <Line type="monotone" dataKey="clicks" stroke="#4ade80" strokeWidth={2} dot={false} name="Clicks" />
                  </LineChart>
                </ResponsiveContainer>
              </div>
            )}
          </div>
        )}

        {/* Leaderboard */}
        {activeListing && (
          <div className="bg-slate-900/60 border border-blue-800/40 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-blue-300 mb-3">Leaderboard at this location</h3>
            {leaderError ? (
              <div data-testid="error-leaderboard" className="py-6 text-center text-red-300 text-sm">
                <p className="font-semibold">Couldn't load leaderboard.</p>
                <p className="text-xs mt-1 text-red-400/80">Reload to try again.</p>
              </div>
            ) : leaderLoading ? (
              <div className="py-6 flex items-center justify-center text-blue-500 text-sm">
                <Loader2 className="w-4 h-4 animate-spin mr-2" /> Loading…
              </div>
            ) : leaderboard.length === 0 ? (
              <p className="text-blue-500 text-sm py-4 text-center">No plunges logged here yet.</p>
            ) : (
              <div className="overflow-x-auto -mx-1">
                <table className="w-full text-sm" data-testid="table-leaderboard">
                  <thead>
                    <tr className="text-blue-500 text-[10px] uppercase tracking-wide">
                      <th className="text-left px-2 py-1">#</th>
                      <th className="text-left px-2 py-1">Plunger</th>
                      <th className="text-right px-2 py-1">Best Score</th>
                      <th className="text-right px-2 py-1">Plunges</th>
                      <th className="text-right px-2 py-1 hidden sm:table-cell">Last seen</th>
                    </tr>
                  </thead>
                  <tbody>
                    {leaderboard.map((row, i) => (
                      <tr
                        key={`${row.username}-${i}`}
                        data-testid={`row-leader-${i}`}
                        className="border-t border-blue-900/40 hover:bg-blue-950/40"
                      >
                        <td className="px-2 py-2 text-blue-400 font-bold w-6">{i + 1}</td>
                        <td className="px-2 py-2 text-white font-semibold truncate max-w-[160px]">{row.username}</td>
                        <td className="px-2 py-2 text-cyan-300 text-right font-mono">{row.bestScore.toLocaleString()}</td>
                        <td className="px-2 py-2 text-blue-300 text-right">{row.plungeCount}</td>
                        <td className="px-2 py-2 text-blue-500 text-right text-xs hidden sm:table-cell">
                          {new Date(row.lastPlungeAt).toLocaleDateString()}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        )}

        {/* Subscription management — Apple compliance */}
        {activeListing && (
          <div className="bg-slate-900/60 border border-blue-800/40 rounded-2xl p-4">
            <h3 className="text-sm font-bold text-blue-300 mb-2">Manage subscription</h3>
            <p className="text-blue-400 text-xs mb-3">
              Cancel or change your verified-business subscription where you originally signed up.
            </p>
            <div className="flex flex-col sm:flex-row gap-2">
              <a
                href="https://apps.apple.com/account/subscriptions"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-manage-apple"
                className="flex-1 flex items-center justify-center gap-2 bg-blue-900/50 border border-blue-700/50 hover:border-blue-500/60 rounded-xl py-2.5 px-3 text-blue-200 text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> App Store (iOS)
              </a>
              <a
                href="https://play.google.com/store/account/subscriptions"
                target="_blank"
                rel="noopener noreferrer"
                data-testid="link-manage-google"
                className="flex-1 flex items-center justify-center gap-2 bg-blue-900/50 border border-blue-700/50 hover:border-blue-500/60 rounded-xl py-2.5 px-3 text-blue-200 text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Play Store (Android)
              </a>
              <a
                href="mailto:support@coldstreak.app?subject=Cancel%20business%20subscription"
                data-testid="link-manage-web"
                className="flex-1 flex items-center justify-center gap-2 bg-blue-900/50 border border-blue-700/50 hover:border-blue-500/60 rounded-xl py-2.5 px-3 text-blue-200 text-xs font-semibold transition-colors"
              >
                <ExternalLink className="w-3.5 h-3.5" /> Web subscription (email us)
              </a>
            </div>
          </div>
        )}

        {/* Danger zone */}
        {activeListing && (
          <div className="bg-red-950/30 border border-red-800/40 rounded-2xl p-4 space-y-3">
            <h3 className="text-sm font-bold text-red-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4" /> Danger zone
            </h3>
            {confirmDeleteId === activeListing.id ? (
              <div className="space-y-2">
                <p className="text-red-200 text-xs">
                  Permanently delete <strong>{activeListing.name}</strong> and all of its analytics data?
                  This cannot be undone. Your subscription is NOT cancelled — manage that above.
                </p>
                <div className="flex gap-2">
                  <button
                    data-testid="button-confirm-delete-listing"
                    disabled={deleteListing.isPending}
                    onClick={() => deleteListing.mutate(activeListing.id)}
                    className="flex-1 bg-red-600 hover:bg-red-500 text-white font-bold py-2 rounded-lg text-xs disabled:opacity-50"
                  >
                    {deleteListing.isPending ? "Deleting…" : "Yes, delete this listing"}
                  </button>
                  <button
                    data-testid="button-cancel-delete-listing"
                    disabled={deleteListing.isPending}
                    onClick={() => setConfirmDeleteId(null)}
                    className="flex-1 bg-blue-900/60 border border-blue-700/40 text-blue-200 font-semibold py-2 rounded-lg text-xs"
                  >
                    Cancel
                  </button>
                </div>
              </div>
            ) : (
              <button
                data-testid="button-delete-listing"
                onClick={() => setConfirmDeleteId(activeListing.id)}
                className="w-full flex items-center justify-center gap-2 bg-transparent border border-red-700/50 text-red-300 font-semibold py-2 rounded-lg text-xs hover:bg-red-900/30"
              >
                <Trash2 className="w-3.5 h-3.5" /> Delete this listing
              </button>
            )}
            <Link href="/delete-account" data-testid="link-delete-account">
              <button className="w-full flex items-center justify-center gap-2 bg-transparent border border-red-800/40 text-red-400/80 font-semibold py-2 rounded-lg text-xs hover:border-red-500/60 hover:text-red-300">
                <LogOut className="w-3.5 h-3.5" /> Delete my entire ColdStreak account
              </button>
            </Link>
          </div>
        )}
      </div>
    </div>
  );
}

function SummaryCard({
  icon, label, value, sub, color, loading, testId,
}: {
  icon: React.ReactNode;
  label: string;
  value: number;
  sub: string;
  color: "cyan" | "blue" | "purple" | "green";
  loading?: boolean;
  testId: string;
}) {
  const palette: Record<typeof color, string> = {
    cyan: "from-cyan-500/15 border-cyan-500/30 text-cyan-300",
    blue: "from-blue-500/15 border-blue-500/30 text-blue-300",
    purple: "from-purple-500/15 border-purple-500/30 text-purple-300",
    green: "from-green-500/15 border-green-500/30 text-green-300",
  };
  return (
    <div
      data-testid={testId}
      className={`bg-gradient-to-br ${palette[color]} to-slate-900/60 border rounded-2xl p-3`}
    >
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide opacity-80">
        {icon} {label}
      </div>
      <p className="text-2xl font-bold text-white mt-1.5 tabular-nums">
        {loading ? <span className="text-blue-700">—</span> : value.toLocaleString()}
      </p>
      <p className="text-[10px] text-blue-500 mt-0.5">{sub}</p>
    </div>
  );
}
