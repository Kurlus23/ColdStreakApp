import { useState } from "react";

export function InterludeA() {
  const [stopped, setStopped] = useState(false);

  return (
    <div
      className="relative h-[844px] w-[390px] overflow-hidden text-[#e2e8f0]"
      style={{
        background: "linear-gradient(180deg, #0c2a42 0%, #071a2e 50%, #040f1e 100%)",
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="pointer-events-none absolute -left-[125px] -top-[145px] h-[300px] w-[300px] rounded-full bg-cyan-400/[0.06] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-[190px] -right-[180px] h-[400px] w-[400px] rounded-full bg-cyan-400/[0.06] blur-3xl" />

      <header className="relative pt-[55px] text-center">
        <div className="bg-gradient-to-r from-white via-cyan-200 to-teal-300 bg-clip-text text-[13px] font-semibold tracking-[0.2em] text-transparent">
          COLDSTREAK
        </div>
        <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.34em] text-cyan-300">
          BRAIN FREEZE MODE
        </div>
      </header>

      <div className="absolute left-0 right-0 top-[107px] flex h-[48px] items-center border-b border-cyan-300/30 bg-cyan-400/[0.13] px-5 backdrop-blur-sm">
        <span className="text-[20px] leading-none" aria-hidden="true">🧠</span>
        <span className="ml-2 flex-1 text-[11px] font-bold uppercase tracking-[0.12em] text-cyan-300">
          BRAIN FREEZE INCOMING
        </span>
        <span
          className="font-mono text-[28px] font-bold leading-none text-cyan-300"
          style={{
            textShadow: "0 0 12px rgba(34,211,238,.8)",
            animation: "brain-freeze-pulse 1.3s ease-in-out infinite",
          }}
        >
          3
        </span>
      </div>

      <main className="relative">
        <section className="absolute left-1/2 top-[83px] flex h-[280px] w-[280px] -translate-x-1/2 items-center justify-center">
          <svg className="absolute inset-0" viewBox="0 0 280 280" fill="none" aria-hidden="true">
            <defs>
              <filter id="interlude-a-arc-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>
            <circle cx="140" cy="140" r="126" stroke="#22d3ee" strokeOpacity=".15" strokeWidth="9" />
            <circle
              cx="140"
              cy="140"
              r="126"
              stroke="#22d3ee"
              strokeWidth="9"
              strokeLinecap="round"
              strokeDasharray="277 792"
              transform="rotate(-90 140 140)"
              filter="url(#interlude-a-arc-glow)"
            />
            <circle cx="241.8" cy="214.1" r="5" fill="#67e8f9" filter="url(#interlude-a-arc-glow)" />
          </svg>
          <div className="relative text-center">
            <div
              className="font-mono text-[4rem] font-bold leading-none tracking-[-0.07em] text-white"
              style={{ textShadow: "0 0 20px rgba(34,211,238,.6)" }}
            >
              01:42
            </div>
            <div className="mt-4 font-mono text-[10px] tracking-[0.16em] text-slate-400">ELAPSED</div>
          </div>
        </section>

        <section className="absolute left-5 right-5 top-[380px] rounded-xl border border-cyan-300/20 bg-cyan-400/[0.06] px-4 py-3 backdrop-blur-sm">
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-300">⚡ COLD TAKE</div>
          <p className="mt-1 font-serif text-[13px] italic leading-[18px] text-white">
            "You're 37% of the way to today's Energy goal. Keep going."
          </p>
        </section>
      </main>

      <footer className="absolute bottom-10 left-6 right-6 flex flex-col gap-4">
        <div className="flex items-center justify-between rounded-full border border-cyan-300/20 bg-cyan-400/[0.07] px-6 py-3">
          <div className="text-center">
            <div className="text-[9px] text-slate-400">LIVE TEMP</div>
            <div className="mt-0.5 text-[22px] font-bold leading-none text-white">39°F</div>
          </div>
          <div className="h-9 w-px bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent" />
          <div className="text-center">
            <div className="text-[9px] text-cyan-300">COLD SCORE</div>
            <div className="mt-0.5 text-[22px] font-bold leading-none text-cyan-300">4.2</div>
          </div>
          <div className="h-9 w-px bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent" />
          <div className="text-center">
            <div className="text-[9px] text-amber-300">PERS. BEST</div>
            <div className="mt-0.5 text-[22px] font-bold leading-none text-amber-300">6.1</div>
          </div>
        </div>

        <div>
          <div className="flex h-2 gap-1.5">
            <div className="flex-1 rounded-full border border-cyan-300/75 bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.7)]" />
            <div className="flex-1 rounded-full border border-amber-300/0 bg-[#78350f]/[0.18]">
              <div className="h-full w-[70%] rounded-full bg-amber-300" />
            </div>
            <div className="flex-1 rounded-full bg-[#7c2d12]/[0.44]" />
            <div className="flex-1 rounded-full bg-[#064e3b]/[0.44]" />
          </div>
          <div className="mt-1 flex justify-between text-[9px]">
            <span className="text-slate-300">⚡</span>
            <span className="text-slate-300">😊</span>
            <span className="text-slate-500">🔥</span>
            <span className="text-slate-500">💪</span>
          </div>
        </div>

        <button
          type="button"
          onClick={() => setStopped(true)}
          className="h-[68px] w-full rounded-2xl bg-gradient-to-b from-red-500 to-red-700 text-[20px] font-bold text-white shadow-[0_0_20px_rgba(239,68,68,.4)] transition-transform active:scale-[0.98]"
        >
          {stopped ? "STOPPED" : "STOP"}
        </button>
      </footer>

      <style>{`
        @keyframes brain-freeze-pulse {
          0%, 100% { opacity: .78; transform: scale(1); }
          50% { opacity: 1; transform: scale(1.08); }
        }
      `}</style>
    </div>
  );
}