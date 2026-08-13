import { useMemo } from "react";
import { Trophy, Share2, RotateCcw, X } from "lucide-react";
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

const WIN_LINES: { headline: string; sub: (name: string, diff: string) => string }[] = [
  { headline: "You iced 'em. 🧊",         sub: (n, d) => `${d} points colder than ${n}` },
  { headline: "Ice in your veins. ❄️",    sub: (n, d) => `${n} never stood a chance (+${d})` },
  { headline: "Cold-blooded. 🏆",         sub: (n, d) => `Beat ${n} by ${d} points` },
  { headline: "They melted. You didn't. 🧊", sub: (n, d) => `${n} couldn't keep up — +${d} pts` },
  { headline: "Certified frost boss. ❄️", sub: (n, d) => `${d} points ahead of ${n}` },
  { headline: "Too cold for them. ✓",     sub: (n, d) => `${n} tapped out ${d} points short` },
  { headline: "They blinked. You didn't. ❄️", sub: (n, d) => `Edged ${n} by ${d} points` },
  { headline: "Unbothered. 🧊",           sub: (n, d) => `${n} gave it a shot. +${d} pts` },
  { headline: "Not even close. 🥇",       sub: (n, d) => `Crushed ${n} by ${d} points` },
  { headline: "Your blood runs colder. 🏆", sub: (n, d) => `${d} points over ${n}` },
];

const LOSE_LINES: { headline: string; sub: (name: string, diff: string) => string }[] = [
  { headline: "They out-froze you. 🥶",        sub: (n, d) => `${n} had ${d} points on you` },
  { headline: "Cold, but not cold enough. ❄️", sub: (n, d) => `${n} edged you by ${d} points` },
  { headline: "The cold humbles. 🥶",          sub: (n, d) => `${d} points behind ${n}` },
  { headline: "Their blood runs colder. 🧊",   sub: (n, d) => `${n} beat you by ${d} points` },
  { headline: "You melted. 🥶",               sub: (n, d) => `${n} held ${d} points on you` },
  { headline: "They didn't blink. You did. 😤", sub: (n, d) => `${d} points short of ${n}` },
  { headline: "Second place in an ice bath. 🥶", sub: (n, d) => `${n} had ${d} pts to spare` },
  { headline: "You got iced. 🧊",             sub: (n, d) => `${n} beat you by ${d} points` },
  { headline: "Colder days ahead. ❄️",        sub: (n, d) => `${n} is up ${d} points on you` },
  { headline: "Hypothermia: earned. Win: not yet. 🥶", sub: (n, d) => `${d} points behind ${n}` },
];

const WIN_REMATCH = [
  (n: string) => `Challenge ${n} again ❄️`,
  (n: string) => `Make it one ${n} can't refuse ❄️`,
  (n: string) => `Keep the pressure on ${n} 🧊`,
];

const LOSE_REMATCH = [
  (n: string) => `Challenge ${n} back ❄️`,
  (n: string) => `Freeze harder next time 🥶`,
  (n: string) => `Rematch — no excuses 🧊`,
  (n: string) => `Dive back in ❄️`,
];

const LOSE_DISMISS = [
  "Warm up and try again 🔥",
  "Accept defeat… for now",
  "Regroup and refreeze",
  "Fine. Fine. Fine. 🥶",
];

// Seed a stable pick from the scores so it doesn't flicker on re-render
function pick<T>(arr: T[], seed: number): T {
  return arr[Math.abs(Math.round(seed)) % arr.length];
}

