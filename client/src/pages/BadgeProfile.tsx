import { useParams, Link } from "wouter";
import { useQuery } from "@tanstack/react-query";
import { TEMP_TIERS, DAYS_TIERS, STATE_EMOJI } from "@/lib/passport";
import { useToast } from "@/hooks/use-toast";
import { Share2, IceCream2 } from "lucide-react";

interface BadgeProfile {
  username: string;
  featuredBadges: string;
  plungeCount: number;
  uniqueDays: number;
  coldestTemp: number | null;
  updatedAt: string;
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
  const { toast } = useToast();

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

  const handleShare = async () => {
    const url = `https://coldstreakapp.com/profile/${encodeURIComponent(username!)}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: `${username}'s Badge Profile`, url });
      } catch {}
    } else {
      await navigator.clipboard.writeText(url);
      toast({ title: "Link copied!", description: "Share this link with friends." });
    }
  };

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

  return (
    <div className="min-h-screen bg-blue-950 px-4 py-8 flex flex-col items-center">
      <div className="w-full max-w-sm space-y-4">

        {/* Branding */}
        <div className="text-center mb-1">
          <Link href="/" className="text-cyan-400 font-bold text-lg tracking-wide">
            🧊 ColdStreak
          </Link>
        </div>

        {/* Profile Header */}
        <div className="bg-blue-900/70 rounded-3xl px-5 pt-5 pb-4 border border-blue-700/50 text-center">
          <h1 data-testid="text-profile-username" className="text-white font-bold text-2xl mb-0.5">{profile.username}</h1>
          <p className="text-blue-400 text-xs mb-4">Badge Profile · Updated {updatedStr}</p>

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

        {/* Actions */}
        <div className="flex gap-3">
          <button
            data-testid="button-share-profile"
            onClick={handleShare}
            className="flex-1 flex items-center justify-center gap-2 bg-blue-800/70 border border-blue-600/50 text-white font-semibold py-3 rounded-2xl text-sm active:scale-95 transition-transform"
          >
            <Share2 className="w-4 h-4" /> Share Profile
          </button>
          <Link
            href="/"
            className="flex-1 flex items-center justify-center gap-2 bg-cyan-500 text-blue-950 font-bold py-3 rounded-2xl text-sm active:scale-95 transition-transform"
          >
            <IceCream2 className="w-4 h-4" /> Try ColdStreak
          </Link>
        </div>

      </div>
    </div>
  );
}
