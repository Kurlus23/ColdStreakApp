import { Thermometer, Zap, Smile, Flame, Dumbbell, Snowflake } from "lucide-react";

export function Interlude() {
  const stages = [
    { label: "Energy", icon: Zap, state: "passed" },
    { label: "Mood", icon: Smile, state: "passed" },
    { label: "Metabolism", icon: Flame, state: "active" },
    { label: "Recovery", icon: Dumbbell, state: "next" },
  ] as const;

  return (
    <div
      className="relative h-[844px] w-[390px] overflow-hidden text-slate-200"
      style={{
        backgroundColor: "#071428",
        fontFamily: "ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(120deg, transparent 0%, rgba(148,163,184,.17) 49%, transparent 50%), linear-gradient(35deg, transparent 0%, rgba(34,211,238,.10) 49%, transparent 50%)",
          backgroundSize: "118px 118px, 156px 156px",
          maskImage: "radial-gradient(circle at 50% 40%, black, transparent 76%)",
        }}
      />
      <div className="pointer-events-none absolute -right-28 top-44 h-72 w-72 rounded-full border border-cyan-300/[0.07]" />
      <div className="pointer-events-none absolute -left-32 bottom-28 h-80 w-80 rounded-full border border-slate-300/[0.05]" />

      <main className="relative flex h-full flex-col px-7 pb-8 pt-8">
        <header className="flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <Snowflake size={17} strokeWidth={1.7} className="text-cyan-300" />
            <span className="text-[11px] font-semibold tracking-[0.34em] text-slate-300">BRAIN FREEZE</span>
          </div>
          <div className="flex items-center gap-2 rounded-full border border-cyan-200/20 bg-[#102847] px-3 py-1.5">
            <Thermometer size={14} className="text-cyan-300" strokeWidth={2} />
            <span className="text-[13px] font-bold tracking-wide text-cyan-100">39°F</span>
          </div>
        </header>

        <section className="mt-[75px] text-center">
          <p className="text-[10px] font-medium uppercase tracking-[0.3em] text-slate-500">time in the cold</p>
          <div className="mt-3 text-[67px] font-bold leading-none tracking-[-0.055em] text-slate-100">02:47</div>
          <div className="mx-auto mt-5 h-px w-12 bg-cyan-300/55" />
          <p className="mt-4 text-[12px] tracking-[0.14em] text-slate-400">STAY WITH IT</p>
        </section>

        <section className="mt-[63px]">
          <div className="mb-5 flex items-center justify-between">
            <span className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">benefit milestone</span>
            <span className="text-[11px] font-medium text-cyan-300/80">3 of 4 reached</span>
          </div>
          <div className="relative">
            <div className="absolute left-5 right-5 top-[17px] h-px bg-[#31506d]" />
            <div className="absolute left-5 top-[17px] h-px w-[61%] bg-cyan-300/75" />
            <div className="relative grid grid-cols-4">
              {stages.map(({ label, icon: Icon, state }) => (
                <div key={label} className="flex flex-col items-center gap-3 text-center">
                  <div
                    className={`relative flex h-[35px] w-[35px] items-center justify-center rounded-full border ${
                      state === "passed"
                        ? "border-cyan-300/60 bg-cyan-300 text-[#09213b]"
                        : state === "active"
                          ? "border-cyan-200 bg-[#1e3a5f] text-cyan-200"
                          : "border-slate-500/45 bg-[#122844] text-slate-500"
                    }`}
                    style={state === "active" ? { boxShadow: "0 0 0 5px rgba(34,211,238,.08), 0 0 20px rgba(34,211,238,.32)" } : undefined}
                  >
                    <Icon size={15} strokeWidth={2.2} />
                    {state === "active" && <span className="absolute inset-[-7px] animate-ping rounded-full border border-cyan-300/25" />}
                  </div>
                  <span className={`text-[10px] font-medium ${state === "next" ? "text-slate-500" : "text-slate-300"}`}>{label}</span>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="mt-[54px] flex items-center justify-between">
          <div>
            <p className="text-[10px] font-semibold uppercase tracking-[0.24em] text-slate-500">cold multiplier</p>
            <div className="mt-2 flex items-baseline gap-2">
              <span className="text-[33px] font-bold tracking-[-0.04em] text-cyan-200">×2.0</span>
              <span className="text-[11px] text-slate-400">metabolism unlocked</span>
            </div>
          </div>
          <div className="flex gap-1.5 rounded-xl border border-orange-200/15 bg-[#182f4e] px-3 py-2.5" aria-label="three brain streak flames">
            <span className="text-[18px] leading-none">🔥</span><span className="text-[18px] leading-none">🔥</span><span className="text-[18px] leading-none">🔥</span>
          </div>
        </section>

        <section className="mt-auto flex flex-col items-center">
          <div className="relative flex h-[108px] w-[108px] items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 108 108" fill="none" aria-hidden="true">
              <circle cx="54" cy="54" r="45" stroke="#294564" strokeWidth="2" />
              <circle cx="54" cy="54" r="45" stroke="#22d3ee" strokeWidth="2.5" strokeLinecap="round" strokeDasharray="282.7" strokeDashoffset="75" />
            </svg>
            <div className="text-center">
              <div className="text-[27px] font-bold leading-none text-slate-100">12s</div>
              <div className="mt-2 text-[9px] uppercase tracking-[0.2em] text-slate-500">until next</div>
            </div>
          </div>
          <p className="mt-4 text-[12px] font-medium tracking-[0.12em] text-slate-300">NEXT QUESTION IN 12S</p>
          <p className="mt-2 text-[11px] text-slate-500">Breathe deep. You’re doing great.</p>
        </section>
      </main>
    </div>
  );
}