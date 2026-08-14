// Placement D — Upper-right corner: brain+icicle icon with "Play" label
export function PlaceD() {
  return (
    <div className="relative w-full h-screen overflow-hidden select-none"
         style={{ background: "linear-gradient(180deg, #050d1a 0%, #091425 40%, #0d1c35 100%)" }}>

      {/* Iceberg bg */}
      <div className="absolute inset-0 flex items-center justify-center pointer-events-none" style={{ top: '15%' }}>
        <svg viewBox="0 0 300 400" className="w-72 opacity-[0.07]" fill="white">
          <ellipse cx="150" cy="120" rx="120" ry="90" />
          <polygon points="60,150 240,150 280,350 20,350" />
          <polygon points="80,200 220,200 200,350 100,350" fill="#ffffff22" />
        </svg>
      </div>
      <div className="absolute bottom-0 left-0 right-0 h-64 pointer-events-none"
           style={{ background: "linear-gradient(to top, #050d1aee 0%, transparent 100%)" }} />

      {/* ── Header ── */}
      <div className="absolute top-0 left-0 right-0 z-10 flex items-center justify-between px-4 pt-12 pb-3">
        {/* Left: wordmark */}
        <div className="flex flex-col">
          <span className="text-[10px] text-blue-300/40 tracking-[0.2em] uppercase">Cold Exposure</span>
          <span className="text-xl font-black text-white tracking-wide"
                style={{ textShadow: '0 0 20px rgba(96,165,250,0.5)' }}>COLDSTREAK</span>
        </div>

        {/* Right: streak + music + Brain Freeze button */}
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-orange-500/20 border border-orange-500/30">
            <span className="text-sm">🔥</span>
            <span className="text-orange-300 text-xs font-bold">14</span>
          </div>
          <div className="w-8 h-8 rounded-full bg-white/10 border border-white/10 flex items-center justify-center">
            <span className="text-sm">🎵</span>
          </div>

          {/* ── BRAIN FREEZE: upper-right icon button ── */}
          <button className="flex flex-col items-center gap-0.5 active:scale-95 transition-transform">
            {/* Icon container */}
            <div className="relative w-9 h-9 rounded-xl flex items-center justify-center"
                 style={{
                   background: "linear-gradient(135deg, rgba(109,40,217,0.55), rgba(30,58,138,0.55))",
                   border: "1px solid rgba(139,92,246,0.35)",
                   backdropFilter: "blur(8px)"
                 }}>
              {/* Brain emoji */}
              <span className="text-[18px] leading-none" style={{ filter: "drop-shadow(0 0 4px rgba(167,139,250,0.6))" }}>🧠</span>
              {/* Icicle decorations — 3 small drops hanging from bottom */}
              <div className="absolute -bottom-[5px] left-0 right-0 flex justify-center gap-[3px] pointer-events-none">
                <div className="w-[3px] rounded-b-full bg-blue-200/70" style={{ height: '6px', clipPath: 'polygon(50% 0%, 0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)' }} />
                <div className="w-[3px] rounded-b-full bg-blue-100/80" style={{ height: '8px', clipPath: 'polygon(50% 0%, 0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)' }} />
                <div className="w-[3px] rounded-b-full bg-blue-200/70" style={{ height: '5px', clipPath: 'polygon(50% 0%, 0% 0%, 100% 0%, 100% 60%, 50% 100%, 0% 60%)' }} />
              </div>
            </div>
            {/* "Play" label */}
            <span className="text-white text-[9px] font-medium tracking-wide leading-none mt-1.5">Play</span>
          </button>
        </div>
      </div>

      {/* ── Timer screen main content ── */}
      <div className="absolute bottom-20 left-0 right-0 px-3 flex flex-col gap-2">

        {/* Goal chip */}
        <div className="flex justify-center">
          <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-blue-900/40 border border-blue-500/20 backdrop-blur-sm">
            <span className="text-xs">🏋️</span>
            <span className="text-[11px] text-blue-200/80">Today's goal: <strong>3:00 Strength</strong></span>
          </div>
        </div>

        {/* Stat panel */}
        <div className="rounded-2xl border border-white/10 overflow-hidden"
             style={{ background: 'rgba(255,255,255,0.04)', backdropFilter: 'blur(12px)' }}>
          <div className="grid grid-cols-3 divide-x divide-white/10">
            <div className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-[10px] text-blue-300/50 uppercase tracking-widest">Water</span>
              <span className="text-3xl font-black text-blue-200" style={{ textShadow: '0 0 12px rgba(96,165,250,0.4)' }}>52°</span>
              <span className="text-[10px] text-blue-300/30">°F</span>
            </div>
            <div className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-[10px] text-white/40 uppercase tracking-widest">Timer</span>
              <span className="text-3xl font-black text-white">0:00</span>
              <button className="mt-1 px-3 py-0.5 rounded-full text-[10px] font-semibold text-white/60 bg-white/10 border border-white/10">Start</button>
            </div>
            <div className="flex flex-col items-center py-3 gap-0.5">
              <span className="text-[10px] text-blue-300/50 uppercase tracking-widest">Score</span>
              <span className="text-3xl font-black text-blue-200" style={{ textShadow: '0 0 12px rgba(96,165,250,0.4)' }}>—</span>
              <span className="text-[10px] text-blue-300/30">pts</span>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
            <div className="py-2 flex flex-col items-center gap-1">
              <span className="text-[9px] text-blue-300/40 uppercase tracking-wider">Under Water</span>
              <div className="flex gap-0.5">
                {Array(7).fill(0).map((_,i) => <div key={i} className="w-2 h-2 rounded-full bg-white/10" />)}
              </div>
            </div>
            <div className="py-2 flex flex-col items-center gap-1">
              <span className="text-[9px] text-white/30">Strength</span>
              <div className="w-16 h-1.5 rounded-full bg-white/10" />
            </div>
            <div className="py-2 flex flex-col items-center gap-1">
              <span className="text-[9px] text-blue-300/40">Badge</span>
              <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/30 flex items-center justify-center">
                <span className="text-[10px]">❄️</span>
              </div>
            </div>
          </div>
        </div>

        {/* Benefit bar */}
        <div className="rounded-2xl border border-blue-500/20 px-3.5 py-2.5"
             style={{ background: 'rgba(23,37,84,0.35)', backdropFilter: 'blur(8px)' }}>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] text-blue-200/80 font-semibold">Strength Benefit</span>
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

        {/* Height nudge */}
        <div className="flex items-center gap-2 px-3 py-2 rounded-xl border border-yellow-500/20 bg-yellow-500/5">
          <span className="text-sm">📏</span>
          <span className="text-[11px] text-yellow-200/70 flex-1">Add your height to calibrate under-water detection</span>
          <button className="text-[10px] text-yellow-400/80 font-semibold px-2 py-0.5 rounded-full border border-yellow-500/30 bg-yellow-500/10">Set</button>
        </div>
      </div>

      {/* Bottom nav */}
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
