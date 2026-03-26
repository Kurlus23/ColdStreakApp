import { useParams, Link, useLocation } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TEMP_TIERS, DAYS_TIERS, STATE_EMOJI } from "@/lib/passport";
import { X, Pencil, Share2 } from "lucide-react";
import { useAuth } from "@/hooks/use-auth";

interface BadgeProfile {
  username: string;
  featuredBadges: string;
  plungeCount: number;
  uniqueDays: number;
  coldestTemp: number | null;
  updatedAt: string;
  foundingPlunger: boolean;
  computed?: boolean;
}

function computeEarnedTempTiers(coldestTemp: number | null): Set<string> {
  if (coldestTemp === null) return new Set();
  const ordered = [...TEMP_TIERS].sort((a, b) => a.minTemp - b.minTemp);
  const earned = new Set<string>();
  let cascade = false;
  for (const t of ordered) {
    if (!cascade) cascade = coldestTemp >= t.minTemp && coldestTemp <= t.maxTemp;
    if (cascade) earned.add(t.id);
  }
  return earned;
}

export default function BadgeProfile() {
  const { username } = useParams<{ username: string }>();
  const [, navigate] = useLocation();
  const auth = useAuth();
  const myUsername = auth.user?.displayName ?? null;

  const { data: profile, isLoading, isError } = useQuery<BadgeProfile>({
    queryKey: ["/api/badge-profile", username],
    queryFn: async () => {
      const res = await fetch(`/api/badge-profile/${encodeURIComponent(username!)}`);
      if (!res.ok) throw new Error("Not found");
      return res.json();
    },
    enabled: !!username,
    retry: false,
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-blue-950 flex items-center justify-center">
        <div className="text-blue-300 text-center">
          <div className="text-4xl mb-3 animate-pulse">🧊</div>
          <p className="text-sm">Loading profile…</p>
        </div>
      </div>
    );
  }

  if (isError || !profile) {
    return (
      <div className="min-h-screen bg-blue-950 flex flex-col items-center justify-center px-6 text-center">
        <p className="text-5xl mb-4">🌊</p>
        <h1 className="text-white font-bold text-xl mb-2">Profile not found</h1>
        <p className="text-blue-400 text-sm mb-6">
          <strong>{username}</strong> hasn't published their badge profile yet.
        </p>
        <Link href="/" className="bg-cyan-500 text-blue-950 font-bold px-6 py-3 rounded-xl text-sm">
          Open ColdStreak
        </Link>
      </div>
    );
  }

  const featuredIds: string[] = (() => {
    try { return JSON.parse(profile.featuredBadges) as string[]; } catch { return []; }
  })();

  const earnedTempTierIds = computeEarnedTempTiers(profile.coldestTemp);
  const earnedDaysTierIds = new Set(DAYS_TIERS.filter((t) => profile.uniqueDays >= t.days).map((t) => t.id));

  const emojiLookup: Record<string, string> = {};
  TEMP_TIERS.forEach((t) => { emojiLookup[t.id] = t.emoji; });
  DAYS_TIERS.forEach((t) => { emojiLookup[t.id] = t.emoji; });
  Object.entries(STATE_EMOJI).forEach(([s, e]) => { emojiLookup[s] = e as string; });

  const totalEarnedTemp = earnedTempTierIds.size;
  const totalEarnedDays = earnedDaysTierIds.size;
  const totalEarned = totalEarnedTemp + totalEarnedDays;

  const updatedStr = new Date(profile.updatedAt).toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
  const isOwner = !!myUsername && myUsername.toLowerCase() === profile.username.toLowerCase();

  const handleShare = async () => {
    const url = `https://coldstreakapp.com/profile/${encodeURIComponent(profile.username)}`;
    if (navigator.share) {
      try { await navigator.share({ title: `${profile.username}'s Badge Profile on ColdStreak`, url }); } catch {}
    } else {
      try { await navigator.clipboard.writeText(url); } catch {}
    }
  };

  return (
    <div className="min-h-screen bg-blue-950 px-4 py-8 flex flex-col items-center">
      {/* Close button */}
      <button
        data-testid="button-close-profile"
        onClick={() => { if (window.history.length > 1) { window.history.back(); } else { navigate("/"); } }}
        className="fixed top-4 right-4 w-9 h-9 flex items-center justify-center rounded-full bg-blue-800/80 border border-blue-600/60 text-blue-300 hover:text-white hover:bg-blue-700/80 transition-all active:scale-90 z-50"
        title="Close"
      >
        <X className="w-4 h-4" />
      </button>

      <div className="w-full max-w-sm space-y-4">

        {/* Branding */}
        <div className="text-center mb-1">
          <span className="text-cyan-400 font-bold text-lg tracking-wide">🧊 ColdStreak</span>
        </div>

        {/* Owner actions */}
        {isOwner && (
          <div className="flex gap-2">
            <button
              data-testid="button-edit-badge-profile"
              onClick={() => navigate("/")}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-cyan-500/20 border border-cyan-400/40 text-cyan-300 text-xs font-semibold hover:bg-cyan-500/30 transition-all active:scale-95"
            >
              <Pencil className="w-3.5 h-3.5" /> Edit Featured Badges
            </button>
            <button
              data-testid="button-share-profile"
              onClick={handleShare}
              className="flex-1 flex items-center justify-center gap-1.5 py-2 rounded-xl bg-blue-800/60 border border-blue-600/40 text-blue-200 text-xs font-semibold hover:bg-blue-700/60 transition-all active:scale-95"
            >
              <Share2 className="w-3.5 h-3.5" /> Share Profile
            </button>
          </div>
        )}

        {/* Profile Header */}
        <div className="bg-blue-900/70 rounded-3xl px-5 pt-5 pb-4 border border-blue-700/50 text-center">
          <h1 data-testid="text-profile-username" className="text-white font-bold text-2xl mb-0.5">{profile.username}</h1>
          {profile.foundingPlunger && (
            <div className="flex justify-center mb-2">
              <span
                data-testid="badge-founding-plunger"
                className="inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-amber-500/20 border border-amber-400/40 text-amber-300 text-xs font-bold"
              >🎖️ Founding Plunger</span>
            </div>
          )}
          <p className="text-blue-400 text-xs mb-4">
            {profile.computed ? "Auto-generated profile" : `Badge Profile · Updated ${updatedStr}`}
          </p>
          {isOwner && profile.computed && (
            <p className="text-blue-500 text-[11px] mb-3 leading-relaxed">
              This is your auto-generated profile. Open the Badges section in Settings to set your featured badges.
            </p>
          )}

          {featuredIds.length > 0 && (
            <div className="flex justify-center flex-wrap gap-1 mb-4">
              {featuredIds.map((id) => (
                <span key={id} data-testid={`badge-featured-${id}`} className="text-3xl leading-none">{emojiLookup[id] ?? "🏆"}</span>
              ))}
            </div>
          )}

          {/* Stats */}
          <div className="flex justify-center gap-5 text-center mt-1">
            <div>
              <div data-testid="stat-plunge-count" className="text-white font-bold text-xl">{profile.plungeCount}</div>
              <div className="text-blue-400 text-[11px]">plunges</div>
            </div>
            <div className="w-px bg-blue-700/60" />
            <div>
              <div data-testid="stat-unique-days" className="text-white font-bold text-xl">{profile.uniqueDays}</div>
              <div className="text-blue-400 text-[11px]">days</div>
            </div>
            {profile.coldestTemp !== null && (
              <>
                <div className="w-px bg-blue-700/60" />
                <div>
                  <div data-testid="stat-coldest-temp" className="text-white font-bold text-xl">{profile.coldestTemp}°F</div>
                  <div className="text-blue-400 text-[11px]">coldest</div>
                </div>
              </>
            )}
          </div>
        </div>

        {/* Temperature Tiers */}
        {totalEarnedTemp > 0 && (
          <div className="bg-blue-900/60 rounded-2xl border border-blue-700/40 px-4 py-3">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-2">Temperature Tiers</p>
            <div className="space-y-2">
              {[...TEMP_TIERS].reverse().map((tier) => {
                const earned = earnedTempTierIds.has(tier.id);
                if (!earned) return null;
                return (
                  <div key={tier.id} data-testid={`badge-temp-${tier.id}`} className="flex items-center gap-3">
                    <span className="text-2xl leading-none w-8 text-center">{tier.emoji}</span>
                    <div>
                      <div className="text-white text-sm font-semibold">{tier.label}</div>
                      <div className="text-blue-400 text-xs">{tier.minTemp === 0 ? `≤${tier.maxTemp}°F` : `${tier.minTemp}–${tier.maxTemp}°F`}</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Days Tiers */}
        {totalEarnedDays > 0 && (
          <div className="bg-blue-900/60 rounded-2xl border border-blue-700/40 px-4 py-3">
            <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-2">Days Plunged</p>
            <div className="space-y-2">
              {[...DAYS_TIERS].reverse().map((tier) => {
                const earned = earnedDaysTierIds.has(tier.id);
                if (!earned) return null;
                return (
                  <div key={tier.id} data-testid={`badge-days-${tier.id}`} className="flex items-center gap-3">
                    <span className="text-2xl leading-none w-8 text-center">{tier.emoji}</span>
                    <div>
                      <div className="text-white text-sm font-semibold">{tier.label}</div>
                      <div className="text-blue-400 text-xs">{tier.days}+ days</div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {totalEarned === 0 && (
          <div className="bg-blue-900/40 rounded-2xl border border-blue-800/40 px-4 py-5 text-center">
            <p className="text-blue-400 text-sm">No badges earned yet — stay cold!</p>
          </div>
        )}

      </div>
    </div>
  );
}
