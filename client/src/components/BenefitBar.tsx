import { useState, useEffect, useRef, useMemo } from "react";
import { SEGMENTS, computeBenefitFills, getTempFactor, getCompositionFactor, type SegmentId } from "@/lib/benefitSegments";

// ─── Component ────────────────────────────────────────────────────────────────
interface BenefitBarProps {
  /** Seconds elapsed in the current live session (stopwatch / countdown elapsed). */
  elapsedSeconds: number;
  /** Water temperature in °F. */
  tempF: number;
  /** Whether the timer is actively running. */
  isActive: boolean;
  /** Called once per segment when it crosses its threshold during an active session. */
  onMilestoneReached?: (segmentId: SegmentId) => void;
  /** Current goal segment — shows a small tappable label at the top of the bar. */
  primaryBenefit?: SegmentId;
  /** Called when the user taps the goal label (disabled while a session is active). */
  onGoalTap?: () => void;
  /**
   * Sum of durations (seconds) of all plunges already logged today.
   * Carried over so a second session resumes from where the first stopped.
   * Defaults to 0.
   */
  todayLoggedSeconds?: number;
  /** User's body weight in lbs. Defaults to 150. */
  bodyWeightLbs?: number;
  /** User's height in cm. Defaults to 175 (≈ 5 ft 9 in). */
  bodyHeightCm?: number;
  /** Body fat percentage (e.g. 19.9). When set, takes priority over height+weight BMI. */
  bodyFatPct?: number | null;
  /**
   * Unix ms timestamp of when the last cold session ended.
   * Used as a fallback decay anchor when todayPlungesData is not provided.
   * Pass undefined during an active session.
   */
  lastPlungeEndedAt?: number;
  /**
   * Today's logged plunges in chronological order (oldest first).
   * When provided, each segment decays from the timestamp of the specific
   * plunge that first earned it — so a short second session doesn't reset
   * the decay timer on segments earned hours earlier.
   */
  todayPlungesData?: { duration: number; createdAt: string | Date }[];
}

