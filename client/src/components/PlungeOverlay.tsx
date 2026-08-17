import { useState, useEffect, useRef } from "react";
import { ColdTakeOverlay, MilestoneEvent } from "@/components/ColdTakeOverlay";
import { BenefitBar } from "@/components/BenefitBar";
import { BrainFreezeGame } from "@/components/BrainFreezeGame";
import { SEGMENTS, type SegmentId, computeThresholds, getCompositionFactorForScore } from "@/lib/benefitSegments";

// ─── Helpers ──────────────────────────────────────────────────────────────────
function fmtSecs(s: number) {
  const m = Math.floor(s / 60);
  const ss = Math.floor(Math.round(s) % 60);
  return `${m}:${String(ss).padStart(2, "0")}`;
}

// ─── SVG ring helpers ─────────────────────────────────────────────────────────
const CX = 140;
const CY = 140;
const R  = 112;
const STROKE = 9;
const CIRC = 2 * Math.PI * R;

function anglePt(r: number, pct: number) {
  const a = pct * 2 * Math.PI - Math.PI / 2;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

// Colours assigned to each challenger in order (rose, amber, violet, green)
const CHALLENGER_COLORS = ["#fda4af", "#fbbf24", "#a78bfa", "#86efac"];

interface ChallengerMark {
  /** 0–1 position on the ring arc */
  pct: number;
  /** First name shown on the label */
  name: string;
  /** Accent colour for this challenger's mark */
  color: string;
  /** True when the user is currently beating this challenger */
  beating: boolean;
}

interface RingProps {
  /** 0–1 fill of the arc */
  progress: number;
  /** Label shown at the target marker (12 o'clock). Null = no marker (decorative ring). */
  targetLabel: string | null;
  /** When set, overrides the cyan gradient with a solid segment colour */
  accentColor?: string;
  /** Per-challenger marks at their respective "time to beat" positions */
  challengerMarks?: ChallengerMark[];
}

function ChallengeRing({ progress, targetLabel, accentColor, challengerMarks = [] }: RingProps) {
  const dot        = anglePt(R, Math.min(progress, 0.999));
  const arcColor   = accentColor ?? "url(#progress-grad)";
  const glowColor  = accentColor ? `${accentColor}88` : "rgba(34,211,238,0.55)";
  const dotColor   = accentColor ?? "#22d3ee";
  const dotGlow    = accentColor ? `drop-shadow(0 0 10px ${accentColor})` : "drop-shadow(0 0 10px rgba(34,211,238,1))";
  const markerFill = accentColor ?? "#fb7185";
  const markerGlow = accentColor
    ? `drop-shadow(0 0 6px ${accentColor}cc)`
    : "drop-shadow(0 0 6px rgba(244,63,94,0.9))";
  const labelFill  = accentColor ? accentColor : "rgba(251,113,133,0.85)";

  return (
    <svg
      viewBox="0 0 280 280"
      className="w-[280px] h-[280px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
    >
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(34,211,238,0.14)"
        strokeWidth={STROKE}
      />

      {/* Progress arc */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke={arcColor}
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - Math.min(progress, 1))}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}
      />

      {/* Target marker at 12 o'clock */}
      {targetLabel && (
        <>
          <circle cx={CX} cy={CY - R} r={5} fill={markerFill}
            style={{ filter: markerGlow }} />
          <text
            x={CX} y={CY - R - 11}
            textAnchor="middle"
            fill={labelFill}
            fontSize="9"
            fontFamily="sans-serif"
            fontWeight="700"
            letterSpacing="0.06em"
          >
            {targetLabel}
          </text>
        </>
      )}

      {/* Per-challenger "time to beat" marks */}
      {challengerMarks.map((m, i) => {
        const clampedPct = Math.min(m.pct, 1.0);
        const pt = anglePt(R, clampedPct);
        // Label offset: push outward from centre so it clears the ring
        const outerPt = anglePt(R + 18, clampedPct);
        const anchor = outerPt.x < CX - 4 ? "end" : outerPt.x > CX + 4 ? "start" : "middle";
        const glow = `drop-shadow(0 0 6px ${m.color}bb)`;
        return (
          <g key={i}>
            {/* Diamond mark on the ring */}
            <polygon
              points={`${pt.x},${pt.y - 5} ${pt.x + 4},${pt.y} ${pt.x},${pt.y + 5} ${pt.x - 4},${pt.y}`}
              fill={m.color}
              style={{ filter: glow }}
            />
            {/* Name label */}
            <text
              x={outerPt.x}
              y={outerPt.y + 3}
              textAnchor={anchor}
              fill={m.color}
              fontSize="8"
              fontFamily="sans-serif"
              fontWeight="700"
              letterSpacing="0.04em"
            >
              {m.name.split(" ")[0]}
            </text>
          </g>
        );
      })}

      {/* Live leading dot */}
      {progress > 0.01 && (
        <circle cx={dot.x} cy={dot.y} r={6} fill={dotColor}
          style={{ filter: dotGlow }} />
      )}

      <defs>
        <linearGradient id="po-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#0e7490" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
        <linearGradient id="progress-grad" xlinkHref="#po-grad" />
      </defs>
    </svg>
  );
}

