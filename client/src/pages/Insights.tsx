/**
 * /insights — web dashboard for personalised cold-plunge analytics.
 *
 * Auth-gated: reads the same JWT the app uses (via apiRequest).
 * Data: fetched from /api/plunges (same endpoint the app uses).
 *
 * Progressive unlock thresholds:
 *   1+  plunges          → Overview stats
 *   5+  rated check-ins  → Feel Patterns
 *   10+ rated check-ins  → Sweet Spot
 *   10+ rated + morning  → Morning Advantage
 *   20+ rated check-ins  → Cold Adaptation Trend
 *   2+  calendar months  → Monthly Trend chart
 */

import { useQuery } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { type Plunge } from "@shared/schema";

// ─── Shared helpers (ported from server/reports.ts) ───────────────────────────

const TEMP_BANDS = [
  { min: 0,   max: 40,  label: "35–40°F" },
  { min: 40,  max: 45,  label: "40–45°F" },
  { min: 45,  max: 50,  label: "45–50°F" },
  { min: 50,  max: 55,  label: "50–55°F" },
  { min: 55,  max: 60,  label: "55–60°F" },
  { min: 60,  max: 999, label: "60°F+"   },
];

const DUR_BANDS = [
  { min: 0,   max: 90,       label: "< 1.5 min"  },
  { min: 90,  max: 180,      label: "1.5–3 min"  },
  { min: 180, max: 360,      label: "3–6 min"    },
  { min: 360, max: Infinity, label: "6+ min"     },
];

interface BandStat {
  label: string; moodSum: number; energySum: number;
  count: number; moodCount: number; energyCount: number;
}

interface Insight {
  tempLabel: string | null; durLabel: string | null;
  morningBest: boolean | null; morningAvg: number | null; otherAvg: number | null;
  diminishing: boolean; sweetSpotFor: string | null; sampleSize: number;
}

function analysePatterns(plunges: Plunge[]): Insight {
  const rated = plunges.filter((p) => p.mood != null);
  const result: Insight = {
    tempLabel: null, durLabel: null, morningBest: null,
    morningAvg: null, otherAvg: null,
    diminishing: false, sweetSpotFor: null, sampleSize: rated.length,
  };

  if (rated.length < 3) return result;

  // ── Temp bands ──
  const tempMap = new Map<string, BandStat>();
  for (const b of TEMP_BANDS)
    tempMap.set(b.label, { label: b.label, moodSum: 0, energySum: 0, count: 0, moodCount: 0, energyCount: 0 });
  for (const p of rated) {
    const band = TEMP_BANDS.find((b) => p.temperature >= b.min && p.temperature < b.max) ?? TEMP_BANDS[TEMP_BANDS.length - 1];
    const s = tempMap.get(band.label)!;
    s.count++; s.moodSum += p.mood!; s.moodCount++;
    if (p.moodEnergy != null) { s.energySum += p.moodEnergy; s.energyCount++; }
  }
  let bestTempScore = -1;
  for (const s of Array.from(tempMap.values())) {
    if (s.moodCount < 2) continue;
    const moodNorm   = (s.moodSum / s.moodCount - 1) / 4;
    const energyNorm = s.energyCount > 0 ? (s.energySum / s.energyCount - 1) / 2 : moodNorm;
    const score = (moodNorm + energyNorm) / 2;
    if (score > bestTempScore) { bestTempScore = score; result.tempLabel = s.label; }
  }

  // ── Duration bands ──
  const durMap = new Map<string, BandStat>();
  for (const b of DUR_BANDS)
    durMap.set(b.label, { label: b.label, moodSum: 0, energySum: 0, count: 0, moodCount: 0, energyCount: 0 });
  for (const p of rated) {
    const band = DUR_BANDS.find((b) => p.duration >= b.min && p.duration < b.max) ?? DUR_BANDS[DUR_BANDS.length - 1];
    const s = durMap.get(band.label)!;
    s.count++; s.moodSum += p.mood!; s.moodCount++;
    if (p.moodEnergy != null) { s.energySum += p.moodEnergy; s.energyCount++; }
  }
  let bestDurScore = -1;
  for (const s of Array.from(durMap.values())) {
    if (s.moodCount < 2) continue;
    const moodNorm   = (s.moodSum / s.moodCount - 1) / 4;
    const energyNorm = s.energyCount > 0 ? (s.energySum / s.energyCount - 1) / 2 : moodNorm;
    const score = (moodNorm + energyNorm) / 2;
    if (score > bestDurScore) { bestDurScore = score; result.durLabel = s.label; }
  }

  // ── Diminishing returns ──
  const b36  = durMap.get("3–6 min");
  const b6pl = durMap.get("6+ min");
  if (b36 && b6pl && b36.moodCount >= 2 && b6pl.moodCount >= 2) {
    result.diminishing = (b6pl.moodSum / b6pl.moodCount) < (b36.moodSum / b36.moodCount) - 0.3;
  }

  // ── Morning vs rest ──
  let morningSum = 0, morningN = 0, otherSum = 0, otherN = 0;
  for (const p of rated) {
    const h = new Date(p.createdAt).getUTCHours();
    if (h >= 5 && h < 10) { morningSum += p.mood!; morningN++; }
    else                   { otherSum   += p.mood!; otherN++;   }
  }
  if (morningN >= 2 && otherN >= 2) {
    const ma = morningSum / morningN;
    const oa = otherSum   / otherN;
    result.morningBest = ma > oa + 0.25;
    result.morningAvg  = Math.round(ma * 10) / 10;
    result.otherAvg    = Math.round(oa * 10) / 10;
  }

  // ── Sweet spot label ──
  if (result.tempLabel && result.durLabel) {
    const best = tempMap.get(result.tempLabel);
    const moodGood   = best && best.moodCount   > 0 && (best.moodSum   / best.moodCount)   >= 4;
    const energyGood = best && best.energyCount > 0 && (best.energySum / best.energyCount) >= 2.5;
    result.sweetSpotFor = moodGood && energyGood ? "Mood + Energy" : moodGood ? "Mood" : energyGood ? "Energy" : "Overall";
  }

  return result;
}

