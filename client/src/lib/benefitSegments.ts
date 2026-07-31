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

// ─── Body-composition factor ──────────────────────────────────────────────────
// Body fat % is the preferred input: it directly measures insulation/thermal
// mass without the muscle-mass distortion that makes BMI inaccurate for lean,
// muscular users.  Falls back to BMI derived from height+weight when not set.
//
// Neutral reference: 20 % body fat (average fit adult).
// Factor range clamped to [0.75, 1.35] in both paths.

const NEUTRAL_BODY_FAT = 20; // %
const NEUTRAL_BMI      = 22;

/**
 * Benefit-bar factor: higher body fat → higher factor → longer unlock thresholds.
 * More insulation means you need more time to reach each benefit.
 */
export function getBodyFatFactor(bodyFatPct: number): number {
  if (bodyFatPct <= 0) return 1.0;
  return Math.min(1.35, Math.max(0.75, bodyFatPct / NEUTRAL_BODY_FAT));
}

/**
 * Score factor: INVERTED direction vs benefit bar.
 * Leaner = more thermogenically demanding = should score higher per minute.
 * Higher body fat = more insulation = less physiological work = lower score.
 */
export function getBodyFatFactorForScore(bodyFatPct: number): number {
  if (bodyFatPct <= 0) return 1.0;
  return Math.min(1.35, Math.max(0.75, NEUTRAL_BODY_FAT / bodyFatPct));
}

/** Fallback: derive factor from BMI when body fat % is unknown. */
export function getBmiFactor(weightLbs: number, heightCm: number): number {
  if (heightCm <= 0 || weightLbs <= 0) return 1.0;
  const weightKg = weightLbs / 2.205;
  const heightM  = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.min(1.35, Math.max(0.75, bmi / NEUTRAL_BMI));
}

/**
 * Composition factor for the BENEFIT BAR (thresholds).
 * Higher body fat → longer thresholds (more insulation = harder to unlock benefits).
 */
export function getCompositionFactor(
  bodyFatPct: number | null | undefined,
  weightLbs: number,
  heightCm: number,
): number {
  if (bodyFatPct != null && bodyFatPct > 0) return getBodyFatFactor(bodyFatPct);
  return getBmiFactor(weightLbs, heightCm);
}

/**
 * Composition factor for SCORING.
 * Lower body fat → higher multiplier (leaner = more thermogenic work per minute).
 * Falls back to BMI factor when body fat is not set.
 */
export function getCompositionFactorForScore(
  bodyFatPct: number | null | undefined,
  weightLbs: number,
  heightCm: number,
): number {
  if (bodyFatPct != null && bodyFatPct > 0) return getBodyFatFactorForScore(bodyFatPct);
  return getBmiFactor(weightLbs, heightCm);
}

// ─── Threshold & earned computation ──────────────────────────────────────────

/**
 * Returns the cumulative second-thresholds at which each segment unlocks,
 * adjusted for temperature and body composition.
 */
export function computeThresholds(
  tempF: number,
  weightLbs = 150,
  heightCm  = 175,
  bodyFatPct?: number | null,
): number[] {
  const tf = getTempFactor(tempF);
  const bf = getCompositionFactor(bodyFatPct, weightLbs, heightCm);
  let t = 0;
  return SEGMENTS.map((seg) => {
    t += Math.round(seg.baseDuration * tf * bf);
    return t;
  });
}

// ─── +Finish button helpers ───────────────────────────────────────────────────

/**
 * Returns the index of the benefit segment that is currently in-progress
 * (started but not yet complete), or -1 if all segments are done.
 *
 * Used by the "+Finish [emoji]" button in Home.tsx to identify which segment
 * the user is aiming for.
 */
export function getMidSegmentIdx(
  totalElapsed: number,
  thresholds: number[],
): number {
  for (let i = 0; i < thresholds.length; i++) {
    const lo = i === 0 ? 0 : thresholds[i - 1];
    if (totalElapsed >= lo && totalElapsed < thresholds[i]) return i;
  }
  return -1; // all segments complete
}

/**
 * Returns the number of additional seconds needed to reach the next benefit
 * threshold.  Guaranteed >= 1 when called from a valid in-progress state
 * (i.e. getMidSegmentIdx >= 0).  Callers should check getMidSegmentIdx first.
 */
export function getSecsToFinish(
  totalElapsed: number,
  thresholds: number[],
  midIdx: number,
): number {
  return Math.max(1, thresholds[midIdx] - totalElapsed);
}

/**
 * Returns the IDs of segments fully earned by a single plunge of the given
 * duration, temperature, and body metrics.
 */
export function computeEarnedSegments(
  durationSec: number,
  tempF: number,
  weightLbs  = 150,
  heightCm   = 175,
  bodyFatPct?: number | null,
): SegmentId[] {
  const thresholds = computeThresholds(tempF, weightLbs, heightCm, bodyFatPct);
  return SEGMENTS
    .filter((_, i) => durationSec >= thresholds[i])
    .map((s) => s.id);
}
