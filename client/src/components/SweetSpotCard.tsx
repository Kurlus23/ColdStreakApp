/**
 * SweetSpotCard — shows a user's personalised cold-plunge sweet spot
 * after they have at least 10 completed check-ins.
 *
 * Algorithm:
 *   1. Filter plunges to those with a mood check-in (mood != null).
 *   2. Bucket by temp (5 °F bands) × duration (4 buckets).
 *   3. Find the bucket with ≥ 3 data points and the highest composite
 *      score (avg mood normalised 0–1 + avg energy normalised 0–1).
 *   4. Report what the sweet spot is best for (mood, energy, or both).
 *   5. Show a confidence level based on sample size.
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
  durLabel: string;
  moodSum: number;
  energySum: number;
  count: number;
  moodCount: number;
  energyCount: number;
}

function computeSweetSpot(plunges: Plunge[]) {
  const rated = plunges.filter((p) => p.mood != null);
  if (rated.length < 10) return null;

  const map = new Map<string, Bucket>();

  for (const p of rated) {
    const tb = tempBand(p.temperature);
    const db = durBand(p.duration);
    const key = `${tb.label}||${db.label}`;
    if (!map.has(key)) {
      map.set(key, {
        tempLabel: tb.label,
        durLabel: db.label,
        moodSum: 0, energySum: 0,
        count: 0, moodCount: 0, energyCount: 0,
      });
    }
    const b = map.get(key)!;
    b.count++;
    if (p.mood != null) { b.moodSum += p.mood; b.moodCount++; }
    if (p.moodEnergy != null) { b.energySum += p.moodEnergy; b.energyCount++; }
  }

  // Score each bucket: normalised avg mood (1–5 → 0–1) + normalised avg energy (1–3 → 0–1)
  let best: (Bucket & { score: number; avgMood: number; avgEnergy: number | null }) | null = null;

  for (const b of Array.from(map.values())) {
    if (b.count < 3) continue;
    const avgMood   = b.moodCount   > 0 ? b.moodSum   / b.moodCount   : 0;
    const avgEnergy = b.energyCount > 0 ? b.energySum / b.energyCount : null;

    const moodNorm   = (avgMood - 1) / 4;          // 1–5 → 0–1
    const energyNorm = avgEnergy != null ? (avgEnergy - 1) / 2 : moodNorm; // 1–3 → 0–1
    const score      = (moodNorm + energyNorm) / 2;

    if (!best || score > best.score) {
      best = { ...b, score, avgMood, avgEnergy };
    }
  }

  if (!best) return null;

  // Determine what it's "best for"
  const moodGood   = best.avgMood   >= 4;
  const energyGood = best.avgEnergy != null && best.avgEnergy >= 2.5;
  const bestFor    = moodGood && energyGood ? "Mood + Energy"
    : moodGood   ? "Mood"
    : energyGood ? "Energy"
    : "Overall";

  const confidence = rated.length >= 30 ? "High"
    : rated.length >= 15 ? "Medium"
    : "Low";

  return {
    tempLabel: best.tempLabel,
    durLabel:  best.durLabel,
    bestFor,
    confidence,
    sampleSize: rated.length,
  };
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
      className="mx-4 mb-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-blue-950 to-slate-900 p-4 shadow-lg"
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

      {/* Disclaimer */}
      <p className="text-slate-500 text-[9px] leading-relaxed">
        This range is most consistently <em>associated with</em> your highest mood &amp; energy ratings after plunging — not a medical recommendation.
      </p>
    </div>
  );
}