export function BenefitBar({
  elapsedSeconds,
  tempF,
  isActive,
  todayLoggedSeconds = 0,
  bodyWeightLbs = 150,
  bodyHeightCm = 175,
  bodyFatPct,
  lastPlungeEndedAt,
  todayPlungesData,
  onMilestoneReached,
  primaryBenefit,
  onGoalTap,
}: BenefitBarProps) {
  const tempFactor = useMemo(() => getTempFactor(tempF), [tempF]);
  const compFactor = useMemo(
    () => getCompositionFactor(bodyFatPct, bodyWeightLbs, bodyHeightCm),
    [bodyFatPct, bodyWeightLbs, bodyHeightCm],
  );

  // Independent seconds at which each benefit reaches its peak window.
  const thresholds = useMemo(() => {
    return SEGMENTS.map((seg) => Math.round(seg.baseDuration * tempFactor * compFactor));
  }, [tempFactor, compFactor]);

  // Total cold exposure today: prior logged sessions + current live session
  const totalElapsed = todayLoggedSeconds + elapsedSeconds;

  // ── Milestone toasts ──────────────────────────────────────────────────────
  const announcedRef = useRef<Set<string> | null>(null);
  if (announcedRef.current === null) {
    const initialThresholds = SEGMENTS.map((seg) =>
      Math.round(seg.baseDuration * getTempFactor(tempF) * getCompositionFactor(bodyFatPct, bodyWeightLbs, bodyHeightCm)),
    );
    announcedRef.current = new Set(
      SEGMENTS.filter((_, i) => todayLoggedSeconds >= initialThresholds[i]).map((s) => s.id),
    );
  }

  const [milestone, setMilestone] = useState<string | null>(null);
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive || elapsedSeconds === 0) return;
    SEGMENTS.forEach((seg, i) => {
      if (totalElapsed >= thresholds[i] && !announcedRef.current!.has(seg.id)) {
        announcedRef.current!.add(seg.id);
        setMilestone(`${seg.emoji} ${seg.label} maximized`);
        if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
        milestoneTimerRef.current = setTimeout(() => setMilestone(null), 2500);
        onMilestoneReached?.(seg.id);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalElapsed, isActive]);

  useEffect(() => {
    if (!announcedRef.current) return;
    SEGMENTS.forEach((seg, i) => {
      if (todayLoggedSeconds >= thresholds[i]) {
        announcedRef.current!.add(seg.id);
      }
    });
  }, [todayLoggedSeconds, thresholds]);

  // ── Real-time clock for decay (ticks every 60s when resting) ─────────────
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (isActive || !lastPlungeEndedAt) return;
    const id = setInterval(() => setNow(Date.now()), 60_000);
    return () => clearInterval(id);
  }, [isActive, lastPlungeEndedAt]);

  // ── Per-segment earned-at timestamps ─────────────────────────────────────
  // Each segment decays from when IT was first earned today, not from whenever
  // the most recent plunge ended. This prevents a short second session from
  // resetting the decay timer on segments earned hours earlier.
  const segmentEarnedAt = useMemo((): (number | undefined)[] => {
    if (!todayPlungesData || todayPlungesData.length === 0) {
      return SEGMENTS.map(() => lastPlungeEndedAt);
    }
    const sorted = [...todayPlungesData].sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime(),
    );
    let running = 0;
    const earnedAt: (number | undefined)[] = SEGMENTS.map(() => undefined);
    for (const p of sorted) {
      running += p.duration;
      const plungeEnd = new Date(p.createdAt).getTime() + p.duration * 1000;
      SEGMENTS.forEach((_, i) => {
        if (earnedAt[i] !== undefined) return; // already recorded
        if (running >= thresholds[i]) earnedAt[i] = plungeEnd;
      });
    }
    return earnedAt;
  }, [todayPlungesData, thresholds, lastPlungeEndedAt]);

  // ── Raw fill (0–100) based on total cold exposure ─────────────────────────
  const rawFills = computeBenefitFills(totalElapsed, thresholds);

  // achievedToday[i] = segment was fully earned this calendar day
  const achievedToday = rawFills.map(f => f >= 100);

  // ── Decayed fill ──────────────────────────────────────────────────────────
  // Completed segments fade over their halfLifeHours from the moment they were
  // individually earned. Achievement border stays regardless.
  const decayedFills = SEGMENTS.map((seg, i) => {
    if (rawFills[i] < 100) return rawFills[i]; // not done yet — no decay
    if (isActive) return 100;                  // live session — no decay
    const anchor = segmentEarnedAt[i];
    if (!anchor) return 100;
    const msElapsed = now - anchor;
    return Math.max(0, 100 * (1 - msElapsed / (seg.halfLifeHours * 3600 * 1000)));
  });

  const goalSeg = primaryBenefit ? SEGMENTS.find(s => s.id === primaryBenefit) : null;
  const fmtRemaining = (s: number) => {
    const m = Math.floor(s / 60);
    const ss = Math.floor(s % 60);
    return `${m}:${String(ss).padStart(2, "0")}`;
  };

  return (
    <div className="px-0.5 space-y-0.5 mt-0.5 mb-0">
      {!isActive && goalSeg && (
        /* Goal tap line — shown at rest */
        <button
          onClick={() => { if (!isActive) onGoalTap?.(); }}
          disabled={isActive}
          className="w-full flex items-center justify-center gap-1 mb-1 transition-opacity"
          style={{ opacity: isActive ? 0.4 : 1 }}
        >
          <span className="text-[9px]" style={{ color: goalSeg.barColor }}>
            {goalSeg.emoji} {goalSeg.label} goal
          </span>
          {!isActive && (
            <span className="text-[9px] text-slate-500">· tap to change</span>
          )}
        </button>
      )}

      {/* Segmented bar → Adaptation Zone once all benefits are maxed during a plunge */}
      {isActive && achievedToday.every(Boolean) ? (
        <div className="space-y-1.5">
          <div className="relative h-2 rounded-full overflow-hidden bg-cyan-400/15">
            <div
              className="absolute inset-0 rounded-full animate-pulse"
              style={{ backgroundColor: "#67e8f9", opacity: 0.7 }}
            />
          </div>
          <div className="flex items-center justify-center gap-1.5">
            <p className="text-[9px] font-semibold tracking-wide text-cyan-300 uppercase">
              Adaptation Zone
            </p>
            <span className="text-[9px] text-slate-500">· Score only</span>
          </div>
        </div>
      ) : (
        <div className="flex gap-1.5">
          {SEGMENTS.map((seg, i) => {
            const decayedFill = decayedFills[i];
            const rawFill     = rawFills[i];
            const achieved    = achievedToday[i];
            const filling     = rawFill > 0 && rawFill < 100;

            return (
              <div key={seg.id} className="flex-1 min-w-0">
                <div
                  className="relative h-5 rounded-md overflow-hidden"
                  style={{
                    backgroundColor: achieved ? seg.barColor + "18" : seg.dimColor + "44",
                    boxShadow: achieved ? `0 0 0 1px ${seg.barColor}cc` : "none",
                    transition: "box-shadow 0.4s ease, background-color 0.4s ease",
                  }}
                >
                  <div className="absolute inset-0 rounded-md overflow-hidden">
                    <div
                      className="absolute inset-y-0 left-0 rounded-md"
                      style={{
                        width: `${decayedFill}%`,
                        backgroundColor: seg.barColor,
                        opacity: decayedFill > 0 ? (filling ? 0.85 : 0.75) : 0,
                        transition: "width 1s linear, opacity 0.6s ease",
                        boxShadow: filling ? `0 0 6px 1px ${seg.barColor}66` : "none",
                      }}
                    />
                  </div>
                  <span
                    className="absolute inset-0 z-10 flex items-center justify-center px-0.5 text-[8px] font-bold leading-none whitespace-nowrap"
                    style={{
                        color: seg.barColor,
                        textShadow: "0 1px 2px rgba(0,0,0,0.8)",
                    }}
                  >
                    {seg.emoji} {seg.label}
                  </span>
                </div>
                {isActive && (
                  <p
                    className="mt-1 text-center text-[9px] font-mono font-semibold tabular-nums"
                    style={{ color: seg.barColor, opacity: achieved ? 0.75 : 1 }}
                  >
                    {achieved ? "MAX" : fmtRemaining(Math.max(0, thresholds[i] - totalElapsed))}
                  </p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
