/**
 * PlungeBenefitCoach
 *
 * Two parts:
 *  1. GoalNudge – persistent bar below the BenefitBar counting down to the
 *     selected goal during an active plunge.
 *  2. CountdownGoalHint – guidance shown when setting a timer duration.
 */
import { SEGMENTS, SegmentId, computeBenefitFills, computeThresholds } from "@/lib/benefitSegments";

// ─── GoalNudge ────────────────────────────────────────────────────────────────

interface GoalNudgeProps {
  primaryBenefit: SegmentId;
  /** todayLoggedSeconds + elapsedSeconds */
  totalElapsed: number;
  isActive: boolean;
  tempF: number;
  bodyWeightLbs?: number;
  bodyHeightCm?: number;
  bodyFatPct?: number | null;
  goalAchieved: boolean;
  allAchieved: boolean;
}

export function GoalNudge({
  primaryBenefit,
  totalElapsed,
  isActive,
  tempF,
  bodyWeightLbs = 150,
  bodyHeightCm  = 175,
  bodyFatPct,
  goalAchieved,
  allAchieved,
}: GoalNudgeProps) {
  if (!isActive) return null;

  const thresholds   = computeThresholds(tempF, bodyWeightLbs, bodyHeightCm, bodyFatPct);
  const primaryIdx   = SEGMENTS.findIndex(s => s.id === primaryBenefit);
  const primarySeg   = SEGMENTS[primaryIdx];
  const primaryThreshold = thresholds[primaryIdx];

  // Once the selected goal has been covered, leave the display quiet rather
  // than turning the next modeled threshold into a promise or announcement.
  if (goalAchieved || allAchieved) return null;

  // Pre-goal: count down
  const secsLeft = Math.max(0, primaryThreshold - totalElapsed);
  const mins   = Math.floor(secsLeft / 60);
  const secs   = secsLeft % 60;
  const timeStr = secsLeft > 0 ? (mins > 0 ? `${mins}m ${secs}s` : `${secs}s`) : "almost";
  const pct    = Math.min(100, (totalElapsed / primaryThreshold) * 100);

  return (
    <div className="mt-2 rounded-xl px-3 py-2.5 space-y-1.5"
      style={{ background: "rgba(14,30,54,0.7)", border: `1px solid ${primarySeg.barColor}33` }}>
      <div className="flex items-center justify-between">
        <p className="text-[11px] font-semibold" style={{ color: primarySeg.barColor }}>
          {primarySeg.emoji} {primarySeg.label} Goal
        </p>
        <p className="text-[11px] text-slate-400 font-medium">
          {secsLeft > 0 ? `${timeStr} away` : "almost there!"}
        </p>
      </div>
      <div className="h-1 rounded-full" style={{ background: primarySeg.dimColor + "66" }}>
        <div
          className="h-full rounded-full transition-all duration-1000"
          style={{ width: `${pct}%`, background: primarySeg.barColor, boxShadow: `0 0 6px ${primarySeg.barColor}88` }}
        />
      </div>
    </div>
  );
}

// ─── CountdownGoalHint ────────────────────────────────────────────────────────
// Shown below the countdown time picker when the set duration is shorter than
// what the user's goal requires right now, accounting for benefit decay.
//
// Uses the same modeled fade as BenefitBar: the selected goal's independently
// earned progress fades over its estimated product window.

/**
 * Pure helper: returns how many seconds are still needed to reach the selected
 * product estimate, accounting for decay from plunges already logged today.
 *
 * Returns 0 when the goal is fully covered (hint should be hidden).
 * Pass `nowMs` explicitly so tests can pin the clock.
 */
