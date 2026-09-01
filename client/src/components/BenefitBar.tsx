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
      {/* Rail readout → Adaptation Zone once all benefits are maxed during a plunge */}
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
        <section
          className="rounded-[14px] border px-[14px] pb-[14px] pt-[15px]"
          style={{
            borderColor: "rgba(140, 210, 215, 0.2)",
            background: "rgba(10, 27, 35, 0.68)",
            boxShadow: "inset 0 1px rgba(220, 255, 255, 0.06), 0 20px 45px rgba(0, 0, 0, 0.25)",
          }}
          aria-label="Benefit progress"
        >
          <div className="grid min-h-[12px] grid-cols-3 items-center gap-2 text-[8px] font-mono uppercase leading-3 tracking-[0.08em] text-[#71949a]">
            <span className="justify-self-start">BENEFITS</span>
            <button
              type="button"
              onClick={() => onGoalTap?.()}
              disabled={isActive || !goalSeg}
              aria-label="Change goal"
              className="justify-self-center whitespace-nowrap border-0 bg-transparent p-0 font-inherit uppercase leading-3 tracking-[inherit] text-[#8ebfc3] transition-colors hover:text-[#d8f8f8] disabled:cursor-default disabled:opacity-0"
            >
              {goalSeg && !isActive ? "Tap to Change Goal" : ""}
            </button>
            <span className="flex items-center justify-end gap-1 whitespace-nowrap text-[#6e9197]">
              {goalSeg && (
                <>
                  <span>Goal:</span>
                  <strong className="font-semibold" style={{ color: goalSeg.barColor }}>
                    {goalSeg.label}
                  </strong>
                </>
              )}
            </span>
          </div>

          <div className="mt-[13px] grid grid-cols-4 gap-3" role="list">
          {SEGMENTS.map((seg, i) => {
            const decayedFill = decayedFills[i];
            const rawFill     = rawFills[i];
            const achieved    = achievedToday[i];
            const filling     = rawFill > 0 && rawFill < 100;

            return (
              <div key={seg.id} className="min-w-0" role="listitem">
                <div
                  className="flex items-center justify-center text-center text-[10px] leading-none whitespace-nowrap"
                  style={{
                    color: seg.barColor,
                  }}
                >
                  <strong className="overflow-hidden text-ellipsis font-semibold">
                    {seg.label}
                  </strong>
                </div>

                <div
                  className="relative mt-[10px] h-[3px] rounded-full bg-[rgba(157,203,207,0.14)]"
                  aria-label={`${seg.label}: ${achieved ? "complete" : `${fmtRemaining(Math.max(0, thresholds[i] - totalElapsed))} remaining`}`}
                >
                  <div
                    className="h-full rounded-full"
                    style={{
                      width: `${decayedFill}%`,
                      backgroundColor: seg.barColor,
                      opacity: decayedFill > 0 ? (filling ? 0.85 : 0.75) : 0,
                      transition: "width 1s linear, opacity 0.6s ease",
                      boxShadow: filling ? `0 0 10px 1px ${seg.barColor}66` : `0 0 10px ${seg.barColor}55`,
                    }}
                  />
                  <span
                    className="absolute top-1/2 h-[6px] w-[6px] -translate-x-1/2 -translate-y-1/2 rounded-full border"
                    style={{
                      left: `${decayedFill}%`,
                      borderColor: "#08131b",
                      backgroundColor: seg.barColor,
                      boxShadow: `0 0 0 1px ${seg.barColor}, 0 0 8px ${seg.barColor}88`,
                    }}
                    aria-hidden="true"
                  />
                </div>
                {isActive && (
                  <p
                    className="mt-[7px] text-[10px] text-left font-mono font-semibold leading-none tabular-nums"
                    style={{ color: seg.barColor, opacity: achieved ? 0.75 : 1 }}
                  >
                    {achieved ? "MAX" : fmtRemaining(Math.max(0, thresholds[i] - totalElapsed))}
                  </p>
                )}
              </div>
            );
          })}
          </div>
        </section>
      )}
    </div>
  );
}
