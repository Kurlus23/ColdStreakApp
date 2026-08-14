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
      className="w-[390px] h-[844px] overflow-hidden relative"
      style={{
        backgroundColor: "#071428",
        color: "#e2e8f0",
        fontFamily:
          '"Avenir Next", Avenir, ui-sans-serif, system-ui, sans-serif',
      }}
    >
      {/* The timer stays present underneath the question: it is the visual context,
          not a second screen. */}
      <div
        className="absolute inset-0"
        style={{
          opacity: 0.35,
          filter: "blur(4px)",
          transform: "scale(1.025)",
        }}
      >
        <div className="flex h-full flex-col px-6 pt-7">
          <div className="flex items-start justify-between">
            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#94a3b8" }}>
                Water temp
              </p>
              <p className="mt-1 text-[29px] font-bold tracking-[-0.06em]">39°F</p>
            </div>
            <div className="text-right">
              <p className="text-[11px] font-semibold uppercase tracking-[0.18em]" style={{ color: "#94a3b8" }}>
                Cold score
              </p>
              <p className="mt-1 text-[25px] font-bold tracking-[-0.04em]">4.2 <span style={{ color: "#22d3ee" }}>❄</span></p>
            </div>
          </div>
          <div className="flex flex-1 items-center justify-center">
            <div className="relative flex h-[244px] w-[244px] items-center justify-center rounded-full border-[8px]" style={{ borderColor: "#22d3ee", boxShadow: "inset 0 0 0 9px #112d4d" }}>
              <div className="text-center">
                <p className="text-[11px] font-semibold uppercase tracking-[0.22em]" style={{ color: "#94a3b8" }}>Remaining</p>
                <p className="mt-2 text-[47px] font-semibold tracking-[-0.08em]">01:42</p>
              </div>
            </div>
          </div>
          <div className="mb-[70px] rounded-2xl border px-4 py-4" style={{ backgroundColor: "#0f1f3d", borderColor: "rgba(34,211,238,.25)" }}>
            <div className="mb-3 flex justify-between text-[12px] font-semibold"><span>Energy</span><span style={{ color: "#22d3ee" }}>88%</span></div>
            <div className="h-2 rounded-full" style={{ backgroundColor: "#1e3a5f" }}><div className="h-full w-[88%] rounded-full" style={{ backgroundColor: "#22d3ee" }} /></div>
            <div className="mt-4 mb-2 flex justify-between text-[12px] font-semibold"><span>Mood</span><span style={{ color: "#22d3ee" }}>70%</span></div>
            <div className="h-2 rounded-full" style={{ backgroundColor: "#1e3a5f" }}><div className="h-full w-[70%] rounded-full" style={{ backgroundColor: "#22d3ee" }} /></div>
          </div>
        </div>
      </div>

      <section
        className="absolute inset-x-0 bottom-0 h-[78%] rounded-t-[24px] px-5 pt-0"
        style={{
          backgroundColor: "#0f1f3d",
          boxShadow: "0 -18px 45px rgba(2, 10, 25, .45)",
          backgroundImage: "linear-gradient(135deg, rgba(255,255,255,.025) 25%, transparent 25%, transparent 50%, rgba(255,255,255,.018) 50%, rgba(255,255,255,.018) 75%, transparent 75%)",
          backgroundSize: "7px 7px",
        }}
        aria-label="Brain Freeze question"
      >
        <div className="mt-[-1px] h-[6px] w-full overflow-hidden rounded-b-full" style={{ backgroundColor: "#273956" }}>
          <div className="h-full w-[55%] rounded-r-full" style={{ backgroundColor: "#f59e0b" }} />
        </div>
        <div className="mt-5 text-center text-[13px] font-bold tracking-[0.07em]" style={{ color: "#22d3ee" }}>
          🧠 BRAIN FREEZE <span style={{ color: "#55718f" }}>·</span> Q4 <span style={{ color: "#55718f" }}>·</span> 🔥🔥🔥
        </div>
        <h1 className="mx-auto mt-7 max-w-[340px] text-center text-[20px] font-bold leading-[1.3] tracking-[-0.025em]">
          Which animal has the highest blood pressure?
        </h1>
        <div className="mt-7 flex flex-col gap-3" aria-label="Answers">
          {answers.map((answer) => (
            <button
              key={answer.letter}
              type="button"
              className="flex h-[88px] w-full shrink-0 items-center gap-4 rounded-[13px] border px-4 text-left transition-transform active:scale-[0.985]"
              style={{
                backgroundColor: selected === answer.letter ? "#285078" : "#1e3a5f",
                borderColor: selected === answer.letter ? "#22d3ee" : "rgba(34,211,238,.55)",
              }}
              onClick={() => setSelected(answer.letter)}
              aria-label={`${answer.letter}: ${answer.text}`}
            >
              <span className="flex h-[32px] w-[32px] shrink-0 items-center justify-center rounded-full text-[14px] font-bold" style={{ backgroundColor: "#22d3ee", color: "#071428" }}>
                {answer.letter}
              </span>
              <span className="text-[18px] font-semibold">{answer.text}</span>
            </button>
          ))}
        </div>
        <p className="mt-5 text-center text-[12px] font-medium tracking-[0.01em]" style={{ color: "#94a3b8" }}>
          +100 pts <span style={{ color: "#526987" }}>·</span> ⚡ PERFECT for fast answer
        </p>
      </section>
    </div>
  );
}