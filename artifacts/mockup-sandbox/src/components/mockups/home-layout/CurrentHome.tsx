// Accurate representation of the current ColdStreak home / timer screen layout
export function CurrentHome() {
  return (
    <div className="relative w-full h-screen overflow-hidden select-none"
         style={{ background: "linear-gradient(180deg, #050d1a 0%, #091425 40%, #0d1c35 100%)" }}>

      {/* ── Iceberg background image (simulate) ── */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '15%' }}>
        <svg viewBox="0 0 300 400" className="w-72 opacity-[0.07]" fill="white">
          <ellipse cx="150" cy="120" rx="120" ry="90" />
          <polygon points="60,150 240,150 280,350 20,350" />
          <polygon points="80,200 220,200 200,350 100,350" fill="#ffffff22" />
        </svg>
      </div>
      {/* readability gradient at bottom */}
      <div className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
           style={{ background: "linear-gradient(to top, #050d1aee 0%, transparent 100%)" }} />

      {/* ── Header ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-12 pb-3">
        <div className="flex flex-col">
          <span className="text-[10px] text-blue-300/40 tracking-[0.2em] uppercase">Cold Exposure</span>
          <span className="text-xl font-black text-white tracking-wide"
                style={{ textShadow: '0 0 20px rgba(96,165,250,0.5)' }}>
            COLDSTREAK
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* streak badge */}
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30">
            <span className="text-sm">🔥</span>
            <span className="text-orange-300 text-xs font-bold">14</span>
          </div>
          {/* music icon */}
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
            <span className="text-sm">🎵</span>
          </div>
        </div>
      </div>

      {/* ── Timer screen main content ── */}
      <div className="absolute bottom-20 left-0 right-0 px-3 flex flex-col gap-2">

        {/* Goal nudge / coaching chip  */}
        <div className="flex justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-900/40 border border-blue-500/20 backdrop-blur-sm">
            <span className="text-xs">🏋️</span>
            <span className="text-[11px] text-blue-200/80">Today's goal: <strong>3:00 Strength</strong></span>
          </div>
        </div>

        {/* ── Stat panel ── */}
        <div className="rounded-2xl border border-white/10 overflow-hidden"
             style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>

          {/* Top row: Water / Timer / Score */}
          <div className="grid grid-cols-3 divide-x divide-white/10">
            {/* Water */}
            <div className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-[10px] text-blue-300/50 uppercase tracking-widest">Water</span>
              <span className="text-3xl font-black text-blue-200" style={{ textShadow: '0 0 12px rgba(96,165,250,0.4)' }}>52°</span>
              <span className="text-[10px] text-blue-300/30">°F</span>
            </div>
            {/* Timer */}
            <div className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Timer</span>
              <span className="text-3xl font-black text-white">0:00</span>
              <div className="flex gap-1.5 mt-1">
                <button className="px-3 py-0.5 rounded-full text-[10px] font-semibold text-white/60 bg-white/10 border border-white/10">Start</button>
              </div>
            </div>
            {/* Score */}
            <div className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-[10px] text-blue-300/50 uppercase tracking-widest">Score</span>
              <span className="text-3xl font-black text-blue-200" style={{ textShadow: '0 0 12px rgba(96,165,250,0.4)' }}>—</span>
              <span className="text-[10px] text-blue-300/30">pts</span>
            </div>
          </div>

          {/* Bottom strip: Under Water / Goal toggle / Badge */}
          <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
            <div className="py-2 flex flex-col items-center gap-1">
              <span className="text-[9px] text-blue-300/40 uppercase tracking-wider">Under Water</span>
              <div className="flex gap-0.5">
                {[0,0,0,0,0,0,0].map((_,i) => (
                  <div key={i} className="w-2 h-2 rounded-full bg-white/10" />
                ))}
              </div>
            </div>
            <div className="py-2 flex flex-col items-center gap-1">
              <span className="text-[9px] text-white/30">Strength</span>
              <div className="w-16 h-1.5 rounded-full bg-white/10 overflow-hidden">
                <div className="h-full w-0 bg-blue-400 rounded-full" />
              </div>
            </div>
            <div className="py-2 flex flex-col items-center gap-1">
              <span className="text-[9px] text-blue-300/40">Badge</span>
              <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <span className="text-[10px]">❄️</span>
              </div>
            </div>
          </div>
        </div>

        {/* ── Benefit bar ── */}
        <div className="rounded-2xl border border-blue-500/20 px-3.5 py-2.5"
             style={{ background: 'rgba(23,37,84,0.35)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <div className="flex items-center gap-1.5">
              <span className="text-[11px] text-blue-200/80 font-semibold">Strength Benefit</span>
            </div>
            <span className="text-[10px] text-blue-300/50">Goal: 3:00</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full w-0 rounded-full" style={{ background: 'linear-gradient(to right, #2563eb, #60a5fa)' }} />
          </div>
          <div className="flex justify-between mt-1">
            <span className="text-[9px] text-blue-300/30">0:00</span>
            <span className="text-[9px] text-blue-300/30">3:00</span>
          </div>
        </div>

        {/* ── Brain Freeze quick-launch card ── */}
        <button className="w-full flex items-center gap-3 rounded-2xl border border-violet-600/30 px-3.5 py-3 backdrop-blur-sm transition-all"
                style={{ background: "linear-gradient(to right, rgba(46,16,101,0.6), rgba(23,37,84,0.6))" }}>
          <div className="w-10 h-10 rounded-xl bg-violet-900/60 border border-violet-500/30 flex items-center justify-center shrink-0">
            <span className="text-xl leading-none">🧠</span>
          </div>
          <div className="flex-1 min-w-0 text-left">
            <p className="text-white text-sm font-bold leading-tight">Brain Freeze</p>
            <p className="text-violet-300/60 text-[11px] mt-0.5">Trivia questions during your plunge</p>
          </div>
          <svg className="w-4 h-4 text-violet-400/50 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
        </button>

        {/* Height nudge (shows when no height set) */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
          <span className="text-sm">📏</span>
          <span className="text-[11px] text-yellow-200/70 flex-1">Add your height to calibrate under-water detection</span>
          <button className="text-[10px] text-yellow-400/80 font-semibold px-2 py-0.5 rounded-full border border-yellow-500/30 bg-yellow-500/10">Set</button>
        </div>
      </div>

      {/* ── Bottom nav ── */}
      <div className="absolute bottom-0 left-0 right-0 h-20 border-t border-white/10 flex items-center justify-around px-2"
           style={{ background: 'rgba(5,13,26,0.85)', backdropFilter: 'blur(16px)' }}>
        {[
          { icon: '⏱', label: 'Timer', active: true },
          { icon: '🗺', label: 'Explore', active: false },
          { icon: '⚙️', label: 'Devices', active: false },
          { icon: '👤', label: 'Profile', active: false },
          { icon: '👥', label: 'Friends', active: false },
          { icon: '≡', label: 'More', active: false },
        ].map(({ icon, label, active }) => (
          <div key={label} className={`flex flex-col items-center gap-1 ${active ? 'opacity-100' : 'opacity-35'}`}>
            <span className="text-xl">{icon}</span>
            <span className={`text-[9px] ${active ? 'text-blue-300 font-semibold' : 'text-white/50'}`}>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
