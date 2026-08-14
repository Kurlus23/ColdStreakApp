import { ArrowRight, Check, ChevronRight, Snowflake, Sparkles } from "lucide-react";
import { useState } from "react";

export function Complete() {
  const [action, setAction] = useState<"idle" | "playing" | "done">("idle");

  return (
    <div
      className="w-[390px] h-[844px] overflow-hidden bg-[#071428] text-[#e2e8f0] font-sans"
      style={{ fontFamily: "ui-sans-serif, system-ui, sans-serif" }}
    >
      <div className="relative h-full px-5 pt-9 pb-5 flex flex-col">
        <div className="pointer-events-none absolute -top-24 -right-20 h-72 w-72 rounded-full bg-cyan-400/[0.07] blur-3xl" />
        <div className="pointer-events-none absolute bottom-20 -left-32 h-72 w-72 rounded-full bg-blue-500/[0.06] blur-3xl" />

        <header className="relative text-center">
          <div className="mb-2 inline-flex items-center gap-2 rounded-full border border-cyan-300/20 bg-cyan-300/[0.06] px-3 py-1 text-[10px] font-bold uppercase tracking-[0.22em] text-cyan-300">
            <Snowflake className="h-3 w-3" strokeWidth={2.5} />
            Brain Freeze
          </div>
          <h1 className="text-[31px] font-black uppercase leading-none tracking-[-0.04em] text-cyan-300">
            <span className="mr-2 text-[28px]">🧊</span>
            Plunge Complete
          </h1>
          <p className="mt-3 text-[13px] font-semibold tracking-wide text-[#94a3b8]">
            <span className="text-[#e2e8f0]">3:47</span> in the cold
            <span className="mx-2 text-cyan-500/60">·</span>
            <span className="text-[#e2e8f0]">39°F</span>
          </p>
        </header>

        <main className="relative mt-6 flex-1">
          <div className="mb-4 flex items-center justify-center">
            <div className="inline-flex items-center gap-2 rounded-lg border border-amber-300/40 bg-amber-400/10 px-4 py-2 text-[11px] font-black uppercase tracking-[0.16em] text-amber-300 shadow-[0_0_24px_rgba(251,191,36,0.14)]">
              <Sparkles className="h-4 w-4" />
              New High Score!
            </div>
          </div>

          <section className="relative overflow-hidden rounded-2xl border border-cyan-300/20 bg-[#1e3a5f] px-5 py-5 shadow-[0_18px_42px_rgba(1,13,32,0.35)]">
            <div className="absolute inset-x-0 top-0 h-px bg-cyan-200/40" />
            <div className="mb-4 flex items-center justify-between">
              <span className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-200/70">
                Score breakdown
              </span>
              <span className="text-[10px] font-bold uppercase tracking-wider text-[#94a3b8]">Frost tier</span>
            </div>

            <div className="space-y-3 text-[14px]">
              <div className="flex items-baseline justify-between">
                <span className="text-[#cbd5e1]">Trivia Score</span>
                <span className="font-mono font-bold text-[#e2e8f0]">1,200 <small className="font-sans text-[10px] text-[#94a3b8]">pts</small></span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[#cbd5e1]">× Cold Multiplier <small className="ml-1 text-[10px] text-cyan-200/65">(reached Metabolism)</small></span>
                <span className="font-mono font-bold text-cyan-200">×2.0</span>
              </div>
              <div className="flex items-baseline justify-between">
                <span className="text-[#cbd5e1]">× Streak Bonus <small className="ml-1 text-[10px] text-cyan-200/65">(21-day streak)</small></span>
                <span className="font-mono font-bold text-cyan-200">×1.6</span>
              </div>
            </div>

            <div className="my-4 border-t border-dashed border-cyan-100/20" />
            <div className="flex items-end justify-between">
              <span className="text-[11px] font-black uppercase tracking-[0.14em] text-cyan-100">Final score</span>
              <span className="font-mono text-[38px] font-black leading-none tracking-[-0.07em] text-[#e2e8f0]">
                3,840
              </span>
            </div>
          </section>

          <div className="mt-4 flex items-center justify-center gap-2 rounded-xl border border-slate-700/70 bg-[#102746] px-3 py-3 text-[11px] font-semibold text-[#94a3b8]">
            <span className="text-[#e2e8f0]">8 questions</span>
            <span className="text-cyan-400/60">·</span>
            <span className="text-[#e2e8f0]">6 correct (75%)</span>
            <span className="text-cyan-400/60">·</span>
            <span className="tracking-tight text-amber-300">🔥🔥🔥 streak</span>
          </div>

          <aside className="mt-4 rounded-xl border border-slate-600/50 bg-[#132d4d] px-4 py-3.5">
            <div className="mb-1 flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.17em] text-cyan-200/70">
              <Snowflake className="h-3.5 w-3.5 text-cyan-300" />
              Cold fact
            </div>
            <p className="text-[12px] leading-[1.45] text-[#b7c4d5]">
              Brown fat generates heat without shivering — you just learned that at <span className="font-bold text-[#e2e8f0]">39°F.</span>
            </p>
          </aside>
        </main>

        <footer className="relative mt-5 space-y-2.5">
          {action !== "idle" && (
            <div className="mb-1 flex items-center justify-center gap-2 text-[11px] font-bold text-cyan-300">
              <Check className="h-3.5 w-3.5" />
              {action === "playing" ? "Next round is ready." : "Session saved to your streak."}
            </div>
          )}
          <button
            type="button"
            onClick={() => setAction("playing")}
            className="flex w-full items-center justify-center gap-2 rounded-xl bg-cyan-300 py-3.5 text-sm font-black text-[#071428] shadow-[0_8px_22px_rgba(34,211,238,0.16)] transition-transform active:scale-[0.98]"
          >
            Keep Playing
            <ArrowRight className="h-4 w-4" strokeWidth={2.8} />
          </button>
          <button
            type="button"
            onClick={() => setAction("done")}
            className="flex w-full items-center justify-center gap-1 rounded-xl border border-slate-500/70 bg-transparent py-3 text-sm font-bold text-[#cbd5e1] transition-colors hover:border-cyan-300/60 hover:text-cyan-200 active:scale-[0.98]"
          >
            Done
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </button>
        </footer>
      </div>
    </div>
  );
}