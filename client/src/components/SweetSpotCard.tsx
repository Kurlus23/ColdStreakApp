/**
 * SweetSpotCard — personalised cold-plunge sweet spot + adaptation trend.
 *
 * Sweet Spot (10+ check-ins):
 *   Bucket by temp × duration → highest composite mood+energy score.
 *
 * Adaptation Trend (20+ check-ins):
 *   Compare first-10 vs most-recent-10 check-in composite scores.
 *   If the recent batch outscores the early batch meaningfully, surface the
 *   improvement in plain language using only "associated with" phrasing.
 */

import { type Plunge } from "@shared/schema";

interface Props {
  plunges: Plunge[];
}

// ── Bucket helpers ─────────────────────────────────────────────────────────────

const TEMP_BANDS = [
  { min: 0,  max: 40, label: "35–40°F" },
  { min: 40, max: 45, label: "40–45°F" },
  { min: 45, max: 50, label: "45–50°F" },
  { min: 50, max: 55, label: "50–55°F" },
  { min: 55, max: 60, label: "55–60°F" },
  { min: 60, max: 999, label: "60°F+"  },
] as const;

const DUR_BANDS = [
  { min: 0,   max: 90,  label: "< 1.5 min" },
  { min: 90,  max: 180, label: "1.5–3 min" },
  { min: 180, max: 360, label: "3–6 min"   },
  { min: 360, max: Infinity, label: "6+ min" },
] as const;

function tempBand(f: number) {
  return TEMP_BANDS.find((b) => f >= b.min && f < b.max) ?? TEMP_BANDS[TEMP_BANDS.length - 1];
}

function durBand(s: number) {
  return DUR_BANDS.find((b) => s >= b.min && s < b.max) ?? DUR_BANDS[DUR_BANDS.length - 1];
}

interface Bucket {
  tempLabel: string;
  durLabel:  string;
  moodSum:   number;
  energySum: number;
  count:     number;
  moodCount: number;
  energyCount: number;
}

// Composite score (0–1) for a plunge's check-in
function compositeScore(p: Plunge): number {
  const moodNorm   = p.mood        != null ? (p.mood       - 1) / 4 : null;
  const energyNorm = p.moodEnergy  != null ? (p.moodEnergy - 1) / 2 : null;
  if (moodNorm === null && energyNorm === null) return 0;
  if (moodNorm === null) return energyNorm!;
  if (energyNorm === null) return moodNorm;
  return (moodNorm + energyNorm) / 2;
}

// ── Adaptation trend ──────────────────────────────────────────────────────────

interface AdaptationTrend {
  improved: boolean;
  metrics: string[];  // e.g. ["Mood", "Energy"]
  deltaStr: string;   // e.g. "+18%"
}

function computeAdaptationTrend(rated: Plunge[]): AdaptationTrend | null {
  if (rated.length < 20) return null;

  // Sort oldest → newest
  const sorted = [...rated].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
  );

  const first10  = sorted.slice(0, 10);
  const recent10 = sorted.slice(-10);

  const avgScore = (group: Plunge[]) => {
    const scores = group.map(compositeScore);
    return scores.reduce((s, v) => s + v, 0) / scores.length;
  };

  const earlyAvg  = avgScore(first10);
  const recentAvg = avgScore(recent10);
  const delta     = recentAvg - earlyAvg;

  if (delta < 0.05) return null; // not enough improvement to surface

  // Determine which specific metrics improved
  const avgMood = (group: Plunge[]) => {
    const w = group.filter((p) => p.mood != null);
    return w.length > 0 ? w.reduce((s, p) => s + p.mood!, 0) / w.length : null;
  };
  const avgEnergy = (group: Plunge[]) => {
    const w = group.filter((p) => p.moodEnergy != null);
    return w.length > 0 ? w.reduce((s, p) => s + p.moodEnergy!, 0) / w.length : null;
  };
  const avgFocus = (group: Plunge[]) => {
    const w = group.filter((p) => p.moodFocus != null);
    return w.length > 0 ? w.reduce((s, p) => s + p.moodFocus!, 0) / w.length : null;
  };

  const metrics: string[] = [];
  const em = [avgMood(first10), avgMood(recent10)];
  const ee = [avgEnergy(first10), avgEnergy(recent10)];
  const ef = [avgFocus(first10), avgFocus(recent10)];

  if (em[0] != null && em[1] != null && em[1] > em[0] + 0.2) metrics.push("Mood");
  if (ee[0] != null && ee[1] != null && ee[1] > ee[0] + 0.15) metrics.push("Energy");
  if (ef[0] != null && ef[1] != null && ef[1] > ef[0] + 0.15) metrics.push("Focus");

  if (metrics.length === 0) metrics.push("overall responses");

  const deltaPct = Math.round(delta * 100);
  return { improved: true, metrics, deltaStr: `+${deltaPct}%` };
}

