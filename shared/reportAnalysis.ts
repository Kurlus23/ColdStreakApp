/**
 * Shared cold-plunge report analysis — used by both the server email reports
 * (server/reports.ts) and the in-app DiscoveryReportCard component.
 *
 * Keeping this in shared/ ensures the in-app view and emailed report are
 * always computed from the same logic.
 */

// ── Band definitions ──────────────────────────────────────────────────────────

export const TEMP_BANDS = [
  { min: 0,   max: 40,  label: "35–40°F" },
  { min: 40,  max: 45,  label: "40–45°F" },
  { min: 45,  max: 50,  label: "45–50°F" },
  { min: 50,  max: 55,  label: "50–55°F" },
  { min: 55,  max: 60,  label: "55–60°F" },
  { min: 60,  max: 999, label: "60°F+"   },
] as const;

export const DUR_BANDS = [
  { min: 0,   max: 90,       label: "under 1.5 min" },
  { min: 90,  max: 180,      label: "1.5–3 min"     },
  { min: 180, max: 360,      label: "3–6 min"        },
  { min: 360, max: Infinity, label: "6+ min"         },
] as const;

// ── Common row type (server and client both map to this) ──────────────────────

export interface ReportRow {
  duration:    number;
  temperature: number;
  mood:        number | null;
  moodEnergy:  number | null;
  moodFocus:   number | null;
  score:       string | null;
  createdAt:   Date;
}

// ── Output types ──────────────────────────────────────────────────────────────

export interface BandStat {
  label:       string;
  moodSum:     number;
  energySum:   number;
  count:       number;
  moodCount:   number;
  energyCount: number;
}

export interface Insight {
  tempLabel:    string | null;
  durLabel:     string | null;
  morningBest:  boolean | null;
  diminishing:  string | null;
  sweetSpotFor: string | null;
  sampleSize:   number;
}

export interface PeriodStats {
  count:          number;
  totalMinutes:   number;
  uniqueDays:     number;
  bestScore:      number;
  benefitCounts:  Record<string, number>;
  moodCounts:     Record<number, number>;
  energyCounts:   Record<number, number>;
  focusCounts:    Record<number, number>;
  moodTotal:      number;
  moodResponded:  number;
  avgMood:        number | null;
  avgEnergy:      number | null;
  avgFocus:       number | null;
  insights:       Insight;
}

// ── Segment / temp-factor helpers (for benefitCounts) ────────────────────────

const SEGMENTS = [
  { id: "energy",     baseDuration: 60  },
  { id: "mood",       baseDuration: 120 },
  { id: "metabolism", baseDuration: 120 },
  { id: "recovery",   baseDuration: 180 },
] as const;

const TEMP_POINTS: [number, number][] = [
  [35, 0.55], [38, 0.62], [42, 0.72], [45, 0.82],
  [50, 1.00], [55, 1.28], [60, 1.58], [65, 2.00],
];

