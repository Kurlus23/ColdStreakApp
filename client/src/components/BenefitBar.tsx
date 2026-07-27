import { useState, useEffect, useRef, useMemo } from "react";

// ─── Benefit segments ────────────────────────────────────────────────────────
// baseDuration = seconds each segment takes to fill at 50 °F.
const SEGMENTS = [
  { id: "energy",     emoji: "⚡", label: "Energy",     baseDuration: 60,  barColor: "#22d3ee", dimColor: "#164e63" },
  { id: "mood",       emoji: "😊", label: "Mood",       baseDuration: 120, barColor: "#fbbf24", dimColor: "#78350f" },
  { id: "metabolism", emoji: "🔥", label: "Metabolism", baseDuration: 120, barColor: "#f97316", dimColor: "#7c2d12" },
  { id: "recovery",   emoji: "💪", label: "Recovery",   baseDuration: 180, barColor: "#34d399", dimColor: "#064e3b" },
] as const;

// ─── Temperature factor ───────────────────────────────────────────────────────
// Colder water → smaller factor → segments fill faster.
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
}

export function BenefitBar({ elapsedSeconds, tempF, isActive, todayLoggedSeconds = 0 }: BenefitBarProps) {
  const factor = useMemo(() => getTempFactor(tempF), [tempF]);

  // Cumulative seconds at which each segment completes
  const cumulative = useMemo(() => {
    let total = 0;
    return SEGMENTS.map((seg) => {
      total += Math.round(seg.baseDuration * factor);
      return total;
    });
  }, [factor]);

  // Total cold exposure today: prior logged sessions + current live session
  const totalElapsed = todayLoggedSeconds + elapsedSeconds;

  // ── Milestone toasts ──────────────────────────────────────────────────────
  // Pre-seed on mount with any milestones already achieved from prior sessions
  // so we don't re-announce them when a new session starts.
  const announcedRef = useRef<Set<string> | null>(null);
  if (announcedRef.current === null) {
    // Compute cumulative inline for initialization (same formula as useMemo above)
    let t = 0;
    const initCum = SEGMENTS.map((seg) => {
      t += Math.round(seg.baseDuration * getTempFactor(tempF));
      return t;
    });
    announcedRef.current = new Set(
      SEGMENTS.filter((_, i) => todayLoggedSeconds >= initCum[i]).map((s) => s.id),
    );
  }

  const [milestone, setMilestone] = useState<string | null>(null);
  const milestoneTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Announce a milestone the first time its threshold is crossed while active
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

  // Re-seed announced set whenever prior logged seconds increase (new session saved)
  useEffect(() => {
    if (!announcedRef.current) return;
    SEGMENTS.forEach((seg, i) => {
      if (todayLoggedSeconds >= cumulative[i]) {
        announcedRef.current!.add(seg.id);
      }
    });
  }, [todayLoggedSeconds, cumulative]);

  // Per-segment fill percentage (0–100), driven by cumulative daily exposure
  const fills = SEGMENTS.map((_, i) => {
    const start = i === 0 ? 0 : cumulative[i - 1];
    const end = cumulative[i];
    if (totalElapsed <= start) return 0;
    if (totalElapsed >= end) return 100;
    return ((totalElapsed - start) / (end - start)) * 100;
  });

  // Always rendered — segments dim when nothing logged yet (no layout shift)
  return (
    <div className="px-1 space-y-1 my-2">
      {/* Milestone flash — always occupies space to prevent layout shift */}
      <p
        className="text-center text-[11px] font-semibold tracking-wide transition-opacity duration-500"
        style={{ opacity: milestone ? 1 : 0, color: "#6ee7b7", minHeight: "1rem" }}
      >
        {milestone ?? "\u00a0"}
      </p>

      {/* Segmented progress bar */}
      <div className="flex gap-1.5">
        {SEGMENTS.map((seg, i) => {
          const fill = fills[i];
          const done = fill >= 100;
          const active = fill > 0 && fill < 100;

          return (
            <div key={seg.id} className="flex-1 min-w-0 space-y-1">
              {/* Bar track */}
              <div
                className="relative h-2 rounded-full overflow-hidden"
                style={{ backgroundColor: seg.dimColor + "44" }}
              >
                {/* Filled portion */}
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${fill}%`,
                    backgroundColor: seg.barColor,
                    opacity: done ? 1 : active ? 0.85 : 0,
                    transition: "width 1s linear, opacity 0.3s ease",
                    boxShadow: active ? `0 0 6px 1px ${seg.barColor}66` : "none",
                  }}
                />
              </div>

              {/* Label */}
              <p
                className="text-center text-[9px] font-semibold leading-none truncate"
                style={{
                  color: done || active ? seg.barColor : "#1e3a5f",
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
