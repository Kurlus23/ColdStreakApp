import { useRef } from "react";
import { ColdTakeOverlay, MilestoneEvent } from "@/components/ColdTakeOverlay";
import { BenefitBar } from "@/components/BenefitBar";
import { MusicTransportMini } from "@/components/MusicWidget";
import { SEGMENTS, type SegmentId, computeThresholds } from "@/lib/benefitSegments";

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

interface RingProps {
  /** 0–1 fill of the arc */
  progress: number;
  /** Label shown at the target marker (12 o'clock). Null = no marker (decorative ring). */
  targetLabel: string | null;
  /** When set, overrides the cyan gradient with a solid segment colour */
  accentColor?: string;
}

function ChallengeRing({ progress, targetLabel, accentColor }: RingProps) {
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
  displayScore: number;
  temperature: number;
  tempDisplay: string;
  personalBest: number;
  challengerScore: number | null;
  challengerName: string | null;
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
}

// ─── Component ────────────────────────────────────────────────────────────────
export function PlungeOverlay({
  displaySeconds,
  formattedTime,
  displayScore,
  temperature,
  tempDisplay,
  personalBest,
  challengerScore,
  challengerName,
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
}: PlungeOverlayProps) {
  // ── Benefit-goal ring ─────────────────────────────────────────────────────────
  // Tracks dynamically with live temperature, but once a segment threshold is
  // crossed it stays earned — temperature drift can't retreat a goal you hit.
  const earnedSegmentsRef = useRef(new Set<number>());

  const benefitThresholds = computeThresholds(temperature, bodyWeightLbs, bodyHeightCm, bodyFatPct);
  const totalBenefitElapsed = benefitCarryOver + elapsedSeconds;
  const primarySegIdx = primaryBenefit
    ? SEGMENTS.findIndex(s => s.id === primaryBenefit)
    : -1;

  // Permanently mark any segment whose threshold has been crossed this session.
  if (primarySegIdx >= 0) {
    for (let i = 0; i <= primarySegIdx; i++) {
      if (totalBenefitElapsed >= benefitThresholds[i]) earnedSegmentsRef.current.add(i);
    }
  }

  // Which segment are we currently accumulating toward? Skip already-earned ones.
  let benefitSegIdx = -1;
  if (primarySegIdx >= 0) {
    for (let i = 0; i <= primarySegIdx; i++) {
      if (!earnedSegmentsRef.current.has(i) && totalBenefitElapsed < benefitThresholds[i]) {
        benefitSegIdx = i; break;
      }
    }
  }

  // Benefit ring always takes priority when there's an active goal in progress.
  // Challenge context is shown via score boxes overlaid on the ring, not by
  // replacing the ring with a challenge arc.
  const useBenefitRing = isActive && benefitSegIdx >= 0;
  const currentBenefitSeg = useBenefitRing ? SEGMENTS[benefitSegIdx] : null;

  const benefitRingProgress = useBenefitRing && currentBenefitSeg ? (() => {
    const start = benefitSegIdx === 0 ? 0 : benefitThresholds[benefitSegIdx - 1];
    const end   = benefitThresholds[benefitSegIdx];
    return Math.max(0, Math.min(1, (totalBenefitElapsed - start) / (end - start)));
  })() : 0;

  // Session time (seconds elapsed in *this* session) when milestone will be hit
  const benefitTargetSessionSecs = useBenefitRing
    ? Math.max(0, benefitThresholds[benefitSegIdx] - benefitCarryOver)
    : 0;
  const benefitTargetLabel = useBenefitRing && currentBenefitSeg
    ? `${currentBenefitSeg.emoji} ${fmtSecs(benefitTargetSessionSecs)}`
    : null;

  // ── Score / challenge ring (fallback when benefit goal already met or challenge mode) ──
  const ringTarget = challengerScore ?? (personalBest > 0 ? personalBest : null);
  const ringProgress = ringTarget && displayScore > 0
    ? Math.min(1, displayScore / ringTarget)
    : 0;

  // ── Challenge score-box context ───────────────────────────────────────────────
  const shortName = challengerName?.split(" ")[0] ?? "them";
  // Ring 12-o'clock marker always shows PB (challenge shown via score boxes instead)
  const targetLabel = personalBest > 0 ? `PB ${personalBest.toFixed(1)}` : null;

  const winning = challengerScore !== null && displayScore >= challengerScore;

  const statusLabel = challengerName
    ? challengerScore === null
      ? null                              // boxes show "—" while score loads
      : winning
        ? `You beat ${shortName}! ❄️`
        : `${(challengerScore - displayScore).toFixed(1)} pts to beat ${shortName}`
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
        <ChallengeRing
          progress={useBenefitRing ? benefitRingProgress : ringProgress}
          targetLabel={useBenefitRing ? benefitTargetLabel : targetLabel}
          accentColor={useBenefitRing ? currentBenefitSeg?.barColor : undefined}
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
                background: winning ? "rgba(34,211,238,0.15)" : "rgba(251,113,133,0.15)",
                border: winning ? "1px solid rgba(34,211,238,0.4)" : "1px solid rgba(251,113,133,0.4)",
                color: winning ? "#67e8f9" : "#fda4af",
              }}
            >
              {statusLabel}
            </div>
          )}

          {/* Dismiss challenger button */}
          {challengerName && (
            <button
              onClick={onDismissChallenger}
              className="mt-1 text-slate-500 hover:text-slate-300 text-[10px] leading-none"
              title="Dismiss challenge"
            >
              ✕ dismiss
            </button>
          )}
        </div>

        {/* ── Challenge score boxes — You vs Opponent ── */}
        {challengerName && (
          <div className="absolute bottom-4 left-0 right-0 flex items-end justify-between px-8 pointer-events-none">
            {/* You */}
            <div
              className="flex flex-col items-center rounded-2xl px-4 py-2 min-w-[72px]"
              style={{
                background: winning ? "rgba(34,211,238,0.12)" : "rgba(7,26,50,0.75)",
                border: winning ? "1px solid rgba(34,211,238,0.45)" : "1px solid rgba(30,58,95,0.7)",
                backdropFilter: "blur(6px)",
                boxShadow: winning ? "0 0 16px rgba(34,211,238,0.18)" : "none",
              }}
            >
              <span className="text-[9px] uppercase tracking-widest font-semibold text-blue-400 mb-0.5">You</span>
              <span
                className="text-xl font-bold tabular-nums leading-none"
                style={{ color: winning ? "#67e8f9" : "#e2e8f0" }}
              >
                {displayScore > 0 ? displayScore.toFixed(1) : "—"}
              </span>
            </div>

            <span className="text-blue-700/60 text-xs font-bold self-center pb-1">vs</span>

            {/* Opponent */}
            <div
              className="flex flex-col items-center rounded-2xl px-4 py-2 min-w-[72px]"
              style={{
                background: !winning && challengerScore !== null ? "rgba(251,113,133,0.10)" : "rgba(7,26,50,0.75)",
                border: !winning && challengerScore !== null ? "1px solid rgba(251,113,133,0.35)" : "1px solid rgba(30,58,95,0.7)",
                backdropFilter: "blur(6px)",
                boxShadow: !winning && challengerScore !== null ? "0 0 16px rgba(251,113,133,0.12)" : "none",
              }}
            >
              <span className="text-[9px] uppercase tracking-widest font-semibold text-blue-400 mb-0.5 truncate max-w-[64px]">{shortName}</span>
              <span
                className="text-xl font-bold tabular-nums leading-none"
                style={{ color: !winning && challengerScore !== null ? "#fda4af" : "#94a3b8" }}
              >
                {challengerScore !== null ? challengerScore.toFixed(1) : "—"}
              </span>
            </div>
          </div>
        )}
      </div>

      {/* Cold Take */}
      <div className="w-full px-5 pb-3 z-10 shrink-0">
        <ColdTakeOverlay
          isActive={isActive}
          elapsedSeconds={displaySeconds}
          tempF={temperature}
          isFirstPlunge={plungesCount === 0}
          streakDays={streak}
          milestoneEvent={milestoneEvent}
        />
      </div>

      {/* Bottom HUD — no unified panel; each row floats independently */}
      <div className="w-full z-10 shrink-0 px-6 pb-10 flex flex-col gap-4">

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

        {/* Music transport — its own floating card */}
        {isPro && <MusicTransportMini className="self-center" />}

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
    </div>
  );
}
