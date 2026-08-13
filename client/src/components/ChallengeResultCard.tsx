import { useMemo } from "react";
import { X } from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { useState } from "react";

export interface ChallengeResult {
  won: boolean;
  myScore: number;
  theirScore: number;
  opponentName: string;
  opponentId: number;
}

interface Props {
  result: ChallengeResult;
  onDismiss: () => void;
  onChallengeBack: (userId: number) => void;
}

// Trash-talk cold takes shown on the winner's card
const WIN_COLD_TAKES: ((n: string) => string)[] = [
  n => `Still thawing out, ${n}? ❄️`,
  n => `The ice chose me today, ${n}.`,
  n => `${n} thought they had me. The cold had other plans.`,
  n => `Sorry ${n}, not sorry. 🏆`,
  n => `Next time dress warmer, ${n}. 🧊`,
  n => `The plunge doesn't lie, ${n}.`,
  n => `Case closed, ${n}. ❄️`,
  n => `Maybe stick to warm showers, ${n}. 🚿`,
  n => `Ice doesn't negotiate, ${n}. Neither do I.`,
  n => `${n} came. ${n} saw. ${n} melted. 🧊`,
  n => `You trained for this, ${n}? 😤`,
  n => `Not even close, ${n}. ❄️`,
  n => `${n}: 0. Cold: 1. Me: 1. 🏆`,
  n => `The gap says it all, ${n}.`,
  n => `Unbothered. Moisturized. Winning. — Not you, ${n}. ❄️`,
];

// Motivating cold takes shown on the loser's card
const LOSE_COLD_TAKES: ((n: string) => string)[] = [
  _n => `The cold doesn't care. Get back in.`,
  n  => `${n} got you today. The ice remembers who shows up.`,
  _n => `Close. The cold builds character.`,
  _n => `Not this time. The water doesn't forget you.`,
  n  => `${n} was colder today. Tomorrow's yours.`,
  _n => `The plunge doesn't lie. Show up again.`,
  _n => `You stayed in. That's still a win. ❄️`,
  n  => `Chase ${n} down next time. ❄️`,
];

// Seed a stable pick from the scores so it doesn't flicker on re-render
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.round(seed)) % arr.length];
}

function ScoreCircle({
  score,
  label,
  filled,
}: {
  score: number;
  label: string;
  filled: boolean;
}) {
  return (
    <div
      style={{
        width: 140,
        height: 140,
        borderRadius: "50%",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: 2,
        background: filled ? "#fbbf24" : "transparent",
        border: filled ? "none" : "2px solid #1e3a5f",
        boxShadow: filled ? "0 0 40px rgba(251,191,36,.3)" : "none",
        flexShrink: 0,
      }}
    >
      <span
        style={{
          fontSize: 42,
          fontWeight: 900,
          lineHeight: 1,
          letterSpacing: "-0.02em",
          color: filled ? "#1a0a00" : "#475569",
        }}
      >
        {score.toFixed(1)}
      </span>
      <span
        style={{
          fontSize: 10,
          fontWeight: 700,
          textTransform: "uppercase",
          letterSpacing: "0.1em",
          color: filled ? "rgba(26,10,0,0.6)" : "#64748b",
        }}
      >
        {label}
      </span>
    </div>
  );
}

