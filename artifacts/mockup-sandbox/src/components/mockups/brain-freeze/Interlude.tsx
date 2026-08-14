export function Interlude() {
  return (
    <div
      className="relative h-[844px] w-[390px] overflow-hidden text-[#e2e8f0]"
      style={{
        background: "linear-gradient(180deg, #0c2a42 0%, #071a2e 50%, #040f1e 100%)",
        fontFamily: "'DM Sans', ui-sans-serif, system-ui, sans-serif",
      }}
    >
      <div className="pointer-events-none absolute -left-28 -top-32 h-[300px] w-[300px] rounded-full bg-cyan-400/[0.07] blur-3xl" />
      <div className="pointer-events-none absolute -bottom-40 -right-36 h-[400px] w-[400px] rounded-full bg-cyan-400/[0.06] blur-3xl" />

      <header className="relative pt-[55px] text-center">
        <div
          className="bg-gradient-to-r from-white via-cyan-200 to-teal-300 bg-clip-text text-[13px] font-semibold tracking-[0.2em] text-transparent"
        >
          COLDSTREAK
        </div>
        <div className="mt-2 text-[10px] font-medium uppercase tracking-[0.34em] text-cyan-300">BRAIN FREEZE MODE</div>
      </header>

      <main className="relative">
        <section className="absolute left-1/2 top-[79px] flex h-[280px] w-[280px] -translate-x-1/2 items-center justify-center">
          <svg className="absolute inset-0" viewBox="0 0 280 280" fill="none" aria-hidden="true">
            <defs>
              <filter id="arc-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="4" result="blur" />
                <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
              </filter>
            </defs>
            <circle cx="140" cy="140" r="126" stroke="#22d3ee" strokeOpacity=".15" strokeWidth="9" />
            <circle cx="140" cy="140" r="126" stroke="#22d3ee" strokeWidth="9" strokeLinecap="round" strokeDasharray="277 792" transform="rotate(-90 140 140)" filter="url(#arc-glow)" />
            <circle cx="241.8" cy="214.1" r="5" fill="#67e8f9" filter="url(#arc-glow)" />
          </svg>
          <div className="relative text-center">
            <div className="font-mono text-[2rem] font-bold leading-none tracking-[-0.06em] text-[#e2e8f0]" style={{ textShadow: "0 0 12px rgba(34,211,238,.45)" }}>01:42</div>
            <div className="mt-5">
              <div className="text-[18px] leading-none">🧠</div>
              <div className="mt-1 font-mono text-[2.5rem] font-bold leading-none text-cyan-300" style={{ textShadow: "0 0 10px rgba(34,211,238,.55)" }}>3</div>
            </div>
          </div>
        </section>

        <section className="absolute left-5 right-5 top-[399px] rounded-xl border border-cyan-300/40 bg-cyan-400/[0.06] px-4 pb-6 pt-3 backdrop-blur-md" style={{ position: "relative" }}>
          <div className="text-[9px] font-bold uppercase tracking-[0.22em] text-cyan-300">⚡ COLD TAKE</div>
          <p className="mt-1 font-serif text-[13px] italic leading-[18px] text-[#e2e8f0]">"You're 37% of the way to today's Energy goal. Keep going."</p>
          <div
            style={{
              position: 'absolute',
              bottom: 8,
              right: 10,
              background: 'rgba(6,182,212,0.15)',
              border: '1px solid rgba(34,211,238,0.4)',
              borderRadius: 999,
              padding: '2px 10px',
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              fontSize: 11,
            }}
          >
            🧠 Brain Freeze in <strong style={{ fontSize: 13, fontWeight: 700, color: '#22d3ee' }}>3</strong>
          </div>
        </section>
      </main>

      <footer className="absolute bottom-10 left-6 right-6">
        <div className="flex items-center justify-between rounded-full border border-cyan-300/35 bg-cyan-400/[0.07] px-6 py-3">
          <div className="text-center"><div className="text-[9px] text-[#94a3b8]">LIVE TEMP</div><div className="mt-0.5 text-[22px] font-bold leading-none">39°F</div></div>
          <div className="h-9 w-px bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent" />
          <div className="text-center"><div className="text-[9px] text-cyan-300">COLD SCORE</div><div className="mt-0.5 text-[22px] font-bold leading-none text-cyan-300">4.2</div></div>
          <div className="h-9 w-px bg-gradient-to-b from-transparent via-cyan-300/40 to-transparent" />
          <div className="text-center"><div className="text-[9px] text-amber-300">PERS. BEST</div><div className="mt-0.5 text-[22px] font-bold leading-none text-amber-300">6.1</div></div>
        </div>
        <div className="mt-4">
          <div className="flex h-2 gap-1 overflow-hidden rounded-full">
            <div className="h-full flex-1 rounded-full bg-cyan-300 shadow-[0_0_10px_rgba(34,211,238,.8)]" />
            <div className="h-full flex-1 rounded-full bg-slate-700"><div className="h-full w-[70%] rounded-full bg-cyan-300/80" /></div>
            <div className="h-full flex-1 rounded-full bg-slate-700" /><div className="h-full flex-1 rounded-full bg-slate-700" />
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-[#94a3b8]"><span>⚡ Energy</span><span>😊 Mood</span><span>🔥 Metabolism</span><span>💪 Recovery</span></div>
        </div>
        <button type="button" className="mt-4 h-[68px] w-full rounded-2xl bg-gradient-to-b from-red-500 to-red-700 text-[20px] font-bold text-white shadow-[0_0_28px_rgba(239,68,68,.38)]">STOP</button>
      </footer>
    </div>
  );
}