export function computeCountdownNeededSecs(
  primaryBenefit: SegmentId,
  tempF: number,
  todayPlungesData: { duration: number; createdAt: string | Date }[],
  nowMs: number,
  bodyWeightLbs = 150,
  bodyHeightCm  = 175,
  bodyFatPct?: number | null,
): number {
  const thresholds     = computeThresholds(tempF, bodyWeightLbs, bodyHeightCm, bodyFatPct);
  const primaryIdx     = SEGMENTS.findIndex(s => s.id === primaryBenefit);
  const todayLoggedSecs = todayPlungesData.reduce((s, p) => s + p.duration, 0);

  // Raw fill per segment (0–100), no decay yet
  const rawFills = computeBenefitFills(todayLoggedSecs, thresholds);

  // When each segment was earned (timestamp)
  const segmentEarnedAt: (number | undefined)[] = SEGMENTS.map(() => undefined);
  if (todayPlungesData.length > 0) {
    const sorted = [...todayPlungesData].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    let running = 0;
    for (const p of sorted) {
      running += p.duration;
      const plungeEnd = new Date(p.createdAt).getTime() + p.duration * 1000;
      SEGMENTS.forEach((_, i) => {
        if (segmentEarnedAt[i] !== undefined) return;
        if (running >= thresholds[i]) segmentEarnedAt[i] = plungeEnd;
      });
    }
  }

  // Decayed fill per segment
  const decayedFills = SEGMENTS.map((seg, i) => {
    if (rawFills[i] < 100) return rawFills[i];
    const anchor = segmentEarnedAt[i];
    if (!anchor) return 100;
    const msElapsed = nowMs - anchor;
    return Math.max(0, 100 * (1 - msElapsed / (seg.halfLifeHours * 3600 * 1000)));
  });

  return Math.max(0, Math.ceil(
    thresholds[primaryIdx] * (1 - decayedFills[primaryIdx] / 100),
  ));
}

interface CountdownGoalHintProps {
  primaryBenefit: SegmentId;
  setTimeSecs: number;
  tempF: number;
  bodyWeightLbs?: number;
  bodyHeightCm?: number;
  bodyFatPct?: number | null;
  /** Today's logged plunges — used to compute per-segment earnedAt for decay. */
  todayPlungesData?: { duration: number; createdAt: string | Date }[];
  onApply: (minutes: number, seconds: number) => void;
}

export function CountdownGoalHint({
  primaryBenefit,
  setTimeSecs,
  tempF,
  bodyWeightLbs = 150,
  bodyHeightCm  = 175,
  bodyFatPct,
  todayPlungesData = [],
  onApply,
}: CountdownGoalHintProps) {
  const primaryIdx = SEGMENTS.findIndex(s => s.id === primaryBenefit);
  const primarySeg = SEGMENTS[primaryIdx];

  const neededSecs = computeCountdownNeededSecs(
    primaryBenefit,
    tempF,
    todayPlungesData,
    Date.now(),
    bodyWeightLbs,
    bodyHeightCm,
    bodyFatPct,
  );

  // Silently skip if goal is already covered or set time already meets it
  if (neededSecs <= 0 || setTimeSecs >= neededSecs - 10) return null;

  // Explain if decay is the reason the recommendation is longer than expected
  const todayLoggedSecs = todayPlungesData.reduce((s, p) => s + p.duration, 0);
  const thresholds      = computeThresholds(tempF, bodyWeightLbs, bodyHeightCm, bodyFatPct);

  const recMins = Math.floor(neededSecs / 60);
  const recSecs = neededSecs % 60;
  const recStr  = `${recMins}:${String(recSecs).padStart(2, "0")}`;

  // Explain if decay is the reason the recommendation is longer than expected
  const decayDriven = todayLoggedSecs > 0 && neededSecs > (thresholds[primaryIdx] - todayLoggedSecs);

  return (
    <div
      className="mt-2 rounded-xl px-3 py-2.5 flex items-center gap-3"
      style={{
        background: `${primarySeg.barColor}10`,
        border: `1px solid ${primarySeg.barColor}40`,
      }}
    >
      <span className="text-lg shrink-0">{primarySeg.emoji}</span>
      <div className="flex-1 min-w-0">
        <p className="text-[11px] font-semibold leading-tight" style={{ color: primarySeg.barColor }}>
          {primarySeg.label} goal needs {recStr} right now
        </p>
        {decayDriven && (
          <p className="text-[10px] text-slate-500 leading-tight mt-0.5">
            Earlier benefits have faded — a bit more time needed
          </p>
        )}
      </div>
      <button
        onClick={() => onApply(recMins, recSecs)}
        className="shrink-0 px-2.5 py-1 rounded-lg text-[11px] font-bold transition-all active:scale-95"
        style={{ background: primarySeg.barColor, color: "#000d1a" }}
      >
        Set it
      </button>
    </div>
  );
}
