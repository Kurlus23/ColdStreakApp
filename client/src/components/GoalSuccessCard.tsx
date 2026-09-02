/**
 * GoalSuccessCard — shows what % of recent plunges actually hit the user's
 * primary benefit goal, with a trend vs the previous 30 sessions and a
 * mini breakdown across all four goal types.
 *
 * Hidden until the user has at least 5 plunges (no meaningful sample below that).
 */

import { type Plunge } from "@shared/schema";
import { SEGMENTS, type SegmentId, computeThresholds } from "@/lib/benefitSegments";

interface Props {
  plunges: Plunge[];
  primaryBenefit: SegmentId;
  weightLbs?: number;
  heightCm?: number;
  bodyFatPct?: number | null;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function hitGoal(
  p: Plunge,
  segIdx: number,
  weightLbs: number,
  heightCm: number,
  bodyFatPct: number | null | undefined,
): boolean {
  const thresholds = computeThresholds(p.temperature, weightLbs, heightCm, bodyFatPct);
  return p.duration >= thresholds[segIdx];
}

function rateLabel(rate: number): string {
  if (rate >= 0.8) return "Excellent";
  if (rate >= 0.6) return "Good";
  if (rate >= 0.4) return "Moderate";
  return "Needs work";
}

function rateColor(rate: number): string {
  if (rate >= 0.8) return "#34d399"; // emerald
  if (rate >= 0.6) return "#22d3ee"; // cyan
  if (rate >= 0.4) return "#fbbf24"; // amber
  return "#f87171"; // red
}

interface GoalResult {
  recentRate: number;
  recentCount: number;
  trend: "improving" | "declining" | "steady" | null;
  prevRate: number | null;
  breakdown: Array<{ id: SegmentId; emoji: string; label: string; rate: number; count: number }>;
}

function computeGoalSuccess(
  plunges: Plunge[],
  benefitId: SegmentId,
  weightLbs: number,
  heightCm: number,
  bodyFatPct: number | null | undefined,
): GoalResult | null {
  // Newest first
  const sorted = [...plunges].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  const recent30 = sorted.slice(0, 30);
  if (recent30.length < 5) return null;

  const primaryIdx = SEGMENTS.findIndex((s) => s.id === benefitId);
  if (primaryIdx === -1) return null;

  const recentHits = recent30.filter((p) => hitGoal(p, primaryIdx, weightLbs, heightCm, bodyFatPct)).length;
  const recentRate = recentHits / recent30.length;

  // Trend vs previous window
  const prev30 = sorted.slice(30, 60);
  let trend: GoalResult["trend"] = null;
  let prevRate: number | null = null;
  if (prev30.length >= 5) {
    const prevHits = prev30.filter((p) => hitGoal(p, primaryIdx, weightLbs, heightCm, bodyFatPct)).length;
    prevRate = prevHits / prev30.length;
    const delta = recentRate - prevRate;
    trend = delta >= 0.1 ? "improving" : delta <= -0.1 ? "declining" : "steady";
  }

  // Breakdown across all goals (using all plunges for a stable estimate)
  const breakdown = SEGMENTS.map((seg, idx) => {
    const hits = sorted.filter((p) => hitGoal(p, idx, weightLbs, heightCm, bodyFatPct)).length;
    return {
      id: seg.id,
      emoji: seg.emoji,
      label: seg.label,
      rate: sorted.length > 0 ? hits / sorted.length : 0,
      count: sorted.length,
    };
  });

  return { recentRate, recentCount: recent30.length, trend, prevRate, breakdown };
}

// ── Component ──────────────────────────────────────────────────────────────────

export function GoalSuccessCard({ plunges, primaryBenefit, weightLbs = 150, heightCm = 175, bodyFatPct }: Props) {
  const result = computeGoalSuccess(plunges, primaryBenefit, weightLbs, heightCm, bodyFatPct);
  if (!result) return null;

  const primarySeg = SEGMENTS.find((s) => s.id === primaryBenefit)!;
  const pct = Math.round(result.recentRate * 100);
  const color = rateColor(result.recentRate);
  const label = rateLabel(result.recentRate);

  const trendIcon =
    result.trend === "improving" ? "↑" :
    result.trend === "declining" ? "↓" : "→";
  const trendColor =
    result.trend === "improving" ? "#34d399" :
    result.trend === "declining" ? "#f87171" : "#94a3b8";
  const trendText =
    result.trend === "improving" ? "Improving vs previous 30" :
    result.trend === "declining" ? "Declining vs previous 30" :
    result.trend === "steady"    ? "Steady vs previous 30"   : null;

  return (
    <div
      data-testid="goal-success-card"
      className="mb-4 rounded-2xl border border-cyan-500/30 bg-gradient-to-br from-blue-950 to-slate-900 p-4 shadow-lg"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🎯</span>
          <div>
            <p className="text-white text-sm font-bold leading-tight">Goal Success Rate</p>
            <p className="text-blue-400 text-[10px] leading-tight mt-0.5">
              Last {result.recentCount} sessions · {primarySeg.emoji} {primarySeg.label} goal
            </p>
          </div>
        </div>
        <span
          className="text-[10px] font-semibold px-2 py-0.5 rounded-full border"
          style={{ color, borderColor: color + "55", background: color + "15" }}
        >
          {label}
        </span>
      </div>

      {/* Big percentage */}
      <div className="flex items-end gap-3 mb-3">
        <div
          className="text-5xl font-black leading-none tabular-nums"
          style={{ color }}
        >
          {pct}%
        </div>
        <div className="pb-1.5">
          <p className="text-white text-xs font-semibold leading-tight">
            of sessions hit your {primarySeg.label} threshold
          </p>
          {trendText && (
            <p className="text-[10px] mt-0.5 font-semibold" style={{ color: trendColor }}>
              {trendIcon} {trendText}
              {result.prevRate !== null && (
                <span className="text-slate-500 font-normal ml-1">
                  (was {Math.round(result.prevRate * 100)}%)
                </span>
              )}
            </p>
          )}
        </div>
      </div>

      {/* Progress bar */}
      <div className="w-full h-2 bg-blue-900/60 rounded-full mb-4 overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-500"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>

      {/* Goal breakdown */}
      <div className="space-y-1.5">
        <p className="text-blue-400 text-[10px] uppercase tracking-wide font-semibold mb-2">
          All-time by goal type
        </p>
        {result.breakdown.map((b) => {
          const bPct = Math.round(b.rate * 100);
          const bColor = rateColor(b.rate);
          const isPrimary = b.id === primaryBenefit;
          return (
            <div key={b.id} className={`flex items-center gap-2 rounded-xl px-2.5 py-1.5 ${isPrimary ? "bg-blue-900/50 border border-blue-700/40" : ""}`}>
              <span className="text-sm w-5 text-center">{b.emoji}</span>
              <span className="text-white text-[11px] font-medium w-20 shrink-0">{b.label}</span>
              <div className="flex-1 h-1.5 bg-blue-900/60 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full"
                  style={{ width: `${bPct}%`, background: bColor }}
                />
              </div>
              <span
                className="text-[11px] font-bold w-8 text-right tabular-nums"
                style={{ color: bColor }}
              >
                {bPct}%
              </span>
              {isPrimary && (
                <span className="text-[9px] text-cyan-400 font-semibold">goal</span>
              )}
            </div>
          );
        })}
      </div>

      {/* Disclaimer */}
      <p className="text-slate-500 text-[9px] leading-relaxed mt-3">
         Milestone times are adjusted for your water temperature and BMI. They are research-informed product estimates, not medical targets.
      </p>
    </div>
  );
}