// Adaptation trend: first 10 vs most recent 10 rated check-ins
function compositeScore(p: Plunge) {
  const m = p.mood       != null ? (p.mood       - 1) / 4 : null;
  const e = p.moodEnergy != null ? (p.moodEnergy - 1) / 2 : null;
  if (m === null && e === null) return 0;
  if (m === null) return e!;
  if (e === null) return m;
  return (m + e) / 2;
}

interface AdaptationResult {
  earlyAvg: number; recentAvg: number; delta: number;
  deltaStr: string; metrics: string[];
}

function computeAdaptation(plunges: Plunge[]): AdaptationResult | null {
  const rated = plunges.filter((p) => p.mood != null)
    .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());
  if (rated.length < 20) return null;

  const first10  = rated.slice(0, 10);
  const recent10 = rated.slice(-10);
  const avg = (g: Plunge[]) => g.map(compositeScore).reduce((s, v) => s + v, 0) / g.length;
  const earlyAvg  = avg(first10);
  const recentAvg = avg(recent10);
  const delta = recentAvg - earlyAvg;
  if (Math.abs(delta) < 0.03) return null;

  const avgOf = (g: Plunge[], fn: (p: Plunge) => number | null) => {
    const vals = g.map(fn).filter((v): v is number => v != null);
    return vals.length > 0 ? vals.reduce((s, v) => s + v, 0) / vals.length : null;
  };

  const metrics: string[] = [];
  const em0 = avgOf(first10,  (p) => p.mood);
  const em1 = avgOf(recent10, (p) => p.mood);
  const ee0 = avgOf(first10,  (p) => p.moodEnergy);
  const ee1 = avgOf(recent10, (p) => p.moodEnergy);
  const ef0 = avgOf(first10,  (p) => p.moodFocus);
  const ef1 = avgOf(recent10, (p) => p.moodFocus);
  if (em0 != null && em1 != null && em1 > em0 + 0.2)  metrics.push("Mood");
  if (ee0 != null && ee1 != null && ee1 > ee0 + 0.15) metrics.push("Energy");
  if (ef0 != null && ef1 != null && ef1 > ef0 + 0.15) metrics.push("Focus");
  if (metrics.length === 0) metrics.push("overall responses");

  return { earlyAvg, recentAvg, delta, deltaStr: `${delta >= 0 ? "+" : ""}${Math.round(delta * 100)}%`, metrics };
}

// Monthly grouping (same logic as ColdAdaptationCard)
const MONTH_LABELS = ["Jan","Feb","Mar","Apr","May","Jun","Jul","Aug","Sep","Oct","Nov","Dec"];

interface MonthStats {
  key: string; label: string; fullLabel: string; year: number; month: number;
  avgMood: number | null; avgEnergy: number | null; avgFocus: number | null; count: number;
}

