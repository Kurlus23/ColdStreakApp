import { useState, useEffect, useRef, useMemo } from "react";
import { SEGMENTS, getTempFactor, getCompositionFactor } from "@/lib/benefitSegments";

// ─── Component ────────────────────────────────────────────────────────────────
interface BenefitBarProps {
  /** Seconds elapsed in the current live session (stopwatch / countdown elapsed). */
  elapsedSeconds: number;
  /** Water temperature in °F. */
  tempF: number;
  /** Whether the timer is actively running. */
  isActive: boolean;
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
}: BenefitBarProps) {
  const tempFactor = useMemo(() => getTempFactor(tempF), [tempF]);
  const compFactor = useMemo(
    () => getCompositionFactor(bodyFatPct, bodyWeightLbs, bodyHeightCm),
    [bodyFatPct, bodyWeightLbs, bodyHeightCm],
  );

  // Cumulative seconds at which each segment completes
  const cumulative = useMemo(() => {
    let total = 0;
    return SEGMENTS.map((seg) => {
      total += Math.round(seg.baseDuration * tempFactor * compFactor);
      return total;
    });
  }, [tempFactor, compFactor]);

  // Total cold exposure today: prior logged sessions + current live session
  const totalElapsed = todayLoggedSeconds + elapsedSeconds;

  // ── Milestone toasts ──────────────────────────────────────────────────────
  const announcedRef = useRef<Set<string> | null>(null);
  if (announcedRef.current === null) {
    let t = 0;
    const initCum = SEGMENTS.map((seg) => {
      t += Math.round(seg.baseDuration * getTempFactor(tempF) * getCompositionFactor(bodyFatPct, bodyWeightLbs, bodyHeightCm));
      return t;
    });
    announcedRef.current = new Set(
      SEGMENTS.filter((_, i) => todayLoggedSeconds >= initCum[i]).map((s) => s.id),
    );
  }

  const [milestone, setMilestone] = useState<string | null>(null);
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (!isActive || elapsedSeconds === 0) return;
    SEGMENTS.forEach((seg, i) => {
      if (totalElapsed >= cumulative[i] && !announcedRef.current!.has(seg.id)) {
        announcedRef.current!.add(seg.id);
        setMilestone(`${seg.emoji} ${seg.label} achieved`);
        if (milestoneTimerRef.current) clearTimeout(milestoneTimerRef.current);
        milestoneTimerRef.current = setTimeout(() => setMilestone(null), 2500);
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [totalElapsed, isActive]);

  useEffect(() => {
    if (!announcedRef.current) return;
    SEGMENTS.forEach((seg, i) => {
      if (todayLoggedSeconds >= cumulative[i]) {
        announcedRef.current!.add(seg.id);
      }
    });
  }, [todayLoggedSeconds, cumulative]);

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
        if (running >= cumulative[i]) earnedAt[i] = plungeEnd;
      });
    }
    return earnedAt;
  }, [todayPlungesData, cumulative, lastPlungeEndedAt]);

  // ── Raw fill (0–100) based on total cold exposure ─────────────────────────
  const rawFills = SEGMENTS.map((_, i) => {
    const start = i === 0 ? 0 : cumulative[i - 1];
    const end = cumulative[i];
    if (totalElapsed <= start) return 0;
    if (totalElapsed >= end) return 100;
    return ((totalElapsed - start) / (end - start)) * 100;
  });

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

  return (
    <div className="px-0.5 space-y-0.5 mt-0.5 mb-0">
      {/* Milestone flash — collapses to zero height when nothing to show */}
      <p
        className="text-center text-[10px] font-semibold tracking-wide transition-opacity duration-500"
        style={{ opacity: milestone ? 1 : 0, color: "#6ee7b7", minHeight: milestone ? "0.875rem" : 0, height: milestone ? "0.875rem" : 0, overflow: "hidden" }}
      >
        {milestone ?? ""}
      </p>

      {/* Segmented progress bar */}
      <div className="flex gap-1.5">
        {SEGMENTS.map((seg, i) => {
          const decayedFill = decayedFills[i];
          const rawFill     = rawFills[i];
          const achieved    = achievedToday[i];
          const filling     = rawFill > 0 && rawFill < 100; // currently accumulating

          return (
            <div key={seg.id} className="flex-1 min-w-0 space-y-2">
              {/*
                Outer div = achievement ring (stays all day once earned).
                No overflow:hidden here so the ring is never clipped.
                Inner div = clips the decaying fill bar.
              */}
              <div
                className="relative h-2 rounded-full"
                style={{
                  backgroundColor: achieved
                    ? seg.barColor + "18"
                    : seg.dimColor + "44",
                  // Achievement border — the "you earned this today" marker
                  boxShadow: achieved
                    ? `0 0 0 1px ${seg.barColor}cc`
                    : "none",
                  transition: "box-shadow 0.4s ease, background-color 0.4s ease",
                }}
              >
                {/* Clip container for the decaying fill */}
                <div className="absolute inset-0 rounded-full overflow-hidden">
                  <div
                    className="absolute inset-y-0 left-0 rounded-full"
                    style={{
                      width: `${decayedFill}%`,
                      backgroundColor: seg.barColor,
                      opacity: decayedFill > 0 ? (filling ? 0.85 : 0.75) : 0,
                      transition: "width 1s linear, opacity 0.6s ease",
                      boxShadow: filling ? `0 0 6px 1px ${seg.barColor}66` : "none",
                    }}
                  />
                </div>
              </div>

              {/* Label — full colour when achieved (border earned), dim otherwise */}
              <p
                className="text-center text-[9px] font-semibold leading-normal overflow-hidden whitespace-nowrap text-ellipsis"
                style={{
                  color: achieved
                    ? seg.barColor          // achievement colour stays
                    : filling
                      ? seg.barColor + "bb"
                      : "#1e3a5f",
                  transition: "color 0.4s ease",
                }}
              >
                {seg.emoji} {seg.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}
