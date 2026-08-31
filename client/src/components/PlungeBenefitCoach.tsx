/**
 * PlungeBenefitCoach
 *
 * Two parts:
 *  1. CelebrationOverlay – compact toast that scale-fades in and auto-dismisses
 *     after 2.5 s. Non-blocking; timer stays visible beneath it.
 *  2. GoalNudge – persistent bar below the BenefitBar counting down to the
 *     goal (or cheering after it).
 */
import { useEffect, useRef, useState } from "react";
import { SEGMENTS, SegmentId, computeBenefitFills, computeThresholds } from "@/lib/benefitSegments";

// ─── Copy ─────────────────────────────────────────────────────────────────────

const BENEFIT_COPY: Record<SegmentId, { achieved: string; keepGoing: string }> = {
  energy:     { achieved: "Your Energy window is maximized.",              keepGoing: "Keep going — more benefit windows are building." },
  mood:       { achieved: "Your Mood window is maximized.",                keepGoing: "Keep going — more benefit windows are building." },
  metabolism: { achieved: "Your Metabolism window is maximized.",          keepGoing: "Keep going — Recovery is still building 💪" },
  recovery:   { achieved: "Your Recovery window is maximized.",            keepGoing: "All benefit windows are maximized. 🏆" },
};

// ─── CelebrationOverlay ───────────────────────────────────────────────────────

interface CelebrationProps {
  segmentId: SegmentId;
  primaryBenefit: SegmentId;
  onDismiss: () => void;
}

export function CelebrationOverlay({ segmentId, primaryBenefit, onDismiss }: CelebrationProps) {
  const seg       = SEGMENTS.find(s => s.id === segmentId)!;
  const isPrimary = segmentId === primaryBenefit;
  const primaryIdx = SEGMENTS.findIndex(s => s.id === primaryBenefit);
  const nextSeg   = isPrimary ? SEGMENTS[primaryIdx + 1] ?? null : null;
  const gold      = isPrimary;

  // Mount animation
  const [show, setShow] = useState(false);
  useEffect(() => { requestAnimationFrame(() => setShow(true)); }, []);

  // Auto-dismiss
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    timerRef.current = setTimeout(onDismiss, 2500);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div
      className="fixed inset-x-4 z-[60] flex justify-center pointer-events-none"
      style={{ top: "18%", bottom: "auto" }}
    >
      <div
        className="w-full max-w-xs rounded-2xl px-5 py-4 pointer-events-auto"
        style={{
          background: gold
            ? "linear-gradient(135deg, #78350f 0%, #0d1f3c 80%)"
            : "linear-gradient(135deg, #0e3a4a 0%, #0d1f3c 80%)",
          border: `1px solid ${gold ? "rgba(251,191,36,0.4)" : "rgba(34,211,238,0.3)"}`,
          boxShadow: gold
            ? "0 0 40px rgba(251,191,36,0.25), 0 8px 32px rgba(0,0,0,0.6)"
            : "0 0 40px rgba(34,211,238,0.2), 0 8px 32px rgba(0,0,0,0.6)",
          opacity: show ? 1 : 0,
          transform: show ? "scale(1) translateY(0)" : "scale(0.88) translateY(-8px)",
          transition: "opacity 0.22s ease, transform 0.22s ease",
        }}
        onClick={onDismiss}
      >
        {/* Top row: emoji + headline */}
        <div className="flex items-center gap-3 mb-1">
          <span
            className="text-3xl shrink-0"
            style={{ filter: gold ? "drop-shadow(0 0 10px rgba(251,191,36,0.8))" : "drop-shadow(0 0 10px rgba(34,211,238,0.7))" }}
          >
            {isPrimary ? "🎉" : seg.emoji}
          </span>
          <h2
            className="font-black text-base tracking-tight leading-tight"
            style={{
              background: gold
                ? "linear-gradient(to right, #fde68a, #f59e0b)"
                : "linear-gradient(to right, #ffffff, #67e8f9)",
              WebkitBackgroundClip: "text",
              WebkitTextFillColor: "transparent",
              backgroundClip: "text",
            }}
          >
            {isPrimary ? `${seg.label} Goal Maximized!` : `${seg.emoji} ${seg.label} Maximized`}
          </h2>
        </div>

        {/* Body */}
        <p className="text-slate-300 text-xs leading-relaxed mb-2">
          {BENEFIT_COPY[segmentId].achieved}
        </p>

        {/* Keep-going line */}
        {(isPrimary ? (nextSeg || true) : false) && (
          <p
            className="text-xs font-semibold"
            style={{ color: gold && !nextSeg ? "#fbbf24" : "#67e8f9" }}
          >
            {nextSeg ? BENEFIT_COPY[segmentId].keepGoing : "Every benefit window is maximized. Legendary. 🏆"}
          </p>
        )}
      </div>
    </div>
  );
}

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
  const nextIdx      = thresholds.findIndex((threshold) => totalElapsed < threshold);
  const nextSeg      = nextIdx >= 0 ? SEGMENTS[nextIdx] : null;

  if (goalAchieved && allAchieved) {
    return (
      <div className="mt-2 rounded-xl px-3 py-2 flex items-center gap-2"
        style={{ background: "rgba(251,191,36,0.08)", border: "1px solid rgba(251,191,36,0.2)" }}>
        <span className="text-base shrink-0">🏆</span>
        <p className="text-yellow-300 text-xs font-semibold leading-tight">All benefits achieved. Legendary session.</p>
      </div>
    );
  }

  if (goalAchieved && nextSeg) {
    const nextThreshold = thresholds[nextIdx];
    const secsLeft = Math.max(0, nextThreshold - totalElapsed);
    const mins = Math.floor(secsLeft / 60);
    const secs = secsLeft % 60;
    const timeStr = secsLeft > 0 ? (mins > 0 ? `${mins}m ${secs}s` : `${secs}s`) : "now";
    return (
      <div className="mt-2 rounded-xl px-3 py-2 flex items-center gap-2"
        style={{ background: "rgba(34,211,238,0.07)", border: "1px solid rgba(34,211,238,0.18)" }}>
        <span className="text-base shrink-0">{nextSeg.emoji}</span>
        <p className="text-cyan-300 text-xs font-semibold leading-tight">
          {secsLeft > 0 ? `Keep going — maximize ${nextSeg.label} in ${timeStr}` : `${nextSeg.label} window maximized! 🎉`}
        </p>
      </div>
    );
  }

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
// Uses the same decay model as BenefitBar: the selected goal's independently
// earned peak fades over its halfLifeHours.

/**
 * Pure helper: returns how many seconds are still needed to maximize the
 * selected benefit, accounting for decay from plunges already logged today.
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
