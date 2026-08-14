import { Thermometer, Zap, Smile, Flame, Dumbbell, Plus, Check } from "lucide-react";

export function Interlude() {
  const benefits = [
    { label: "Energy", icon: Zap, fill: "100%", tone: "bg-cyan-300", iconTone: "text-cyan-200" },
    { label: "Mood", icon: Smile, fill: "70%", tone: "bg-cyan-300/75", iconTone: "text-cyan-200" },
    { label: "Metabolism", icon: Flame, fill: "0%", tone: "bg-transparent", iconTone: "text-slate-500" },
    { label: "Recovery", icon: Dumbbell, fill: "0%", tone: "bg-transparent", iconTone: "text-slate-500" },
  ] as const;

  return (
    <div
      className="w-[390px] h-[844px] overflow-hidden relative text-[#e2e8f0]"
      style={{
        backgroundColor: "#071428",
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div
        className="pointer-events-none absolute inset-0 opacity-[0.13]"
        style={{
          backgroundImage:
            "linear-gradient(135deg, transparent 0%, rgba(148,163,184,.14) 49%, transparent 50%), linear-gradient(45deg, transparent 0%, rgba(34,211,238,.08) 49%, transparent 50%)",
          backgroundSize: "130px 130px, 180px 180px",
          maskImage: "linear-gradient(to bottom, black, transparent 85%)",
        }}
      />
      <main className="relative flex h-full flex-col px-6 pb-7 pt-7">
        <header className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 text-cyan-300">
              <Thermometer size={20} strokeWidth={1.8} />
              <span className="text-[27px] font-semibold leading-none tracking-[-0.04em]">39°F</span>
            </div>
            <p className="mt-2 pl-7 text-[10px] uppercase tracking-[0.22em] text-[#94a3b8]">water temperature</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] uppercase tracking-[0.22em] text-[#94a3b8]">cold score</p>
            <p className="mt-1 text-[25px] font-bold leading-none text-[#e2e8f0]">4.2 <span className="text-cyan-300">❄</span></p>
          </div>
        </header>

        <section className="mt-[48px] flex flex-col items-center">
          <div className="relative flex h-[220px] w-[220px] items-center justify-center">
            <svg className="absolute inset-0 -rotate-90" viewBox="0 0 220 220" fill="none" aria-hidden="true">
              <circle cx="110" cy="110" r="102" stroke="#1e3a5f" strokeWidth="8" />
              <circle cx="110" cy="110" r="102" stroke="#22d3ee" strokeWidth="8" strokeLinecap="round" strokeDasharray="641" strokeDashoffset="420" />
            </svg>
            <div className="text-center">
              <p className="text-[10px] uppercase tracking-[0.27em] text-[#94a3b8]">in the cold</p>
              <p className="mt-2 text-[52px] font-bold leading-none tracking-[-0.07em] text-[#e2e8f0]">01:42</p>
              <p className="mt-3 text-[10px] tracking-[0.2em] text-cyan-300/80">KEEP GOING</p>
            </div>
          </div>
          <div className="mt-6 flex items-center gap-2 rounded-full border border-cyan-300/25 bg-[#1e3a5f]/80 px-3.5 py-1.5 text-[11px] font-semibold text-cyan-100">
            <Flame size={13} className="text-orange-300" fill="currentColor" /> Metabolism
          </div>
        </section>

        <section className="mt-[43px]">
          <div className="mb-3 flex items-center justify-between">
            <span className="text-[10px] font-semibold uppercase tracking-[0.23em] text-[#94a3b8]">benefits unlocked</span>
            <span className="text-[10px] text-cyan-300/75">1 of 4 complete</span>
          </div>
          <div className="grid grid-cols-4 gap-1.5">
            {benefits.map(({ label, icon: Icon, fill, tone, iconTone }) => (
              <div key={label}>
                <div className="h-2 overflow-hidden rounded-full bg-[#1e3a5f]">
                  <div className={`h-full rounded-full ${tone}`} style={{ width: fill }} />
                </div>
                <div className={`mt-2 flex items-center gap-1 text-[9px] ${iconTone}`}>
                  <Icon size={11} strokeWidth={2.2} />
                  <span>{label}</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="mt-auto">
          <div
            className="relative overflow-hidden rounded-2xl border border-cyan-300/70 bg-[#0f1f3d]/95 px-5 pb-4 pt-3 text-center"
            style={{ boxShadow: "0 0 0 1px rgba(34,211,238,.18), 0 0 26px rgba(34,211,238,.22), inset 0 1px 0 rgba(226,232,240,.08)", backdropFilter: "blur(10px)" }}
          >
            <div className="absolute inset-x-0 top-0 h-px bg-cyan-200/80" />
            <div className="flex items-center justify-center gap-2 text-[10px] font-bold tracking-[0.2em] text-cyan-200">
              <span className="text-[17px]">🧠</span> BRAIN FREEZE INCOMING
            </div>
            <div className="mt-1 animate-pulse text-[66px] font-bold leading-none tracking-[-0.08em] text-[#e2e8f0]">3</div>
            <p className="mt-1 text-[11px] text-[#94a3b8]">Get ready...</p>
          </div>
          <div className="mt-3 flex gap-3">
            <button type="button" className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-[#31506d] bg-[#0f1f3d]/80 text-[12px] font-semibold text-[#cbd5e1]">
              <Plus size={15} /> Add 0:30
            </button>
            <button type="button" className="flex h-11 flex-1 items-center justify-center gap-1.5 rounded-xl border border-cyan-300/40 bg-cyan-300/10 text-[12px] font-semibold text-cyan-100">
              <Check size={15} /> Finish 😊
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}