// ── Sweet Spot computation ────────────────────────────────────────────────────

function computeSweetSpot(plunges: Plunge[]) {
  const rated = plunges.filter((p) => p.mood != null);
  if (rated.length < 10) return null;

  const map = new Map<string, Bucket>();

  for (const p of rated) {
    const tb  = tempBand(p.temperature);
    const db  = durBand(p.duration);
    const key = `${tb.label}||${db.label}`;
    if (!map.has(key)) {
      map.set(key, {
        tempLabel: tb.label, durLabel: db.label,
        moodSum: 0, energySum: 0,
        count: 0, moodCount: 0, energyCount: 0,
      });
    }
    const b = map.get(key)!;
    b.count++;
    if (p.mood       != null) { b.moodSum   += p.mood;       b.moodCount++;   }
    if (p.moodEnergy != null) { b.energySum += p.moodEnergy; b.energyCount++; }
  }

  let best: (Bucket & { score: number; avgMood: number; avgEnergy: number | null }) | null = null;

  for (const b of Array.from(map.values())) {
    if (b.count < 3) continue;
    const avgMood   = b.moodCount   > 0 ? b.moodSum   / b.moodCount   : 0;
    const avgEnergy = b.energyCount > 0 ? b.energySum / b.energyCount : null;

    const moodNorm   = (avgMood - 1) / 4;
    const energyNorm = avgEnergy != null ? (avgEnergy - 1) / 2 : moodNorm;
    const score      = (moodNorm + energyNorm) / 2;

    if (!best || score > best.score) best = { ...b, score, avgMood, avgEnergy };
  }

  if (!best) return null;

  const moodGood   = best.avgMood   >= 4;
  const energyGood = best.avgEnergy != null && best.avgEnergy >= 2.5;
  const bestFor    = moodGood && energyGood ? "Mood + Energy"
    : moodGood   ? "Mood"
    : energyGood ? "Energy"
    : "Overall";

  const confidence = rated.length >= 30 ? "High"
    : rated.length >= 15 ? "Medium" : "Low";

  const trend = computeAdaptationTrend(rated);

  return { tempLabel: best.tempLabel, durLabel: best.durLabel, bestFor, confidence, sampleSize: rated.length, trend };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function SweetSpotCard({ plunges }: Props) {
  const spot = computeSweetSpot(plunges);
  if (!spot) return null;

  const confidenceColor =
    spot.confidence === "High"   ? "#22d3ee" :
    spot.confidence === "Medium" ? "#fbbf24" : "#94a3b8";

  return (
    <div
      data-testid="sweet-spot-card"
      className="mb-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-blue-950 to-slate-900 p-4 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Your Cold Sweet Spot</p>
            <p className="text-blue-400 text-[10px] leading-tight mt-0.5">
              Based on {spot.sampleSize} check-ins
            </p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
          style={{ color: confidenceColor, borderColor: confidenceColor + "55", background: confidenceColor + "15" }}
        >
          {spot.confidence} confidence
        </span>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 gap-2 mb-3">
        <div className="bg-blue-900/40 rounded-xl p-2.5 text-center">
          <p className="text-cyan-300 text-base font-bold leading-tight">{spot.tempLabel}</p>
          <p className="text-blue-400 text-[9px] uppercase tracking-wide mt-0.5">Temperature</p>
        </div>
        <div className="bg-blue-900/40 rounded-xl p-2.5 text-center">
          <p className="text-cyan-300 text-base font-bold leading-tight">{spot.durLabel}</p>
          <p className="text-blue-400 text-[9px] uppercase tracking-wide mt-0.5">Duration</p>
        </div>
        <div className="bg-blue-900/40 rounded-xl p-2.5 text-center">
          <p className="text-emerald-300 text-base font-bold leading-tight">{spot.bestFor}</p>
          <p className="text-blue-400 text-[9px] uppercase tracking-wide mt-0.5">Best for</p>
        </div>
      </div>

      {/* Adaptation trend — only shown when there's enough data */}
      {spot.trend && (
        <div className="flex items-start gap-2 bg-emerald-900/20 border border-emerald-500/25 rounded-xl px-3 py-2.5 mb-3">
          <span className="text-base leading-none mt-0.5">📈</span>
          <div>
            <p className="text-emerald-300 text-[11px] font-semibold leading-snug">
              Cold adaptation detected
            </p>
            <p className="text-slate-400 text-[10px] leading-relaxed mt-0.5">
              Your <span className="text-emerald-300">{spot.trend.metrics.join(" & ")}</span> responses
              after plunging are <em>associated with</em> higher ratings compared with
              your first 10 check-ins ({spot.trend.deltaStr} composite).
            </p>
          </div>
        </div>
      )}

      {/* Disclaimer */}
      <p className="text-slate-500 text-[9px] leading-relaxed">
        Results are based on your self-reported check-ins and are correlational — not medical data.
      </p>
    </div>
  );
}