// ─── Props ────────────────────────────────────────────────────────────────────
interface PlungeOverlayProps {
  displaySeconds: number;
  formattedTime: string;
  /** Raw wall-clock timestamp (Date.now()) when the stopwatch plunge started.
   *  When provided, PlungeOverlay drives its own display timer so the clock
   *  stays accurate even if the parent's setInterval is throttled/dropped. */
  plungeStartTime?: number | null;
  displayScore: number;
  temperature: number;
  tempDisplay: string;
  personalBest: number;
  /** All active challengers — one entry per pending challenge. */
  challengers: Array<{ name: string; score: number | null }>;
  elapsedSeconds: number;
  benefitCarryOver: number;
  isActive: boolean;
  countdownMode: boolean;
  isPro: boolean;
  isLandscape: boolean;
  streak: number;
  plungesCount: number;
  bodyWeightLbs: number;
  bodyHeightCm: number;
  bodyFatPct?: number | null;
  btConnected: boolean;
  primaryBenefit?: SegmentId | null;
  milestoneEvent?: MilestoneEvent | null;
  onStop: () => void;
  onDismissChallenger: () => void;
  brainFreezeEnabled?: boolean;
  onBrainFreezeScore?: (score: number) => void;
  onBrainFreezeToggle?: (enabled: boolean) => void;
  onBrainFreezeCountdown?: (seconds: number | null) => void;
  onBrainFreezeStats?: (correct: number, total: number) => void;
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PlungeOverlay({
  displaySeconds,
  formattedTime: _formattedTime,
  displayScore,
  temperature,
  tempDisplay,
  personalBest,
  challengers,
  elapsedSeconds,
  benefitCarryOver,
  isActive,
  countdownMode,
  isPro,
  isLandscape,
  streak,
  plungesCount,
  bodyWeightLbs,
  bodyHeightCm,
  bodyFatPct,
  btConnected,
  primaryBenefit,
  milestoneEvent,
  onStop,
  onDismissChallenger,
  brainFreezeEnabled = false,
  onBrainFreezeScore,
  onBrainFreezeToggle,
  onBrainFreezeCountdown,
  onBrainFreezeStats,
  plungeStartTime,
}: PlungeOverlayProps) {
  const [nextQuestionIn, setNextQuestionIn] = useState<number | null>(null);
  // ── Wall-clock display timer ──────────────────────────────────────────────────
  // Drives its own setInterval from the raw start timestamp so the clock stays
  // accurate even if the parent's 1-second interval is throttled or dropped on iOS.
  const [localDisplaySecs, setLocalDisplaySecs] = useState(displaySeconds);
  useEffect(() => {
    if (!isActive || countdownMode || !plungeStartTime) {
      setLocalDisplaySecs(displaySeconds);
      return;
    }
    const tick = () => setLocalDisplaySecs(Math.floor((Date.now() - plungeStartTime) / 1000));
    tick(); // sync immediately on mount / start-time change
    const id = setInterval(tick, 500); // 500 ms for sub-second snappiness
    return () => clearInterval(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isActive, countdownMode, plungeStartTime]);

  // Keep countdown (and no-start-time) mode in sync with parent
  useEffect(() => {
    if (countdownMode || !plungeStartTime || !isActive) {
      setLocalDisplaySecs(displaySeconds);
    }
  }, [displaySeconds, countdownMode, plungeStartTime, isActive]);

  const formattedTime = fmtSecs(localDisplaySecs);

  // ── Goal-progress ring ────────────────────────────────────────────────────────
  // One continuous arc sweeping 0→100% as the user approaches their primary
  // benefit goal (e.g. Recovery). Segment milestones are still tracked for the
  // BenefitBar, but the ring itself only cares about the final goal threshold.
  const earnedSegmentsRef = useRef(new Set<number>());

  const benefitThresholds = computeThresholds(temperature, bodyWeightLbs, bodyHeightCm, bodyFatPct);
  const totalBenefitElapsed = benefitCarryOver + elapsedSeconds;
  const primarySegIdx = primaryBenefit
    ? SEGMENTS.findIndex(s => s.id === primaryBenefit)
    : -1;

  // Permanently mark earned segments (used by BenefitBar countdown).
  if (primarySegIdx >= 0) {
    for (let i = 0; i <= primarySegIdx; i++) {
      if (totalBenefitElapsed >= benefitThresholds[i]) earnedSegmentsRef.current.add(i);
    }
  }

  // ── Ring: tracks overall goal (0 → primary goal threshold) ───────────────────
  const primarySeg        = primarySegIdx >= 0 ? SEGMENTS[primarySegIdx] : null;
  const primaryGoalThresh = primarySegIdx >= 0 ? benefitThresholds[primarySegIdx] : 0;

  // Single sweep from 0 to 1 representing total progress to the goal.
  const goalRingProgress = primaryGoalThresh > 0
    ? Math.min(1, totalBenefitElapsed / primaryGoalThresh)
    : (personalBest > 0 && displayScore > 0 ? Math.min(1, displayScore / personalBest) : 0);

  const goalSecsRemaining = primaryGoalThresh > 0
    ? Math.max(0, primaryGoalThresh - totalBenefitElapsed)
    : 0;
  const goalTargetLabel = primarySeg
    ? (goalSecsRemaining > 0
        ? `${primarySeg.emoji} ${fmtSecs(goalSecsRemaining)}`
        : `${primarySeg.emoji} Done!`)
    : (personalBest > 0 ? `PB ${personalBest.toFixed(1)}` : null);
  // ── Multi-challenger ring marks & race status ─────────────────────────────────
  const inChallenge = challengers.length > 0;

  // Convert each challenger's score to a position on the goal-time ring.
  // score = (secs/60) × coldFactor × compositionFactor  →  secs = score×60 / (cf×bf)
  let coldFactor = 1;
  if (temperature <= 55) coldFactor = 1.2;
  if (temperature <= 50) coldFactor = 1.5;
  if (temperature <= 45) coldFactor = 1.9;
  if (temperature <= 40) coldFactor = 2.3;
  const compositionFactor = getCompositionFactorForScore(bodyFatPct, bodyWeightLbs, bodyHeightCm);

  // Build per-challenger ring marks.
  // Use the original index (i) from the full challengers array so that
  // each mark's colour matches the corresponding score box below.
  // Skip challengers whose score is null or ≤ 0 (no meaningful position).
  const challengerMarks: ChallengerMark[] = primaryGoalThresh > 0
    ? challengers
        .map((c, i) => {
          if (c.score === null || c.score <= 0) return null;
          const targetSecs = (c.score * 60) / (coldFactor * compositionFactor);
          const pct = targetSecs / primaryGoalThresh;
          return {
            pct,
            name: c.name,
            color: CHALLENGER_COLORS[i % CHALLENGER_COLORS.length],
            beating: displayScore >= c.score,
          };
        })
        .filter((m): m is ChallengerMark => m !== null)
    : [];

  // Only count challengers with a real (> 0) score — same predicate used for ring marks.
  const scoredCount  = challengers.filter((c) => c.score !== null && c.score > 0).length;
  const beatingCount = challengers.filter((c) => c.score !== null && c.score > 0 && displayScore >= c.score).length;
  const allWinning   = inChallenge && scoredCount > 0 && beatingCount === scoredCount;

  // Ring accent colour: cyan when beating everyone, pink when behind any.
  const goalAccentColor = inChallenge
    ? (allWinning ? "#67e8f9" : "#fda4af")
    : primarySeg?.barColor;

  const statusLabel = inChallenge && scoredCount > 0
    ? challengers.length === 1
      ? beatingCount === 1
        ? `You beat ${challengers[0].name.split(" ")[0]}! ❄️`
        : `${(challengers[0].score! - displayScore).toFixed(1)} pts to beat ${challengers[0].name.split(" ")[0]}`
      : `Beating ${beatingCount} of ${challengers.length} ❄️`
    : null;

  return (
    <div
      className="fixed inset-0 z-[60] flex flex-col items-center justify-between overflow-hidden animate-in fade-in"
      style={{ background: "linear-gradient(to bottom, #0c2a42 0%, #071a2e 60%, #040f1e 100%)" }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 65%)" }} />
        <div className="absolute top-[20%] left-[15%] w-[200px] h-[200px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(14,116,144,0.14) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[20%] right-[10%] w-[180px] h-[180px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)" }} />
      </div>

      {/* Wordmark */}
      <div className="w-full flex flex-col items-center pt-14 pb-2 z-10 shrink-0">
        <span
          className="text-xl font-black pointer-events-none select-none tracking-[0.2em]"
          style={{
            background: "linear-gradient(to bottom, #ffffff 0%, #a5f3fc 60%, #0891b2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 2px 12px rgba(8,145,178,0.6))",
          }}
        >
          COLDSTREAK
        </span>
      </div>

      {/* Ring + timer hero */}
      <div className="relative flex-1 flex items-center justify-center w-full z-10 shrink-0" style={{ minHeight: "300px" }}>
        {/* Goal-progress ring — always visible; challenge score boxes overlay it */}
        <ChallengeRing
          progress={goalRingProgress}
          targetLabel={goalTargetLabel}
          accentColor={goalAccentColor}
          challengerMarks={challengerMarks}
        />

        <div className="relative z-10 flex flex-col items-center gap-0.5">
          <div
            className="font-mono font-bold text-white leading-none tracking-tighter"
            data-testid="display-timer-overlay"
            style={{
              fontSize: isLandscape ? "14vw" : "4.5rem",
              filter: "drop-shadow(0 0 18px rgba(34,211,238,0.5))",
            }}
          >
            {formattedTime}
          </div>

          {/* Race status pill — challenge mode only */}
          {statusLabel && (
            <div
              className="mt-2 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
              style={{
                background: allWinning ? "rgba(34,211,238,0.15)" : "rgba(251,113,133,0.15)",
                border: allWinning ? "1px solid rgba(34,211,238,0.4)" : "1px solid rgba(251,113,133,0.4)",
                color: allWinning ? "#67e8f9" : "#fda4af",
              }}
            >
              {statusLabel}
            </div>
          )}

          {/* Dismiss all challenges button */}
          {inChallenge && (
            <button
              onClick={onDismissChallenger}
              className="mt-1 text-slate-500 hover:text-slate-300 text-[10px] leading-none"
              title="Dismiss challenge"
            >
              ✕ dismiss
            </button>
          )}
        </div>

        {/* ── Challenge score boxes — You vs all challengers ── */}
        {inChallenge && (
          <div className="absolute bottom-4 left-0 right-0 flex items-end justify-center px-3 pointer-events-none gap-2">
            {/* You */}
            <div
              className="flex flex-col items-center rounded-2xl px-3 py-2 shrink-0"
              style={{
                background: allWinning ? "rgba(34,211,238,0.12)" : "rgba(7,26,50,0.75)",
                border: allWinning ? "1px solid rgba(34,211,238,0.45)" : "1px solid rgba(30,58,95,0.7)",
                backdropFilter: "blur(6px)",
                boxShadow: allWinning ? "0 0 16px rgba(34,211,238,0.18)" : "none",
                minWidth: "56px",
              }}
            >
              <span className="text-[9px] uppercase tracking-widest font-semibold text-blue-400 mb-0.5">You</span>
              <span
                className="text-lg font-bold tabular-nums leading-none"
                style={{ color: allWinning ? "#67e8f9" : "#e2e8f0" }}
              >
                {displayScore > 0 ? displayScore.toFixed(1) : "—"}
              </span>
            </div>

            <span className="text-blue-700/60 text-xs font-bold self-center pb-1 shrink-0">vs</span>

            {/* Challenger chips — horizontally scrollable strip so 3+ never wrap or overflow */}
            <div
              className="flex flex-row gap-1.5 overflow-x-auto pointer-events-auto max-w-[60%]"
              style={{ scrollbarWidth: "none", WebkitOverflowScrolling: "touch" }}
            >
              {challengers.map((c, i) => {
                const chipColor = CHALLENGER_COLORS[i % CHALLENGER_COLORS.length];
                const isBeating = c.score !== null && displayScore >= c.score;
                return (
                  <div
                    key={i}
                    className="flex flex-col items-center rounded-2xl px-3 py-2 shrink-0"
                    style={{
                      background: isBeating ? "rgba(7,26,50,0.75)" : `${chipColor}1a`,
                      border: isBeating ? "1px solid rgba(30,58,95,0.7)" : `1px solid ${chipColor}55`,
                      backdropFilter: "blur(6px)",
                      minWidth: "52px",
                    }}
                  >
                    <span
                      className="text-[9px] uppercase tracking-widest font-semibold mb-0.5 truncate max-w-[52px]"
                      style={{ color: chipColor }}
                    >
                      {c.name.split(" ")[0]}
                    </span>
                    <span
                      className="text-lg font-bold tabular-nums leading-none"
                      style={{ color: c.score !== null ? (isBeating ? "#94a3b8" : chipColor) : "#64748b" }}
                    >
                      {c.score !== null ? c.score.toFixed(1) : "—"}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* Cold Take */}
      <div className="w-full px-5 pb-3 z-10 shrink-0">
        <ColdTakeOverlay
          isActive={isActive}
          elapsedSeconds={localDisplaySecs}
          tempF={temperature}
          isFirstPlunge={plungesCount === 0}
          streakDays={streak}
          milestoneEvent={milestoneEvent}
          challengerName={challengers[0]?.name ?? null}
        />
      </div>

      {/* Bottom HUD — no unified panel; each row floats independently */}
      <div className="w-full z-10 shrink-0 px-6 pb-10 flex flex-col gap-4">

        {/* Brain Freeze incoming announcement — shown for first 30s when enabled */}
        {(() => {
          const showAnnouncement = brainFreezeEnabled && isActive && localDisplaySecs < 30;
          return (
            <>
              {showAnnouncement && (
                <div
                  className="w-full flex items-center gap-3 px-4 py-3 rounded-2xl"
                  style={{
                    background: "rgba(34,211,238,0.09)",
                    border: "1px solid rgba(34,211,238,0.3)",
                    backdropFilter: "blur(8px)",
                    boxShadow: "0 0 20px rgba(34,211,238,0.08)",
                  }}
                >
                  <img
                    src="/brain-freeze-icon.png"
                    alt=""
                    className="w-8 h-8 rounded-xl object-cover shrink-0"
                    style={{ boxShadow: "0 0 10px rgba(96,165,250,0.4)" }}
                  />
                  <div className="flex-1 min-w-0">
                    <p className="text-cyan-300 text-xs font-bold leading-none mb-0.5">Brain Freeze Trivia</p>
                    <p className="text-blue-400/70 text-[10px] leading-none">
                      First question in {Math.max(0, 30 - localDisplaySecs)}s
                    </p>
                  </div>
                </div>
              )}
            </>
          );
        })()}

        {/* Stats row — pill-shaped glass card */}
        <div
          className="flex items-center justify-between px-5 py-3 rounded-2xl"
          style={{
            background: "rgba(6,182,212,0.07)",
            border: "1px solid rgba(34,211,238,0.12)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5">
              <span className={`text-[9px] uppercase tracking-widest font-semibold ${btConnected ? "text-green-400 animate-pulse" : "text-slate-600"}`}>Live Temp</span>
            </div>
            <span className={`text-2xl font-bold tracking-tight ${btConnected ? "text-white" : "text-slate-600"}`}>{tempDisplay}</span>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-cyan-400 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Cold Score</span>
            <span className="text-cyan-300 text-2xl font-bold tracking-tight animate-pulse-glow">
              {displayScore > 0 ? displayScore.toFixed(1) : "—"}
            </span>
          </div>
          {personalBest > 0 && (
            <>
              <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
              <div className="flex flex-col items-center">
                <span className="text-amber-400 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Personal Best</span>
                <span className="text-amber-300 text-2xl font-bold tracking-tight"
                  style={{ textShadow: "0 0 12px rgba(251,191,36,0.3)" }}>
                  {personalBest.toFixed(1)}
                </span>
              </div>
            </>
          )}
        </div>

        {/* Benefit bar — sits on its own line, no extra wrapper */}
        <BenefitBar
          elapsedSeconds={elapsedSeconds}
          tempF={temperature}
          isActive={isActive}
          todayLoggedSeconds={benefitCarryOver}
          bodyWeightLbs={bodyWeightLbs}
          bodyHeightCm={bodyHeightCm}
          bodyFatPct={bodyFatPct}
        />

        {/* Brain Freeze toggle */}
        <button
          onClick={() => onBrainFreezeToggle?.(!brainFreezeEnabled)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all active:scale-[0.98]"
          style={{
            background: brainFreezeEnabled ? "rgba(34,211,238,0.08)" : "rgba(6,18,52,0.55)",
            border: `1px solid ${brainFreezeEnabled ? "rgba(34,211,238,0.22)" : "rgba(59,130,246,0.12)"}`,
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="flex items-center gap-2.5">
            <img src="/brain-freeze-icon.png" alt="" className="w-6 h-6 rounded-lg object-cover shrink-0" style={{ opacity: brainFreezeEnabled ? 1 : 0.4 }} />
            <div className="flex flex-col items-start">
              <span className="text-xs font-semibold" style={{ color: brainFreezeEnabled ? "#67e8f9" : "#475569" }}>
                Brain Freeze Trivia
              </span>
              {brainFreezeEnabled && nextQuestionIn !== null && (
                <span className="text-[10px] leading-none mt-0.5" style={{ color: "rgba(103,232,249,0.55)" }}>
                  Next question in {nextQuestionIn}s
                </span>
              )}
            </div>
          </div>
          {/* Toggle pill */}
          <div className={`relative w-10 h-5 rounded-full transition-colors ${brainFreezeEnabled ? "bg-cyan-500" : "bg-slate-700"}`}>
            <span className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform ${brainFreezeEnabled ? "translate-x-5" : "translate-x-0"}`} />
          </div>
        </button>

        {/* Stop button — floats with just its glow halo */}
        <button
          data-testid="button-stop-overlay"
          onClick={onStop}
          className="w-full relative group"
        >
          <div className="absolute inset-0 bg-red-600 rounded-2xl blur-lg opacity-50 group-hover:opacity-80 transition-opacity duration-300" />
          <div className="relative bg-gradient-to-b from-red-500 to-red-700 border border-red-400/50 text-white font-bold py-5 rounded-2xl text-xl tracking-wider transition-all active:scale-[0.98] shadow-[inset_0_2px_10px_rgba(255,255,255,0.3)]">
            STOP
          </div>
        </button>
      </div>

      {/* ── Brain Freeze trivia game ── renders as a full overlay on top */}
      <BrainFreezeGame
        elapsedSeconds={elapsedSeconds}
        temperature={temperature}
        isActive={isActive}
        enabled={brainFreezeEnabled}
        onScoreUpdate={onBrainFreezeScore}
        onStopGame={() => onBrainFreezeToggle?.(false)}
        onStopPlunge={onStop}
        onCountdownUpdate={(secs) => { setNextQuestionIn(secs); onBrainFreezeCountdown?.(secs); }}
        onBrainFreezeStats={onBrainFreezeStats}
      />
    </div>
  );
}
