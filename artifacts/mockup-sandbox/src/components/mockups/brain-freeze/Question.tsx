import { useState } from "react";

const answers = [
  { letter: "A", text: "Elephant" },
  { letter: "B", text: "Giraffe" },
  { letter: "C", text: "Blue Whale" },
  { letter: "D", text: "Polar Bear" },
];

export function Question() {
  const [selected, setSelected] = useState<string | null>(null);

  return (
    <div
      className="w-[390px] h-[844px] overflow-hidden relative flex items-center justify-center"
      style={{
        color: "#e2e8f0",
        fontFamily: '"Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif',
        background: "linear-gradient(155deg, #0c2a42 0%, #071a2e 48%, #040f1e 100%)",
      }}
    >
      <div className="absolute inset-0" style={{ opacity: 0.3, filter: "blur(3px)", transform: "scale(1.025)" }}>
        <div className="flex h-full flex-col items-center px-6 pt-8">
          <div className="text-[15px] font-bold tracking-[0.34em]" style={{ color: "#e2e8f0" }}>COLDSTREAK</div>
          <div className="mt-12 flex h-[280px] w-[280px] items-center justify-center rounded-full border-[8px]" style={{ borderColor: "#22d3ee", boxShadow: "inset 0 0 0 10px rgba(34,211,238,.16)" }}>
            <div className="text-center">
              <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#94a3b8" }}>Remaining</p>
              <p className="mt-2 text-[52px] font-semibold tracking-[-0.08em]">01:42</p>
            </div>
          </div>
          <div className="mt-auto mb-8 w-full">
            <div className="mx-auto mb-4 flex w-fit items-center gap-5 rounded-full border px-5 py-2 text-[12px] font-semibold" style={{ background: "rgba(6,182,212,.07)", borderColor: "rgba(34,211,238,.32)" }}>
              <span>39°F</span><span style={{ color: "#22d3ee" }}>COLD SCORE 4.2</span>
            </div>
            <div className="rounded-2xl border px-4 py-3" style={{ background: "rgba(6,182,212,.07)", borderColor: "rgba(34,211,238,.25)" }}>
              <div className="mb-2 flex justify-between text-[11px]"><span>Benefit streak</span><span style={{ color: "#22d3ee" }}>72%</span></div>
              <div className="h-2 rounded-full" style={{ background: "#1e3a5f" }}><div className="h-full w-[72%] rounded-full" style={{ background: "#22d3ee" }} /></div>
            </div>
            <button type="button" className="mt-4 h-12 w-full rounded-xl border text-[12px] font-bold tracking-[0.18em]" style={{ color: "#fca5a5", borderColor: "rgba(248,113,113,.45)", background: "rgba(127,29,29,.3)" }}>STOP PLUNGE</button>
          </div>
        </div>
      </div>
      <div className="absolute inset-0" style={{ background: "rgba(0,0,0,.5)" }} />

      <section
        className="relative z-10 w-[360px] overflow-hidden rounded-[20px] border"
        style={{ background: "#0f1f3d", borderColor: "rgba(34,211,238,.4)", boxShadow: "0 0 40px rgba(34,211,238,.15)" }}
        aria-label="Brain Freeze question"
      >
        <div className="h-2 w-full" style={{ background: "#273956" }}>
          <div className="h-full w-[45%] rounded-r-full" style={{ background: "#f59e0b" }} />
        </div>
        {/* No large number at 8s — bar alone carries urgency. Shows at 5, 3, 1 only. */}
        <div className="flex items-center justify-between px-5 py-3">
          <span className="text-[12px] font-semibold tracking-[0.04em]" style={{ color: "#22d3ee" }}>🧠 BRAIN FREEZE · Q4</span>
          <span className="flex items-center gap-2 text-[12px]">🔥🔥🔥 <span className="rounded-full px-2 py-1 text-[10px] font-bold" style={{ color: "#fbbf24", background: "rgba(245,158,11,.16)" }}>×2.0</span></span>
        </div>
        <div className="h-px w-full" style={{ background: "rgba(34,211,238,.5)" }} />
        <h1 className="px-5 pt-4 pb-3 text-center text-[20px] font-bold leading-[1.4]">Which animal has the highest blood pressure?</h1>
        <div className="flex flex-col gap-3 px-4" aria-label="Answers">
          {answers.map((answer) => (
            <button
              key={answer.letter}
              type="button"
              className="flex h-[72px] w-full items-center gap-3 rounded-xl border px-4 text-left transition-transform active:scale-[0.985]"
              style={{ background: selected === answer.letter ? "rgba(34,211,238,.2)" : "rgba(30,58,95,.8)", borderColor: selected === answer.letter ? "#22d3ee" : "rgba(34,211,238,.2)" }}
              onClick={() => setSelected(answer.letter)}
              aria-label={`${answer.letter}: ${answer.text}`}
            >
              <span className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border text-[14px] font-bold" style={{ borderColor: "#22d3ee", color: "#e2e8f0" }}>{answer.letter}</span>
              <span className="text-[16px] font-medium">{answer.text}</span>
            </button>
          ))}
        </div>
        {/* Dynamic score drain — shows potential points decreasing with time */}
        <div className="px-5 pt-2 pb-4 flex flex-col items-center gap-1.5">
          <p className="text-[10px] uppercase tracking-wider" style={{ color: "#64748b" }}>⚡ Answer quickly for more points</p>
          <div className="flex items-center gap-2">
            {/* Past tier — dimmed */}
            <span className="text-[13px] font-semibold line-through" style={{ color: "#334155" }}>125</span>
            <span style={{ color: "#334155", fontSize: 10 }}>›</span>
            {/* Current tier — live, orange glow */}
            <span
              className="text-[22px] font-extrabold tabular-nums"
              style={{ color: "#f97316", textShadow: "0 0 14px rgba(249,115,22,0.6)" }}
            >
              108
            </span>
            <span style={{ color: "#475569", fontSize: 10 }}>›</span>
            {/* Next tier — dim */}
            <span className="text-[13px] font-semibold" style={{ color: "#334155" }}>75</span>
          </div>
        </div>
      </section>
    </div>
  );
}