function computeMonthly(plunges: Plunge[]): MonthStats[] {
  const rated = plunges.filter((p) => p.mood != null);
  const map = new Map<string, { moodSum: number; energySum: number; focusSum: number; moodC: number; energyC: number; focusC: number; year: number; month: number }>();
  for (const p of rated) {
    const d = new Date(p.createdAt);
    const year = d.getUTCFullYear(), month = d.getUTCMonth();
    const key = `${year}-${String(month).padStart(2, "0")}`;
    if (!map.has(key)) map.set(key, { moodSum: 0, energySum: 0, focusSum: 0, moodC: 0, energyC: 0, focusC: 0, year, month });
    const s = map.get(key)!;
    if (p.mood       != null) { s.moodSum   += p.mood;       s.moodC++;   }
    if (p.moodEnergy != null) { s.energySum += p.moodEnergy; s.energyC++; }
    if (p.moodFocus  != null) { s.focusSum  += p.moodFocus;  s.focusC++;  }
  }
  return Array.from(map.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([key, s]): MonthStats => ({
      key, year: s.year, month: s.month,
      label:     MONTH_LABELS[s.month],
      fullLabel: `${MONTH_LABELS[s.month]} ${s.year}`,
      avgMood:   s.moodC   > 0 ? Math.round((s.moodSum   / s.moodC)   * 10) / 10 : null,
      avgEnergy: s.energyC > 0 ? Math.round((s.energySum / s.energyC) * 10) / 10 : null,
      avgFocus:  s.focusC  > 0 ? Math.round((s.focusSum  / s.focusC)  * 10) / 10 : null,
      count: s.moodC,
    }));
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function StatTile({ value, label, color = "#22d3ee" }: { value: string; label: string; color?: string }) {
  return (
    <div className="bg-blue-900/50 border border-blue-800/60 rounded-2xl p-4 text-center">
      <p className="text-3xl font-bold leading-none" style={{ color }}>{value}</p>
      <p className="text-blue-400 text-xs uppercase tracking-widest mt-2 font-semibold">{label}</p>
    </div>
  );
}

function SectionHeader({ emoji, title, subtitle }: { emoji: string; title: string; subtitle?: string }) {
  return (
    <div className="flex items-center gap-3 mb-5">
      <span className="text-2xl">{emoji}</span>
      <div>
        <h2 className="text-white font-bold text-lg leading-tight">{title}</h2>
        {subtitle && <p className="text-blue-400 text-sm mt-0.5">{subtitle}</p>}
      </div>
    </div>
  );
}

function LockedSection({ title, emoji, need, have }: { title: string; emoji: string; need: number; have: number }) {
  const pct = Math.min(100, Math.round((have / need) * 100));
  return (
    <div className="bg-blue-950/60 border border-blue-800/40 rounded-2xl p-5 opacity-70">
      <div className="flex items-center gap-3 mb-4">
        <span className="text-xl opacity-50">{emoji}</span>
        <div>
          <p className="text-blue-300 font-semibold text-sm">{title}</p>
          <p className="text-blue-500 text-xs mt-0.5">
            🔒 {need - have} more check-in{need - have === 1 ? "" : "s"} to unlock
          </p>
        </div>
      </div>
      <div className="h-1.5 bg-blue-900/80 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-700"
          style={{ width: `${pct}%`, background: "linear-gradient(90deg,#1d4ed8,#22d3ee)" }}
        />
      </div>
      <p className="text-blue-600 text-xs mt-2">{have} of {need} check-ins</p>
    </div>
  );
}

function DistBar({ label, count, total, color }: { label: string; count: number; total: number; color: string }) {
  if (count === 0) return null;
  const pct = total > 0 ? Math.round((count / total) * 100) : 0;
  return (
    <div className="flex items-center gap-3">
      <span className="text-sm text-blue-300 w-28 shrink-0">{label}</span>
      <div className="flex-1 h-2.5 bg-blue-900/70 rounded-full overflow-hidden">
        <div className="h-full rounded-full" style={{ width: `${pct}%`, backgroundColor: color }} />
      </div>
      <span className="text-blue-400 text-sm w-16 text-right shrink-0">{count}× ({pct}%)</span>
    </div>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function Insights() {
  const { data: user, isLoading: userLoading, isError: userError } = useQuery<{
    id: number; email: string; emailVerified: boolean; isAdmin: boolean; displayName?: string; username?: string;
  }>({
    queryKey: ["/api/auth/me"],
    retry: false,
  });

  const { data: plunges = [], isLoading: plungesLoading } = useQuery<Plunge[]>({
    queryKey: ["/api/plunges"],
    enabled: !!user,
  });

  const loading = userLoading || plungesLoading;

  // ── Derived data ──────────────────────────────────────────────────────────
  const rated       = plunges.filter((p) => p.mood != null);
  const ratedCount  = rated.length;
  const totalSec    = plunges.reduce((s, p) => s + p.duration, 0);
  const totalMin    = Math.round(totalSec / 60);
  const uniqueDays  = new Set(plunges.map((p) => new Date(p.createdAt).toISOString().slice(0, 10))).size;
  const bestScore   = Math.max(0, ...plunges.map((p) => parseFloat(p.score ?? "0")));

  const insight     = ratedCount >= 3 ? analysePatterns(plunges) : null;
  const adaptation  = computeAdaptation(plunges);
  const months      = computeMonthly(plunges);

  const moodCounts:     Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const energyCounts:   Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  // moodFatigue present → recovery check-in: moodFocus = "Recovery feeling", moodFatigue = "Muscle fatigue"
  const fatigueCounts:  Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const recoveryCounts: Record<number, number> = { 1: 0, 2: 0, 3: 0 }; // moodFocus on recovery check-ins
  const focusCounts:    Record<number, number> = { 1: 0, 2: 0, 3: 0 }; // moodFocus on non-recovery check-ins
  for (const p of rated) {
    moodCounts[p.mood!]++;
    if (p.moodEnergy  != null) energyCounts[p.moodEnergy]++;
    if (p.moodFatigue != null) fatigueCounts[p.moodFatigue]++;
    if (p.moodFocus   != null) {
      if (p.moodFatigue != null) recoveryCounts[p.moodFocus]++;
      else                       focusCounts[p.moodFocus]++;
    }
  }
  const energyResponded   = rated.filter((p) => p.moodEnergy  != null).length;
  const fatigueResponded  = rated.filter((p) => p.moodFatigue != null).length;
  const recoveryResponded = rated.filter((p) => p.moodFatigue != null && p.moodFocus != null).length;
  const focusResponded    = rated.filter((p) => p.moodFatigue == null  && p.moodFocus != null).length;
  const avgMood     = ratedCount       > 0 ? (rated.reduce((s, p) => s + p.mood!, 0)                                                            / ratedCount)       : null;
  const avgEnergy   = energyResponded  > 0 ? (rated.filter((p) => p.moodEnergy  != null).reduce((s, p) => s + p.moodEnergy!,  0) / energyResponded)  : null;
  const avgFatigue  = fatigueResponded > 0 ? (rated.filter((p) => p.moodFatigue != null).reduce((s, p) => s + p.moodFatigue!, 0) / fatigueResponded) : null;
  const avgRecovery = recoveryResponded > 0 ? (rated.filter((p) => p.moodFatigue != null && p.moodFocus != null).reduce((s, p) => s + p.moodFocus!, 0) / recoveryResponded) : null;
  const avgFocus    = focusResponded   > 0 ? (rated.filter((p) => p.moodFatigue == null  && p.moodFocus != null).reduce((s, p) => s + p.moodFocus!,  0) / focusResponded)   : null;

  const hasMonthly      = months.length >= 2;
  const hasMorning      = insight?.morningBest != null;
  const hasSweetSpot    = ratedCount >= 10 && insight?.tempLabel && insight?.durLabel;
  const hasAdaptation   = adaptation !== null;

  // Unlock progress steps
  const steps = [
    { label: "First plunge",     need: 1,  have: plunges.length, color: "#22d3ee" },
    { label: "Feel Patterns",    need: 5,  have: ratedCount,     color: "#6ee7b7" },
    { label: "Sweet Spot",       need: 10, have: ratedCount,     color: "#fbbf24" },
    { label: "Adaptation Trend", need: 20, have: ratedCount,     color: "#a78bfa" },
  ];

  const userName = user?.displayName || user?.username || "there";

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="min-h-screen bg-blue-950 text-white">

      {/* Header */}
      <header className="border-b border-blue-800/60 bg-blue-950/90 backdrop-blur-sm sticky top-0 z-10">
        <div className="max-w-4xl mx-auto px-4 sm:px-6 h-16 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <span className="text-2xl">🧊</span>
            <div>
              <p className="text-white font-bold text-base leading-tight">ColdStreak</p>
              <p className="text-blue-400 text-xs leading-tight">Your Insights</p>
            </div>
          </div>
          {user && (
            <div className="flex items-center gap-3">
              <p className="text-blue-300 text-sm hidden sm:block">Hey, {userName} 👋</p>
              <a
                href="/"
                className="flex items-center gap-1.5 text-xs font-semibold text-blue-400 hover:text-cyan-300 transition-colors border border-blue-700/60 rounded-xl px-3 py-1.5 hover:border-cyan-500/50"
              >
                ← Open app
              </a>
            </div>
          )}
        </div>
      </header>

      <main className="max-w-4xl mx-auto px-4 sm:px-6 py-8 space-y-8">

        {/* ── Loading ── */}
        {loading && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <div className="w-10 h-10 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
            <p className="text-blue-400 text-sm">Loading your insights…</p>
          </div>
        )}

        {/* ── Not logged in ── */}
        {!loading && userError && (
          <div className="text-center py-24 space-y-4">
            <p className="text-5xl">🔒</p>
            <h2 className="text-white font-bold text-xl">Log in to see your insights</h2>
            <p className="text-blue-400 text-sm max-w-sm mx-auto leading-relaxed">
              Your insights are tied to your ColdStreak account. Open the app, log in, then return here — your session carries over automatically.
            </p>
            <a
              href="/"
              className="inline-block mt-2 bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              Open ColdStreak app
            </a>
          </div>
        )}

        {/* ── No plunges yet ── */}
        {!loading && user && plunges.length === 0 && (
          <div className="text-center py-24 space-y-4">
            <p className="text-5xl">🥶</p>
            <h2 className="text-white font-bold text-xl">No plunges logged yet</h2>
            <p className="text-blue-400 text-sm max-w-sm mx-auto leading-relaxed">
              Log your first plunge in the app and your insights will appear here automatically.
            </p>
            <a
              href="/"
              className="inline-block mt-2 bg-cyan-500 hover:bg-cyan-400 text-blue-950 font-bold text-sm px-6 py-3 rounded-xl transition-colors"
            >
              ← Back to app
            </a>
          </div>
        )}

        {/* ── Dashboard (has plunges) ── */}
        {!loading && user && plunges.length > 0 && (
          <>
            {/* Overview stats */}
            <section>
              <SectionHeader emoji="📊" title="All-time Overview" />
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                <StatTile value={String(plunges.length)}               label="Total plunges"   color="#22d3ee" />
                <StatTile value={`${totalMin}`}                         label="Cold minutes"    color="#6ee7b7" />
                <StatTile value={String(uniqueDays)}                    label="Active days"     color="#fbbf24" />
                <StatTile value={ratedCount > 0 ? String(ratedCount) : "—"} label="Check-ins"  color="#a78bfa" />
              </div>
            </section>

            {/* Unlock progress — shown while building data */}
            {ratedCount < 20 && (
              <section>
                <SectionHeader
                  emoji="🔓"
                  title="Insights Progress"
                  subtitle="Complete check-ins after plunges to unlock each section"
                />
                <div className="bg-blue-900/30 border border-blue-800/40 rounded-2xl p-5 space-y-4">
                  {steps.map((s) => {
                    const done = s.have >= s.need;
                    const pct  = Math.min(100, Math.round((s.have / s.need) * 100));
                    return (
                      <div key={s.label}>
                        <div className="flex items-center justify-between mb-1.5">
                          <span className={`text-sm font-semibold ${done ? "text-white" : "text-blue-400"}`}>
                            {done ? "✓ " : ""}{s.label}
                          </span>
                          <span className="text-blue-500 text-xs">{Math.min(s.have, s.need)}/{s.need}</span>
                        </div>
                        <div className="h-1.5 bg-blue-900 rounded-full overflow-hidden">
                          <div
                            className="h-full rounded-full transition-all duration-700"
                            style={{ width: `${pct}%`, backgroundColor: done ? s.color : "#1e40af" }}
                          />
                        </div>
                      </div>
                    );
                  })}
                </div>
              </section>
            )}

            {/* ── Feel Patterns ── */}
            <section>
              <SectionHeader
                emoji="💭"
                title="How You Feel After Plunging"
                subtitle={ratedCount >= 5 ? `Based on ${ratedCount} check-ins` : undefined}
              />
              {ratedCount >= 5 ? (
                <div className="bg-blue-900/40 border border-blue-800/50 rounded-2xl p-5 space-y-6">

                  {/* Avg summary row */}
                  <div className={`grid gap-3 pb-4 border-b border-blue-800/40 ${fatigueResponded > 0 ? "grid-cols-2 sm:grid-cols-4" : "grid-cols-3"}`}>
                    <div className="text-center">
                      <p className="text-cyan-300 text-2xl font-bold">{avgMood != null ? avgMood.toFixed(1) : "—"}</p>
                      <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">Avg Mood</p>
                      <p className="text-blue-500 text-[10px]">out of 5</p>
                    </div>
                    <div className="text-center">
                      <p className="text-amber-300 text-2xl font-bold">{avgEnergy != null ? avgEnergy.toFixed(1) : "—"}</p>
                      <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">Avg Energy</p>
                      <p className="text-blue-500 text-[10px]">out of 3</p>
                    </div>
                    {fatigueResponded > 0 ? (
                      <>
                        <div className="text-center">
                          <p className="text-orange-300 text-2xl font-bold">{avgFatigue != null ? avgFatigue.toFixed(1) : "—"}</p>
                          <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">Avg Fatigue</p>
                          <p className="text-blue-500 text-[10px]">out of 3</p>
                        </div>
                        <div className="text-center">
                          <p className="text-emerald-300 text-2xl font-bold">{avgRecovery != null ? avgRecovery.toFixed(1) : "—"}</p>
                          <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">Avg Recovery</p>
                          <p className="text-blue-500 text-[10px]">out of 3</p>
                        </div>
                      </>
                    ) : (
                      <div className="text-center">
                        <p className="text-violet-300 text-2xl font-bold">{avgFocus != null ? avgFocus.toFixed(1) : "—"}</p>
                        <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">Avg Focus</p>
                        <p className="text-blue-500 text-[10px]">out of 3</p>
                      </div>
                    )}
                  </div>

                  {/* Mood distribution */}
                  <div className="space-y-2">
                    <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">😊 Mood distribution</p>
                    <DistBar label="😄 Great (5)"  count={moodCounts[5]} total={ratedCount} color="#22d3ee" />
                    <DistBar label="🙂 Good (4)"   count={moodCounts[4]} total={ratedCount} color="#38bdf8" />
                    <DistBar label="😐 OK (3)"     count={moodCounts[3]} total={ratedCount} color="#6ee7b7" />
                    <DistBar label="😕 Low (2)"    count={moodCounts[2]} total={ratedCount} color="#64748b" />
                    <DistBar label="😞 Rough (1)"  count={moodCounts[1]} total={ratedCount} color="#475569" />
                  </div>

                  {/* Energy distribution */}
                  {energyResponded >= 3 && (
                    <div className="space-y-2">
                      <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">⚡ Energy distribution</p>
                      <DistBar label="🔋 Energized (3)" count={energyCounts[3]} total={energyResponded} color="#fbbf24" />
                      <DistBar label="⚡ Neutral (2)"   count={energyCounts[2]} total={energyResponded} color="#a3a3a3" />
                      <DistBar label="💤 Drained (1)"   count={energyCounts[1]} total={energyResponded} color="#475569" />
                    </div>
                  )}

                  {/* Focus distribution — only for non-recovery check-ins */}
                  {focusResponded >= 3 && (
                    <div className="space-y-2">
                      <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">🧠 Focus distribution</p>
                      <DistBar label="🎯 Better (3)"  count={focusCounts[3]} total={focusResponded} color="#a78bfa" />
                      <DistBar label="🧠 Same (2)"    count={focusCounts[2]} total={focusResponded} color="#a3a3a3" />
                      <DistBar label="🌫️ Worse (1)"   count={focusCounts[1]} total={focusResponded} color="#475569" />
                    </div>
                  )}

                  {/* Muscle fatigue distribution — recovery check-ins only */}
                  {fatigueResponded >= 3 && (
                    <div className="space-y-2">
                      <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">💪 Muscle fatigue distribution</p>
                      <DistBar label="💪 Relieved (3)"    count={fatigueCounts[3]} total={fatigueResponded} color="#f97316" />
                      <DistBar label="😐 Neutral (2)"     count={fatigueCounts[2]} total={fatigueResponded} color="#a3a3a3" />
                      <DistBar label="😣 Still sore (1)"  count={fatigueCounts[1]} total={fatigueResponded} color="#475569" />
                    </div>
                  )}

                  {/* Recovery feeling distribution — recovery check-ins only */}
                  {recoveryResponded >= 3 && (
                    <div className="space-y-2">
                      <p className="text-blue-300 text-xs font-semibold uppercase tracking-widest mb-3">🔄 Recovery distribution</p>
                      <DistBar label="✨ Restored (3)"  count={recoveryCounts[3]} total={recoveryResponded} color="#34d399" />
                      <DistBar label="😐 Somewhat (2)"  count={recoveryCounts[2]} total={recoveryResponded} color="#a3a3a3" />
                      <DistBar label="😓 Not yet (1)"   count={recoveryCounts[1]} total={recoveryResponded} color="#475569" />
                    </div>
                  )}
                </div>
              ) : (
                <LockedSection title="Feel Patterns" emoji="💭" need={5} have={ratedCount} />
              )}
            </section>

            {/* ── Sweet Spot ── */}
            <section>
              <SectionHeader
                emoji="🎯"
                title="Your Sweet Spot"
                subtitle={hasSweetSpot ? `Temperature & duration associated with your best responses` : undefined}
              />
              {hasSweetSpot && insight ? (
                <div className="bg-gradient-to-br from-blue-950 to-slate-900 border border-cyan-500/30 rounded-2xl p-5">
                  <div className="grid grid-cols-3 gap-3 mb-4">
                    <div className="bg-blue-900/50 rounded-xl p-3 text-center">
                      <p className="text-cyan-300 text-xl font-bold">{insight.tempLabel}</p>
                      <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">Temperature</p>
                    </div>
                    <div className="bg-blue-900/50 rounded-xl p-3 text-center">
                      <p className="text-cyan-300 text-xl font-bold">{insight.durLabel}</p>
                      <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">Duration</p>
                    </div>
                    <div className="bg-blue-900/50 rounded-xl p-3 text-center">
                      <p className="text-emerald-300 text-xl font-bold">{insight.sweetSpotFor}</p>
                      <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">Best for</p>
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <p className="text-blue-400 text-xs">
                      Based on {ratedCount} check-ins
                    </p>
                    <span
                      className="text-xs font-semibold px-2.5 py-1 rounded-full border"
                      style={{
                        color: ratedCount >= 30 ? "#22d3ee" : ratedCount >= 15 ? "#fbbf24" : "#94a3b8",
                        borderColor: (ratedCount >= 30 ? "#22d3ee" : ratedCount >= 15 ? "#fbbf24" : "#94a3b8") + "44",
                        background:  (ratedCount >= 30 ? "#22d3ee" : ratedCount >= 15 ? "#fbbf24" : "#94a3b8") + "15",
                      }}
                    >
                      {ratedCount >= 30 ? "High confidence" : ratedCount >= 15 ? "Medium confidence" : "Low confidence"}
                    </span>
                  </div>

                  {/* Diminishing returns callout */}
                  {insight.diminishing && (
                    <div className="mt-4 bg-amber-900/20 border border-amber-500/25 rounded-xl p-3">
                      <p className="text-amber-300 text-sm font-semibold mb-1">📉 Diminishing returns detected</p>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        Sessions longer than 6 minutes aren't associated with meaningfully higher Mood or Energy ratings compared to your 3–6 minute plunges. More time isn't always better.
                      </p>
                    </div>
                  )}
                </div>
              ) : (
                <LockedSection title="Sweet Spot" emoji="🎯" need={10} have={ratedCount} />
              )}
            </section>

            {/* ── Morning Advantage ── */}
            {hasMorning && insight && (
              <section>
                <SectionHeader emoji="🌅" title="Morning Advantage" />
                <div className="bg-blue-900/40 border border-blue-800/50 rounded-2xl p-5">
                  {insight.morningBest ? (
                    <>
                      <p className="text-white font-semibold mb-3">Your pre-10 AM plunges score higher</p>
                      <div className="grid grid-cols-2 gap-3 mb-4">
                        <div className="bg-amber-900/20 border border-amber-500/30 rounded-xl p-3 text-center">
                          <p className="text-amber-300 text-2xl font-bold">{insight.morningAvg?.toFixed(1)}</p>
                          <p className="text-blue-400 text-xs mt-1">Morning avg mood</p>
                          <p className="text-blue-500 text-[10px]">before 10 AM</p>
                        </div>
                        <div className="bg-blue-900/30 border border-blue-700/40 rounded-xl p-3 text-center">
                          <p className="text-blue-300 text-2xl font-bold">{insight.otherAvg?.toFixed(1)}</p>
                          <p className="text-blue-400 text-xs mt-1">Other times avg</p>
                          <p className="text-blue-500 text-[10px]">10 AM or later</p>
                        </div>
                      </div>
                      <p className="text-slate-400 text-xs leading-relaxed">
                        Your morning plunges are <em>associated with</em> higher self-reported mood scores. This is correlational — other factors may be involved.
                      </p>
                    </>
                  ) : (
                    <p className="text-blue-300 text-sm leading-relaxed">
                      No significant difference found between your morning and later plunges yet. Keep logging and patterns may emerge over time.
                    </p>
                  )}
                </div>
              </section>
            )}

            {/* ── Cold Adaptation Trend ── */}
            <section>
              <SectionHeader
                emoji="📈"
                title="Cold Adaptation Trend"
                subtitle={hasAdaptation ? "How your check-in ratings have shifted over time" : undefined}
              />
              {hasAdaptation && adaptation ? (
                <div className="bg-blue-900/40 border border-blue-800/50 rounded-2xl p-5">
                  <div className="grid grid-cols-2 gap-3 mb-5">
                    <div className="bg-blue-950/60 border border-blue-800/40 rounded-xl p-3 text-center">
                      <p className="text-blue-300 text-2xl font-bold">{Math.round(adaptation.earlyAvg * 100)}%</p>
                      <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">First 10 check-ins</p>
                      <p className="text-blue-500 text-[10px]">composite score</p>
                    </div>
                    <div className={`border rounded-xl p-3 text-center ${adaptation.delta >= 0 ? "bg-emerald-900/20 border-emerald-500/30" : "bg-red-900/20 border-red-500/30"}`}>
                      <p className={`text-2xl font-bold ${adaptation.delta >= 0 ? "text-emerald-300" : "text-red-300"}`}>
                        {Math.round(adaptation.recentAvg * 100)}%
                      </p>
                      <p className="text-blue-400 text-xs mt-1 uppercase tracking-wide">Recent 10 check-ins</p>
                      <p className={`text-xs font-bold mt-1 ${adaptation.delta >= 0 ? "text-emerald-400" : "text-red-400"}`}>
                        {adaptation.deltaStr} composite
                      </p>
                    </div>
                  </div>

                  <div className={`flex items-start gap-3 rounded-xl px-4 py-3 ${adaptation.delta >= 0.05 ? "bg-emerald-900/20 border border-emerald-500/25" : "bg-blue-900/20 border border-blue-700/30"}`}>
                    <span className="text-lg mt-0.5">{adaptation.delta >= 0.05 ? "📈" : adaptation.delta <= -0.05 ? "📉" : "→"}</span>
                    <div>
                      {adaptation.delta >= 0.05 ? (
                        <>
                          <p className="text-emerald-300 text-sm font-semibold">Adaptation trend detected</p>
                          <p className="text-slate-400 text-xs leading-relaxed mt-1">
                            Your <span className="text-emerald-300">{adaptation.metrics.join(" & ")}</span> responses after plunging are <em>associated with</em> higher ratings compared to your first 10 check-ins.
                          </p>
                        </>
                      ) : adaptation.delta <= -0.05 ? (
                        <>
                          <p className="text-blue-300 text-sm font-semibold">Recent scores are lower</p>
                          <p className="text-slate-400 text-xs leading-relaxed mt-1">
                            Your recent check-ins score a little lower than your early ones. This can reflect harder sessions, life stress, or natural variance — not necessarily a problem.
                          </p>
                        </>
                      ) : (
                        <>
                          <p className="text-blue-300 text-sm font-semibold">Holding steady</p>
                          <p className="text-slate-400 text-xs leading-relaxed mt-1">
                            Your recent check-in scores are consistent with your early ones.
                          </p>
                        </>
                      )}
                    </div>
                  </div>
                </div>
              ) : (
                <LockedSection title="Adaptation Trend" emoji="📈" need={20} have={ratedCount} />
              )}
            </section>

            {/* ── Monthly Trend ── */}
            <section>
              <SectionHeader
                emoji="📅"
                title="Monthly Trend"
                subtitle={hasMonthly ? "Your average Mood, Energy & Focus rating by month" : undefined}
              />
              {hasMonthly ? (
                <div className="bg-blue-900/40 border border-blue-800/50 rounded-2xl p-5">

                  {/* Legend */}
                  <div className="flex items-center gap-5 mb-5">
                    <div className="flex items-center gap-1.5">
                      <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#22d3ee" }} />
                      <span className="text-blue-300 text-xs">Mood (1–5)</span>
                    </div>
                    {months.some((m) => m.avgEnergy != null) && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#fbbf24" }} />
                        <span className="text-blue-300 text-xs">Energy (1–3)</span>
                      </div>
                    )}
                    {months.some((m) => m.avgFocus != null) && (
                      <div className="flex items-center gap-1.5">
                        <span className="inline-block w-3 h-3 rounded-sm" style={{ background: "#a78bfa" }} />
                        <span className="text-blue-300 text-xs">Focus (1–3)</span>
                      </div>
                    )}
                  </div>

                  {/* Bar chart */}
                  <div className="flex items-end gap-2 sm:gap-4 bg-blue-950/50 rounded-xl px-4 pt-4 pb-2">
                    {months.map((m) => {
                      const moodPct   = m.avgMood   != null ? Math.round(((m.avgMood   - 1) / 4) * 100) : 0;
                      const energyPct = m.avgEnergy != null ? Math.round(((m.avgEnergy - 1) / 2) * 100) : 0;
                      const focusPct  = m.avgFocus  != null ? Math.round(((m.avgFocus  - 1) / 2) * 100) : 0;
                      const showEnergy = months.some((mm) => mm.avgEnergy != null);
                      const showFocus  = months.some((mm) => mm.avgFocus  != null);
                      return (
                        <div key={m.key} className="flex-1 flex flex-col items-center gap-1 group">
                          <div className="w-full flex items-end justify-center gap-[3px] h-24">
                            <div className="flex-1 flex flex-col justify-end" style={{ maxWidth: 14 }}>
                              <div className="rounded-t-sm transition-all duration-500" style={{ height: `${moodPct}%`, backgroundColor: "#22d3ee", minHeight: moodPct > 0 ? 2 : 0 }} />
                            </div>
                            {showEnergy && (
                              <div className="flex-1 flex flex-col justify-end" style={{ maxWidth: 14 }}>
                                <div className="rounded-t-sm transition-all duration-500" style={{ height: `${energyPct}%`, backgroundColor: "#fbbf24", minHeight: energyPct > 0 ? 2 : 0 }} />
                              </div>
                            )}
                            {showFocus && (
                              <div className="flex-1 flex flex-col justify-end" style={{ maxWidth: 14 }}>
                                <div className="rounded-t-sm transition-all duration-500" style={{ height: `${focusPct}%`, backgroundColor: "#a78bfa", minHeight: focusPct > 0 ? 2 : 0 }} />
                              </div>
                            )}
                          </div>
                          <p className="text-blue-400 text-[10px] font-semibold">{m.label}</p>
                          {m.avgMood != null && (
                            <p className="text-cyan-500 text-[9px]">{m.avgMood}</p>
                          )}
                          {/* Hover tooltip on web */}
                          <div className="hidden group-hover:block absolute -mt-12 bg-blue-900 border border-blue-700 rounded-lg px-2 py-1 text-[10px] text-white whitespace-nowrap pointer-events-none shadow-lg">
                            {m.fullLabel}: {m.count} check-in{m.count === 1 ? "" : "s"}
                          </div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Month scores table */}
                  <div className="mt-4 overflow-x-auto">
                    <table className="w-full text-xs text-center">
                      <thead>
                        <tr className="text-blue-500 text-[10px] uppercase tracking-wider">
                          <td className="pb-2 text-left pl-1">Month</td>
                          <td className="pb-2" style={{ color: "#22d3ee" }}>Mood</td>
                          {months.some((m) => m.avgEnergy != null) && <td className="pb-2" style={{ color: "#fbbf24" }}>Energy</td>}
                          {months.some((m) => m.avgFocus  != null) && <td className="pb-2" style={{ color: "#a78bfa" }}>Focus</td>}
                          <td className="pb-2 text-blue-600">Sessions</td>
                        </tr>
                      </thead>
                      <tbody>
                        {months.map((m) => (
                          <tr key={m.key} className="border-t border-blue-900/60">
                            <td className="py-1.5 text-blue-300 text-left pl-1">{m.fullLabel}</td>
                            <td className="py-1.5 text-cyan-300 font-semibold">{m.avgMood?.toFixed(1) ?? "—"}</td>
                            {months.some((mm) => mm.avgEnergy != null) && <td className="py-1.5 text-amber-300 font-semibold">{m.avgEnergy?.toFixed(1) ?? "—"}</td>}
                            {months.some((mm) => mm.avgFocus  != null) && <td className="py-1.5 text-violet-300 font-semibold">{m.avgFocus?.toFixed(1)  ?? "—"}</td>}
                            <td className="py-1.5 text-blue-500">{m.count}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              ) : (
                <div className="bg-blue-950/60 border border-blue-800/40 rounded-2xl p-5 opacity-70">
                  <div className="flex items-center gap-3 mb-3">
                    <span className="text-xl opacity-50">📅</span>
                    <div>
                      <p className="text-blue-300 font-semibold text-sm">Monthly Trend</p>
                      <p className="text-blue-500 text-xs mt-0.5">🔒 Unlocks after 2 months of check-ins</p>
                    </div>
                  </div>
                  <p className="text-blue-600 text-xs">
                    {months.length < 2
                      ? `You have ${months.length} month${months.length === 1 ? "" : "s"} of check-in data. Keep going — one more month unlocks your trend.`
                      : "Keep logging check-ins to see monthly patterns."}
                  </p>
                </div>
              )}
            </section>

            {/* Footer disclaimer */}
            <footer className="pb-8">
              <p className="text-blue-700 text-xs leading-relaxed text-center max-w-lg mx-auto">
                All patterns shown here are based on your self-reported check-ins and are correlational — not medical data or physiological measurements. Results may reflect mood, lifestyle, or other factors unrelated to cold exposure. Not medical advice.
              </p>
            </footer>
          </>
        )}
      </main>
    </div>
  );
}