export function ChallengeResultCard({ result, onDismiss, onChallengeBack }: Props) {
  const { toast } = useToast();
  const [challenging, setChallenging] = useState(false);

  const { won, myScore, theirScore, opponentName } = result;
  const firstName = opponentName.split(" ")[0];
  const diff = Math.abs(myScore - theirScore).toFixed(1);
  const seed = myScore + theirScore * 7;

  const coldTake = useMemo(
    () =>
      won
        ? pick(WIN_COLD_TAKES, seed + 17)(firstName)
        : pick(LOSE_COLD_TAKES, seed + 17)(firstName),
    [won, seed, firstName],
  );

  const handleShare = async () => {
    const brag = won
      ? `🏆 Just beat ${opponentName} on ColdStreak!\n${coldTake}\n❄️ ${myScore.toFixed(1)} vs ${theirScore.toFixed(1)}\n\ncoldstreakapp.com`
      : `🧊 Just took on ${opponentName} on ColdStreak!\n❄️ ${myScore.toFixed(1)} vs ${theirScore.toFixed(1)}\n\ncoldstreakapp.com`;
    try {
      if (navigator.share) {
        await navigator.share({ text: brag });
      } else {
        await navigator.clipboard.writeText(brag);
        toast({
          title: won ? "Brag copied! 🏆" : "Score copied! ❄️",
          description: "Paste it anywhere.",
        });
      }
    } catch {
      /* user cancelled */
    }
  };

  const handleChallengeBack = async () => {
    setChallenging(true);
    try {
      onChallengeBack(result.opponentId);
      toast({
        title: `Challenge sent to ${firstName}! ❄️`,
        description: "They'll get a notification.",
      });
    } finally {
      setChallenging(false);
    }
  };

  // Accent colour: gold for win, cyan for lose
  const accent = won ? "#fbbf24" : "#22d3ee";
  const accentGlow = won
    ? "rgba(251,191,36,0.15)"
    : "rgba(34,211,238,0.12)";

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col items-center justify-between overflow-hidden"
      style={{ background: "#040f1e", padding: "52px 24px 44px" }}
    >
      {/* Ambient glow */}
      <div
        className="absolute pointer-events-none"
        style={{
          top: -60,
          left: "50%",
          transform: "translateX(-50%)",
          width: 360,
          height: 260,
          borderRadius: "50%",
          background: `radial-gradient(circle, ${accentGlow} 0%, transparent 65%)`,
        }}
      />

      {/* Dismiss X */}
      <button
        onClick={onDismiss}
        className="absolute top-5 right-5 text-slate-700 hover:text-slate-400 transition-colors z-10"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* ── Avatars ── */}
      <div className="flex items-center gap-5 z-10">
        {/* You */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="flex items-center justify-center rounded-[20px] text-[38px]"
            style={{
              width: 80,
              height: 80,
              background: won ? "rgba(251,191,36,0.15)" : "rgba(6,182,212,0.08)",
              border: `1.5px solid ${won ? "rgba(251,191,36,0.5)" : "rgba(6,182,212,0.2)"}`,
              boxShadow: won ? "0 0 20px rgba(251,191,36,0.2)" : "none",
            }}
          >
            {won ? "🏆" : "🥶"}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
            You
          </span>
        </div>

        <span className="text-slate-700 font-black text-xl pb-5">VS</span>

        {/* Opponent */}
        <div className="flex flex-col items-center gap-1.5">
          <div
            className="flex items-center justify-center rounded-[20px] text-[38px]"
            style={{
              width: 80,
              height: 80,
              background: won ? "rgba(6,182,212,0.08)" : "rgba(251,191,36,0.15)",
              border: `1.5px solid ${won ? "rgba(6,182,212,0.2)" : "rgba(251,191,36,0.5)"}`,
              boxShadow: won ? "none" : "0 0 20px rgba(251,191,36,0.2)",
            }}
          >
            {won ? "🥶" : "🏆"}
          </div>
          <span className="text-[9px] font-bold uppercase tracking-[0.14em] text-slate-500">
            {firstName}
          </span>
        </div>
      </div>

      {/* ── Headline ── */}
      <div className="text-center z-10">
        <div
          className="font-black uppercase leading-none"
          style={{
            fontSize: 52,
            letterSpacing: "-0.03em",
            color: accent,
            filter: `drop-shadow(0 0 24px ${accentGlow})`,
          }}
        >
          Challenge
        </div>
        <div
          className="font-black uppercase leading-none"
          style={{ fontSize: 52, letterSpacing: "-0.03em", color: "#f8fafc" }}
        >
          {won ? "Won" : "Lost"}
        </div>
        <p className="text-sm text-slate-400 mt-2.5">
          {won ? (
            <>
              You won by{" "}
              <strong style={{ color: accent, fontWeight: 800 }}>+{diff} pts</strong>{" "}
              ❄️
            </>
          ) : (
            <>
              {firstName} beat you by{" "}
              <strong style={{ color: accent, fontWeight: 800 }}>-{diff} pts</strong>{" "}
              ❄️
            </>
          )}
        </p>
      </div>

      {/* ── Score circles ── */}
      <div className="flex items-center justify-center gap-5 z-10">
        {won ? (
          <>
            <ScoreCircle score={myScore}    label="Your score" filled={true}  />
            <ScoreCircle score={theirScore} label={firstName}  filled={false} />
          </>
        ) : (
          <>
            <ScoreCircle score={myScore}    label="Your score" filled={false} />
            <ScoreCircle score={theirScore} label={firstName}  filled={true}  />
          </>
        )}
      </div>

      {/* ── Cold take quote ── */}
      <div
        className="w-full max-w-xs z-10"
        style={{ borderLeft: `2px solid ${won ? "rgba(251,191,36,0.35)" : "rgba(34,211,238,0.3)"}`, paddingLeft: 14 }}
      >
        <p
          className="leading-relaxed"
          style={{ fontSize: 17, fontStyle: "italic", color: "#94a3b8", fontWeight: 400 }}
        >
          "{won ? coldTake : pick(LOSE_COLD_TAKES, seed + 17)(firstName)}"
        </p>
        <p
          className="mt-1 font-bold uppercase"
          style={{ fontSize: 10, letterSpacing: "0.06em", color: "#94a3b8", opacity: 0.6 }}
        >
          ColdStreak ❄
        </p>
      </div>

      {/* ── CTAs ── */}
      <div className="w-full max-w-xs flex flex-col gap-2.5 z-10">
        {won ? (
          <>
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 rounded-[14px] font-extrabold text-sm tracking-wide transition-all active:scale-95"
              style={{
                padding: 16,
                background: "#fbbf24",
                color: "#1a0a00",
                boxShadow: "0 0 32px rgba(251,191,36,.3)",
              }}
            >
              ↑ Share your brag 🏆
            </button>
            <button
              onClick={onDismiss}
              className="w-full text-sm transition-colors"
              style={{ padding: 10, background: "none", border: "none", color: "#94a3b8" }}
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleChallengeBack}
              disabled={challenging}
              className="w-full flex items-center justify-center gap-2 rounded-[14px] font-extrabold text-sm tracking-wide transition-all active:scale-95 disabled:opacity-50"
              style={{
                padding: 16,
                background: "#22d3ee",
                color: "#040f1e",
                boxShadow: "0 0 32px rgba(34,211,238,.3)",
              }}
            >
              ❄ {challenging ? "Sending…" : `Challenge ${firstName} again`}
            </button>
            <button
              onClick={onDismiss}
              className="w-full text-sm transition-colors"
              style={{ padding: 10, background: "none", border: "none", color: "#94a3b8" }}
            >
              Continue
            </button>
          </>
        )}
      </div>
    </div>
  );
}