function getTempFactor(tempF: number): number {
  if (tempF <= TEMP_POINTS[0][0]) return TEMP_POINTS[0][1];
  if (tempF >= TEMP_POINTS[TEMP_POINTS.length - 1][0]) return TEMP_POINTS[TEMP_POINTS.length - 1][1];
  for (let i = 1; i < TEMP_POINTS.length; i++) {
    const [x0, y0] = TEMP_POINTS[i - 1];
    const [x1, y1] = TEMP_POINTS[i];
    if (tempF <= x1) return y0 + ((tempF - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1.0;
}

function earnedSegments(durationSec: number, tempF: number): string[] {
  const tf = getTempFactor(tempF);
  const earned: string[] = [];
  for (const seg of SEGMENTS) {
    const threshold = Math.round(seg.baseDuration * tf);
    if (durationSec >= threshold) earned.push(seg.id);
  }
  return earned;
}

// ── Pattern analysis ──────────────────────────────────────────────────────────

export function analysePatterns(rows: ReportRow[]): Insight {
  const rated = rows.filter((p) => p.mood != null);

  const result: Insight = {
    tempLabel: null, durLabel: null,
    morningBest: null, diminishing: null,
    sweetSpotFor: null, sampleSize: rated.length,
  };

  if (rated.length < 3) return result;

  // ── Temp bands ──
  const tempMap = new Map<string, BandStat>();
  for (const band of TEMP_BANDS) {
    tempMap.set(band.label, { label: band.label, moodSum: 0, energySum: 0, count: 0, moodCount: 0, energyCount: 0 });
  }
  for (const p of rated) {
    const band = TEMP_BANDS.find((b) => p.temperature >= b.min && p.temperature < b.max) ?? TEMP_BANDS[TEMP_BANDS.length - 1];
    const s = tempMap.get(band.label)!;
    s.count++;
    if (p.mood       != null) { s.moodSum   += p.mood;       s.moodCount++;   }
    if (p.moodEnergy != null) { s.energySum += p.moodEnergy; s.energyCount++; }
  }
  let bestTempScore = -1;
  for (const s of Array.from(tempMap.values())) {
    if (s.moodCount < 2) continue;
    const moodNorm   = (s.moodSum / s.moodCount - 1) / 4;
    const energyNorm = s.energyCount > 0 ? (s.energySum / s.energyCount - 1) / 2 : moodNorm;
    const score      = (moodNorm + energyNorm) / 2;
    if (score > bestTempScore) { bestTempScore = score; result.tempLabel = s.label; }
  }

  // ── Duration bands ──
  const durMap = new Map<string, BandStat>();
  for (const band of DUR_BANDS) {
    durMap.set(band.label, { label: band.label, moodSum: 0, energySum: 0, count: 0, moodCount: 0, energyCount: 0 });
  }
  for (const p of rated) {
    const band = DUR_BANDS.find((b) => p.duration >= b.min && p.duration < b.max) ?? DUR_BANDS[DUR_BANDS.length - 1];
    const s = durMap.get(band.label)!;
    s.count++;
    if (p.mood       != null) { s.moodSum   += p.mood;       s.moodCount++;   }
    if (p.moodEnergy != null) { s.energySum += p.moodEnergy; s.energyCount++; }
  }
  let bestDurScore = -1;
  for (const s of Array.from(durMap.values())) {
    if (s.moodCount < 2) continue;
    const moodNorm   = (s.moodSum / s.moodCount - 1) / 4;
    const energyNorm = s.energyCount > 0 ? (s.energySum / s.energyCount - 1) / 2 : moodNorm;
    const score      = (moodNorm + energyNorm) / 2;
    if (score > bestDurScore) { bestDurScore = score; result.durLabel = s.label; }
  }

  // ── Diminishing returns: 6+ min vs 3–6 min ──
  const band3to6  = durMap.get("3–6 min");
  const band6plus = durMap.get("6+ min");
  if (band3to6 && band6plus && band3to6.moodCount >= 2 && band6plus.moodCount >= 2) {
    const avg3to6  = band3to6.moodSum  / band3to6.moodCount;
    const avg6plus = band6plus.moodSum / band6plus.moodCount;
    if (avg6plus < avg3to6 - 0.3) result.diminishing = "6+ min";
  }

  // ── Morning advantage ──
  let morningMoodSum = 0, morningCount = 0, otherMoodSum = 0, otherCount = 0;
  for (const p of rated) {
    const h = p.createdAt.getUTCHours();
    const isMorning = h >= 5 && h < 10;
    if (isMorning) { morningMoodSum += p.mood!; morningCount++; }
    else           { otherMoodSum  += p.mood!; otherCount++;   }
  }
  if (morningCount >= 2 && otherCount >= 2) {
    const morningAvg = morningMoodSum / morningCount;
    const otherAvg   = otherMoodSum   / otherCount;
    result.morningBest = morningAvg > otherAvg + 0.25;
  }

  // ── Sweet spot label ──
  if (result.tempLabel && result.durLabel) {
    const bestTempStat = tempMap.get(result.tempLabel);
    const moodGood   = bestTempStat && bestTempStat.moodCount > 0 && (bestTempStat.moodSum / bestTempStat.moodCount) >= 4;
    const energyGood = bestTempStat && bestTempStat.energyCount > 0 && (bestTempStat.energySum / bestTempStat.energyCount) >= 2.5;
    result.sweetSpotFor = (moodGood && energyGood) ? "Mood + Energy" : moodGood ? "Mood" : energyGood ? "Energy" : null;
  }

  return result;
}

// ── Full stats computation ────────────────────────────────────────────────────

export function computeStats(rows: ReportRow[]): PeriodStats {
  const benefitCounts: Record<string, number> = { energy: 0, mood: 0, metabolism: 0, recovery: 0 };
  const moodCounts:    Record<number, number> = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  const energyCounts:  Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  const focusCounts:   Record<number, number> = { 1: 0, 2: 0, 3: 0 };
  let totalSec = 0, moodTotal = 0, moodResponded = 0, bestScore = 0;
  let energyTotal = 0, energyResponded = 0;
  let focusTotal  = 0, focusResponded  = 0;
  const days = new Set<string>();

  for (const p of rows) {
    totalSec += p.duration;
    const s = parseFloat(p.score ?? "0");
    if (s > bestScore) bestScore = s;
    days.add(p.createdAt.toISOString().slice(0, 10));
    for (const id of earnedSegments(p.duration, p.temperature)) benefitCounts[id]++;
    if (p.mood != null) {
      moodCounts[p.mood] = (moodCounts[p.mood] ?? 0) + 1;
      moodTotal += p.mood; moodResponded++;
    }
    if (p.moodEnergy != null) {
      energyCounts[p.moodEnergy] = (energyCounts[p.moodEnergy] ?? 0) + 1;
      energyTotal += p.moodEnergy; energyResponded++;
    }
    if (p.moodFocus != null) {
      focusCounts[p.moodFocus] = (focusCounts[p.moodFocus] ?? 0) + 1;
      focusTotal += p.moodFocus; focusResponded++;
    }
  }

  return {
    count: rows.length,
    totalMinutes: Math.round(totalSec / 60),
    uniqueDays: days.size,
    bestScore: Math.round(bestScore * 10) / 10,
    benefitCounts, moodCounts, energyCounts, focusCounts,
    moodTotal, moodResponded,
    avgMood:   moodResponded   > 0 ? Math.round((moodTotal   / moodResponded)   * 10) / 10 : null,
    avgEnergy: energyResponded > 0 ? Math.round((energyTotal / energyResponded) * 10) / 10 : null,
    avgFocus:  focusResponded  > 0 ? Math.round((focusTotal  / focusResponded)  * 10) / 10 : null,
    insights: analysePatterns(rows),
  };
}
