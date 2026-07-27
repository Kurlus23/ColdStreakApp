// ─── Shared benefit-segment definitions ──────────────────────────────────────
// Single source of truth used by BenefitBar (live timer) and PlungeCard
// (history display). Also mirrored server-side in server/reports.ts for email
// report generation.
//
// baseDuration = seconds each segment takes to fully unlock at 50 °F, BMI 22.
// halfLifeHours = how long the acute effect lasts before decaying to 0 (linear).

export const SEGMENTS = [
  { id: "energy",     emoji: "⚡", label: "Energy",     baseDuration: 60,  barColor: "#22d3ee", dimColor: "#164e63", halfLifeHours: 3 },
  { id: "mood",       emoji: "😊", label: "Mood",       baseDuration: 120, barColor: "#fbbf24", dimColor: "#78350f", halfLifeHours: 5 },
  { id: "metabolism", emoji: "🔥", label: "Metabolism", baseDuration: 120, barColor: "#f97316", dimColor: "#7c2d12", halfLifeHours: 6 },
  { id: "recovery",   emoji: "💪", label: "Recovery",   baseDuration: 180, barColor: "#34d399", dimColor: "#064e3b", halfLifeHours: 8 },
] as const;

export type SegmentId = (typeof SEGMENTS)[number]["id"];

// ─── Temperature interpolation ───────────────────────────────────────────────
const TEMP_POINTS: [number, number][] = [
  [35, 0.55], [38, 0.62], [42, 0.72], [45, 0.82],
  [50, 1.00], [55, 1.28], [60, 1.58], [65, 2.00],
];

export function getTempFactor(tempF: number): number {
  if (tempF <= TEMP_POINTS[0][0]) return TEMP_POINTS[0][1];
  if (tempF >= TEMP_POINTS[TEMP_POINTS.length - 1][0]) return TEMP_POINTS[TEMP_POINTS.length - 1][1];
  for (let i = 1; i < TEMP_POINTS.length; i++) {
    const [x0, y0] = TEMP_POINTS[i - 1];
    const [x1, y1] = TEMP_POINTS[i];
    if (tempF <= x1) return y0 + ((tempF - x0) / (x1 - x0)) * (y1 - y0);
  }
  return 1.0;
}

// ─── BMI factor ───────────────────────────────────────────────────────────────
const NEUTRAL_BMI = 22;

export function getBmiFactor(weightLbs: number, heightCm: number): number {
  if (heightCm <= 0 || weightLbs <= 0) return 1.0;
  const weightKg = weightLbs / 2.205;
  const heightM  = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.min(1.35, Math.max(0.75, bmi / NEUTRAL_BMI));
}

// ─── Threshold & earned computation ──────────────────────────────────────────

/**
 * Returns the cumulative second-thresholds at which each segment unlocks,
 * adjusted for temperature and body composition.
 */
export function computeThresholds(tempF: number, weightLbs = 150, heightCm = 175): number[] {
  const tf = getTempFactor(tempF);
  const bf = getBmiFactor(weightLbs, heightCm);
  let t = 0;
  return SEGMENTS.map((seg) => {
    t += Math.round(seg.baseDuration * tf * bf);
    return t;
  });
}

/**
 * Returns the IDs of segments fully earned by a single plunge of the given
 * duration, temperature, and body metrics.
 */
export function computeEarnedSegments(
  durationSec: number,
  tempF: number,
  weightLbs = 150,
  heightCm = 175,
): SegmentId[] {
  const thresholds = computeThresholds(tempF, weightLbs, heightCm);
  return SEGMENTS
    .filter((_, i) => durationSec >= thresholds[i])
    .map((s) => s.id);
}
