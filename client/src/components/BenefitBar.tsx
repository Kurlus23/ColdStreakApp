import { useState, useEffect, useRef, useMemo } from "react";

// ─── Benefit segments ────────────────────────────────────────────────────────
// baseDuration = seconds each segment takes to fill at 50 °F, BMI 22 (neutral).
// halfLifeHours = how long the acute effect lasts before fading to 0 (linear).
const SEGMENTS = [
  { id: "energy",     emoji: "⚡", label: "Energy",     baseDuration: 60,  barColor: "#22d3ee", dimColor: "#164e63", halfLifeHours: 3 },
  { id: "mood",       emoji: "😊", label: "Mood",       baseDuration: 120, barColor: "#fbbf24", dimColor: "#78350f", halfLifeHours: 5 },
  { id: "metabolism", emoji: "🔥", label: "Metabolism", baseDuration: 120, barColor: "#f97316", dimColor: "#7c2d12", halfLifeHours: 6 },
  { id: "recovery",   emoji: "💪", label: "Recovery",   baseDuration: 180, barColor: "#34d399", dimColor: "#064e3b", halfLifeHours: 8 },
] as const;

// ─── Temperature factor ───────────────────────────────────────────────────────
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

// ─── BMI factor ───────────────────────────────────────────────────────────────
const NEUTRAL_BMI = 22;

function getBmiFactor(weightLbs: number, heightCm: number): number {
  if (heightCm <= 0 || weightLbs <= 0) return 1.0;
  const weightKg = weightLbs / 2.205;
  const heightM  = heightCm / 100;
  const bmi = weightKg / (heightM * heightM);
  return Math.min(1.35, Math.max(0.75, bmi / NEUTRAL_BMI));
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
  /** User's body weight in lbs. Defaults to 150. */
  bodyWeightLbs?: number;
  /** User's height in cm. Defaults to 175 (≈ 5 ft 9 in). */
  bodyHeightCm?: number;
  /**
   * Unix ms timestamp of when the last cold session ended.
   * When provided (and isActive is false), completed segments decay their fill
   * over each segment's halfLifeHours while keeping their achievement border.
   * Pass undefined during an active session.
   */
  lastPlungeEndedAt?: number;
}

export function BenefitBar({
  elapsedSeconds,
  tempF,
  isActive,
  todayLoggedSeconds = 0,
  bodyWeightLbs = 150,
  bodyHeightCm = 175,
  lastPlungeEndedAt,
}: BenefitBarProps) {
  const tempFactor = useMemo(() => getTempFactor(tempF), [tempF]);
  const bmiFactor  = useMemo(() => getBmiFactor(bodyWeightLbs, bodyHeightCm), [bodyWeightLbs, bodyHeightCm]);

  // Cumulative seconds at which each segment completes
  const cumulative = useMemo(() => {
    let total = 0;
    return SEGMENTS.map((seg) => {
      total += Math.round(seg.baseDuration * tempFactor * bmiFactor);
      return total;
    });
  }, [tempFactor, bmiFactor]);

  // Total cold exposure today: prior logged sessions + current live session
  const totalElapsed = todayLoggedSeconds + elapsedSeconds;

  // ── Milestone toasts ──────────────────────────────────────────────────────
  const announcedRef = useRef<Set<string> | null>(null);
  if (announcedRef.current === null) {
    let t = 0;
    const initCum = SEGMENTS.map((seg) => {
      t += Math.round(seg.baseDuration * getTempFactor(tempF) * getBmiFactor(bodyWeightLbs, bodyHeightCm));
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

  // ── Decayed fill (Option C) ────────────────────────────────────────────────
  // For completed segments when not actively plunging, the fill fades linearly
  // over halfLifeHours. The achievement border stays regardless.
  const decayedFills = SEGMENTS.map((seg, i) => {
    if (rawFills[i] < 100) return rawFills[i]; // not done yet — no decay
    if (isActive || !lastPlungeEndedAt) return 100; // live session — no decay
    const msElapsed = now - lastPlungeEndedAt;
    return Math.max(0, 100 * (1 - msElapsed / (seg.halfLifeHours * 3600 * 1000)));
  });

  return (
    <div className="px-1 space-y-1 my-2">
      {/* Milestone flash */}
      <p
        className="text-center text-[11px] font-semibold tracking-wide transition-opacity duration-500"
        style={{ opacity: milestone ? 1 : 0, color: "#6ee7b7", minHeight: "1rem" }}
      >
        {milestone ?? "\u00a0"}
      </p>

      {/* Segmented progress bar */}
      <div className="flex gap-1.5">
        {SEGMENTS.map((seg, i) => {
          const decayedFill = decayedFills[i];
          const rawFill     = rawFills[i];
          const achieved    = achievedToday[i];
          const filling     = rawFill > 0 && rawFill < 100; // currently accumulating

          return (
            <div key={seg.id} className="flex-1 min-w-0 space-y-1">
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
                className="text-center text-[9px] font-semibold leading-none truncate"
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