export function ChallengeResultCard({ result, onDismiss, onChallengeBack }: Props) {
  const { toast } = useToast();
  const [challenging, setChallenging] = useState(false);

  const { won, myScore, theirScore, opponentName } = result;
  const firstName = opponentName.split(" ")[0];
  const diff = Math.abs(myScore - theirScore).toFixed(1);
  const seed = myScore + theirScore * 7;

  const line      = useMemo(() => pick(won ? WIN_LINES  : LOSE_LINES,  seed),        [won, seed]);
  const rematch   = useMemo(() => pick(won ? WIN_REMATCH : LOSE_REMATCH, seed + 3),  [won, seed]);
  const dismissTx = useMemo(() => pick(LOSE_DISMISS, seed + 11),                     [seed]);

  const handleShare = async () => {
    const text = `🏆 Just beat ${opponentName}'s cold plunge score on ColdStreak!\n❄️ My score: ${myScore.toFixed(1)} vs their ${theirScore.toFixed(1)}\n\nThink you can handle the cold? coldstreakapp.com`;
    try {
      if (navigator.share) {
        await navigator.share({ text });
      } else {
        await navigator.clipboard.writeText(text);
        toast({ title: "Brag copied! 🏆", description: "Paste it anywhere to show off." });
      }
    } catch { /* user cancelled */ }
  };

  const handleChallengeBack = async () => {
    setChallenging(true);
    try {
      onChallengeBack(result.opponentId);
      toast({ title: `Challenge sent to ${firstName}! ❄️`, description: "They'll get a notification." });
      onDismiss();
    } finally {
      setChallenging(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[65] flex flex-col items-center justify-center px-6"
      style={{ background: "rgba(4,15,30,0.96)", backdropFilter: "blur(20px)" }}
    >
      {/* Ambient glow */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] rounded-full"
          style={{
            background: won
              ? "radial-gradient(circle, rgba(234,179,8,0.18) 0%, transparent 65%)"
              : "radial-gradient(circle, rgba(6,182,212,0.15) 0%, transparent 65%)",
          }}
        />
      </div>

      {/* Dismiss X */}
      <button
        onClick={onDismiss}
        className="absolute top-14 right-6 text-slate-500 hover:text-slate-300 transition-colors"
        aria-label="Close"
      >
        <X className="w-5 h-5" />
      </button>

      {/* Hero — YOU vs OPPONENT */}
      <div className="flex items-center gap-4 mb-6">
        <div className="flex flex-col items-center gap-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black"
            style={{
              background: won ? "rgba(234,179,8,0.18)" : "rgba(6,182,212,0.15)",
              border:     won ? "1px solid rgba(234,179,8,0.4)" : "1px solid rgba(6,182,212,0.3)",
              boxShadow:  won ? "0 0 24px rgba(234,179,8,0.25)" : "0 0 24px rgba(6,182,212,0.2)",
              color:      won ? "#fbbf24" : "#22d3ee",
            }}
          >
            {won ? "🏆" : "😤"}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">You</span>
        </div>

        <span className="text-slate-600 font-black text-2xl leading-none">vs</span>

        <div className="flex flex-col items-center gap-2">
          <div
            className="w-16 h-16 rounded-2xl flex items-center justify-center text-2xl font-black"
            style={{
              background: won ? "rgba(6,182,212,0.12)" : "rgba(234,179,8,0.18)",
              border:     won ? "1px solid rgba(6,182,212,0.25)" : "1px solid rgba(234,179,8,0.4)",
              boxShadow:  won ? "0 0 24px rgba(6,182,212,0.15)" : "0 0 24px rgba(234,179,8,0.25)",
              color:      won ? "#22d3ee" : "#fbbf24",
            }}
          >
            {won ? "🥶" : "🏆"}
          </div>
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-400">{firstName}</span>
        </div>
      </div>

      {/* Headline */}
      <h1
        className="text-3xl font-black text-center mb-1 tracking-tight"
        style={{
          background: won
            ? "linear-gradient(to bottom, #fde68a, #f59e0b)"
            : "linear-gradient(to bottom, #ffffff, #67e8f9)",
          WebkitBackgroundClip: "text",
          WebkitTextFillColor: "transparent",
          backgroundClip: "text",
        }}
      >
        {line.headline}
      </h1>
      <p className="text-slate-400 text-sm text-center mb-8">
        {line.sub(firstName, diff)}
      </p>

      {/* Score comparison */}
      <div
        className="w-full max-w-xs rounded-2xl p-5 mb-8 flex items-center justify-around"
        style={{ background: "rgba(14,30,54,0.8)", border: "1px solid rgba(34,211,238,0.15)" }}
      >
        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">You</span>
          <span
            className="text-4xl font-black"
            style={{
              color:  won ? "#fbbf24" : "#22d3ee",
              filter: won ? "drop-shadow(0 0 12px rgba(251,191,36,0.6))" : "drop-shadow(0 0 12px rgba(34,211,238,0.5))",
            }}
          >
            {myScore.toFixed(1)}
          </span>
        </div>

        <span className="text-slate-600 font-bold text-xl">vs</span>

        <div className="flex flex-col items-center gap-1">
          <span className="text-[10px] font-bold uppercase tracking-widest text-slate-500">{firstName}</span>
          <span
            className="text-4xl font-black"
            style={{
              color:  won ? "#22d3ee" : "#fbbf24",
              filter: won ? "drop-shadow(0 0 12px rgba(34,211,238,0.4))" : "drop-shadow(0 0 12px rgba(251,191,36,0.6))",
            }}
          >
            {theirScore.toFixed(1)}
          </span>
        </div>
      </div>

      {/* Actions */}
      <div className="w-full max-w-xs flex flex-col gap-3">
        {won ? (
          <>
            <button
              onClick={handleShare}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all active:scale-95"
              style={{
                background: "linear-gradient(135deg, #d97706, #f59e0b)",
                color: "#1c1008",
                boxShadow: "0 0 24px rgba(245,158,11,0.4)",
              }}
            >
              <Share2 className="w-4 h-4" /> Share your brag 🏆
            </button>
            <button
              onClick={handleChallengeBack}
              disabled={challenging}
              className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide text-cyan-300 border border-cyan-500/30 hover:bg-cyan-500/10 transition-all active:scale-95 disabled:opacity-50"
            >
              {challenging ? "Sending…" : rematch(firstName)}
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-2.5 text-slate-500 text-sm hover:text-slate-300 transition-colors"
            >
              Continue
            </button>
          </>
        ) : (
          <>
            <button
              onClick={handleChallengeBack}
              disabled={challenging}
              className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm tracking-wide transition-all active:scale-95 disabled:opacity-50"
              style={{
                background: "linear-gradient(135deg, #0e7490, #22d3ee)",
                color: "#001a2e",
                boxShadow: "0 0 24px rgba(34,211,238,0.35)",
              }}
            >
              <RotateCcw className="w-4 h-4" /> {challenging ? "Sending…" : rematch(firstName)}
            </button>
            <button
              onClick={onDismiss}
              className="w-full py-3.5 rounded-2xl font-bold text-sm tracking-wide text-slate-400 border border-slate-700/40 hover:bg-slate-800/40 transition-all active:scale-95"
            >
              {dismissTx}
            </button>
          </>
        )}
      </div>
    </div>
  );
}
