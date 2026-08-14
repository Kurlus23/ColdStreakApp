import { Clock3, Thermometer, X, Zap } from "lucide-react";
import { useState } from "react";

export function Complete() {
  const [action, setAction] = useState<"idle" | "playing" | "done">("idle");

  return (
    <div
      className="w-[390px] h-[844px] overflow-hidden"
      style={{ background: "#060c18" }}
    >
      <div
        className="relative mx-auto mt-10 h-[804px] max-w-full overflow-hidden rounded-t-[20px] border-t border-cyan-400/70 px-5 pb-4 pt-4 text-[#e2e8f0] shadow-[0_-8px_34px_rgba(34,211,238,0.12)]"
        style={{
          background: "linear-gradient(180deg, #0c2a42 0%, #0a1122 12%, #0a1122 100%)",
          fontFamily: "ui-sans-serif, system-ui, sans-serif",
        }}
      >
          <header className="relative border-b border-cyan-200/10 pb-3">
          <button type="button" aria-label="Close" onClick={() => setAction("done")} className="absolute right-0 top-0 flex h-7 w-7 items-center justify-center rounded-full bg-slate-500/20 text-slate-400 hover:bg-slate-500/30">
            <X className="h-4 w-4" />
          </button>
          <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-cyan-300">✨ Plunge Complete</p>
          <h1 className="mt-1 text-[22px] font-bold leading-tight">Level Up Your Mind</h1>
        </header>

        <main>
          <div className="mt-3 mb-3 grid grid-cols-3 gap-3">
            {[
              { icon: Thermometer, value: "39°F", label: "Temp" },
              { icon: Clock3, value: "3:47", label: "Time" },
              { icon: Zap, value: "4.2", label: "Cold Score" },
            ].map(({ icon: Icon, value, label }) => (
              <div key={label} className="flex flex-col items-center rounded-xl bg-[#0d1b35] px-2 py-2">
                <Icon className="mb-1 h-4 w-4 text-cyan-300" strokeWidth={2.5} />
                <strong className="text-[20px] font-bold leading-6 text-[#e2e8f0]">{value}</strong>
                <span className="mt-1 text-[9px] font-bold uppercase tracking-wider text-cyan-300">{label}</span>
              </div>
            ))}
          </div>

          <section className="mb-3 flex items-center gap-3 rounded-xl border border-orange-500 bg-gradient-to-r from-[#92400e] to-[#78350f] px-4 py-2">
            <span className="text-[21px] leading-none">🔥</span>
            <div className="min-w-0 flex-1">
              <h2 className="text-[15px] font-bold leading-5 text-white">21-Day Streak!</h2>
              <p className="mt-0.5 text-[11px] text-slate-300">Keep it alive</p>
            </div>
            <div className="flex flex-col items-end gap-0.5 text-[8px] font-semibold">
              <span className="rounded-full bg-amber-300/20 px-1.5 py-0.5 text-amber-200">🔥 21</span>
              <span className="rounded-full bg-slate-400/20 px-1.5 py-0.5 text-slate-300">📅 47 days this year</span>
            </div>
          </section>

          <section className="mb-3 rounded-xl border border-cyan-300/20 bg-[#0d1b35] px-4 py-3">
            <h2 className="mb-1 text-[10px] font-bold uppercase tracking-[0.17em] text-cyan-300">🧠 Brain Freeze Score</h2>
            <div className="text-[13px] text-slate-400">
              <div className="flex items-center justify-between border-b border-slate-400/10 py-1.5"><span className="text-[13px]">Questions</span><strong className="text-[13px] text-white">8 / 10 correct (80%)</strong></div>
              <div className="flex items-center justify-between border-b border-slate-400/10 py-1.5"><span>Trivia Score</span><strong className="text-[15px] text-[#e2e8f0]">1,200 pts</strong></div>
              <div className="flex items-center justify-between border-b border-slate-400/10 py-1.5"><span>× Cold Multiplier (Metabolism)</span><strong className="text-[15px] text-amber-300">×2.0</strong></div>
              <div className="flex items-center justify-between border-b border-slate-400/10 py-1.5"><span>× Plunge Streak (21 days)</span><strong className="text-[15px] text-amber-300">×1.6</strong></div>
            </div>
            <div className="my-2 border-t-2 border-cyan-400/80" />
            <div className="flex items-center justify-between gap-2">
              <span className="text-[11px] font-bold uppercase tracking-wider text-slate-400">Brain Freeze Total</span>
              <strong className="text-[24px] font-bold text-cyan-300">3,840 pts</strong>
            </div>
            <div className="mt-1 flex justify-end"><span className="rounded-full bg-amber-300/15 px-2 py-0.5 text-[9px] font-bold text-amber-300">⭐ New High Score</span></div>
          </section>

          <aside className="mb-3 rounded-xl border border-cyan-300/35 bg-[#0d172e] px-4 py-3 shadow-[0_0_20px_rgba(34,211,238,0.12)]">
            <h2 className="text-[9px] font-bold uppercase tracking-[0.2em] text-cyan-300">❄️ Cold Take Unlocked</h2>
            <p className="mt-2 text-center font-serif text-[13px] italic leading-relaxed text-[#e2e8f0]">“Brown fat doesn't just burn calories — it rewires your metabolism. Every plunge trains your body to get better at warmth.”</p>
            <div className="mt-2 text-right text-[10px] text-cyan-300">View Collection →</div>
          </aside>
        </main>

        <footer className="mt-3 flex flex-col gap-2">
          {action !== "idle" && <p className="text-center text-[11px] font-bold text-cyan-300">{action === "playing" ? "Next round is ready." : "Session saved to your streak."}</p>}
          <button type="button" onClick={() => setAction("playing")} className="w-full rounded-xl bg-gradient-to-r from-[#0891b2] to-[#0e7490] py-3 text-[18px] font-bold text-white shadow-[0_8px_22px_rgba(34,211,238,0.2)] active:scale-[0.98]">Keep Playing →</button>
          <button type="button" onClick={() => setAction("done")} className="w-full rounded-xl border border-cyan-300/30 bg-transparent py-3 text-[16px] text-slate-300 active:scale-[0.98]">Done</button>
        </footer>
      </div>
    </div>
  );
}