// Placement C — Floating Brain FAB (bottom-right, above nav)
import { useState } from "react";

export function PlaceC() {
  const [expanded, setExpanded] = useState(false);

  return (
    <div className="min-h-screen w-full flex items-end justify-center bg-[#0a0f1c] overflow-hidden">
      <div className="relative w-full max-w-[390px] h-screen flex flex-col justify-end pb-20 px-3 gap-2"
           style={{ background: "linear-gradient(to bottom, #0a0f1c 0%, #0c1422 60%, #0f1830 100%)" }}>

        <div className="absolute inset-0 flex items-center justify-center opacity-10 pointer-events-none">
          <div className="w-64 h-80 rounded-full"
               style={{ background: "radial-gradient(ellipse, #60a5fa33 0%, transparent 70%)" }} />
        </div>

        {/* Stat panel */}
        <div className="rounded-2xl border border-white/10 bg-white/5 backdrop-blur-sm overflow-hidden">
          <div className="grid grid-cols-3 divide-x divide-white/10">
            <div className="flex flex-col items-center py-3">
              <span className="text-[10px] text-blue-300/60 uppercase tracking-wider mb-1">Water</span>
              <span className="text-2xl font-bold text-blue-200">52°</span>
              <span className="text-[10px] text-blue-300/40">°F</span>
            </div>
            <div className="flex flex-col items-center py-3">
              <span className="text-[10px] text-white/50 uppercase tracking-wider mb-1">Timer</span>
              <span className="text-2xl font-bold text-white">2:34</span>
              <span className="text-[10px] text-white/30">of 3:00</span>
            </div>
            <div className="flex flex-col items-center py-3">
              <span className="text-[10px] text-blue-300/60 uppercase tracking-wider mb-1">Score</span>
              <span className="text-2xl font-bold text-blue-200">84</span>
              <span className="text-[10px] text-blue-300/40">pts</span>
            </div>
          </div>
          <div className="grid grid-cols-3 divide-x divide-white/10 border-t border-white/10">
            <div className="py-2 flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-blue-300/50">Under Water</span>
              <div className="flex gap-0.5">
                {[1,1,1,1,0,0,0].map((v,i) => (
                  <div key={i} className={`w-2 h-2 rounded-full ${v ? 'bg-blue-400' : 'bg-white/10'}`} />
                ))}
              </div>
            </div>
            <div className="py-2 flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-white/40">Goal: Strength</span>
              <div className="flex gap-1 mt-0.5">
                <div className="w-14 h-1.5 rounded-full bg-white/10 overflow-hidden">
                  <div className="h-full bg-blue-400 rounded-full" style={{ width: '65%' }} />
                </div>
              </div>
            </div>
            <div className="py-2 flex flex-col items-center gap-0.5">
              <span className="text-[9px] text-blue-300/50">Badge</span>
              <div className="w-5 h-5 rounded-full bg-amber-500/20 border border-amber-500/40 flex items-center justify-center">
                <span className="text-[10px]">🔥</span>
              </div>
            </div>
          </div>
        </div>

        {/* Benefit bar */}
        <div className="rounded-2xl border border-blue-500/20 bg-blue-950/30 px-3.5 py-2.5">
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[10px] text-blue-300/70 font-medium">Strength Benefit</span>
            <span className="text-[10px] text-blue-300/50">2:00 left</span>
          </div>
          <div className="h-1.5 rounded-full bg-white/10 overflow-hidden">
            <div className="h-full rounded-full" style={{ width: '72%', background: 'linear-gradient(to right, #3b82f6, #60a5fa)' }} />
          </div>
        </div>

        {/* ── BRAIN FREEZE: Floating FAB, bottom-right corner above nav ── */}
        {/* Expanded tooltip card */}
        {expanded && (
          <div className="absolute right-3 bottom-[88px] rounded-2xl border border-violet-600/30 px-3.5 py-3 flex items-center gap-3 w-[220px]"
               style={{ background: "linear-gradient(to right, rgba(46,16,101,0.9), rgba(23,37,84,0.9))", backdropFilter: 'blur(8px)' }}>
            <div className="flex-1 min-w-0 text-left">
              <p className="text-white text-sm font-bold leading-tight">Brain Freeze</p>
              <p className="text-violet-300/60 text-[11px] mt-0.5">78% in-cold · 91% outside</p>
            </div>
            <svg className="w-4 h-4 text-violet-400/60 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
            </svg>
          </div>
        )}

        {/* FAB button */}
        <button
          onClick={() => setExpanded(!expanded)}
          className="absolute right-4 bottom-[88px] w-12 h-12 rounded-2xl border border-violet-500/40 flex items-center justify-center shadow-lg transition-all active:scale-95"
          style={{ background: "linear-gradient(135deg, rgba(109,40,217,0.8), rgba(30,58,138,0.8))", backdropFilter: 'blur(8px)' }}>
          <span className="text-2xl leading-none select-none">🧠</span>
        </button>

        {/* Label */}
        <div className="absolute top-6 left-0 right-0 flex justify-center">
          <div className="px-3 py-1 rounded-full bg-white/10 border border-white/20">
            <span className="text-[11px] text-white/70 font-medium">C — Floating FAB (tap to expand)</span>
          </div>
        </div>

        {/* Nav bar hint */}
        <div className="absolute bottom-0 left-0 right-0 h-20 border-t border-white/10 bg-black/60 backdrop-blur-sm flex items-center justify-around px-4">
          {['⏱','🗺','⚙️','👤','👥','≡'].map((icon, i) => (
            <div key={i} className={`flex flex-col items-center gap-1 ${i === 0 ? 'opacity-100' : 'opacity-30'}`}>
              <span className="text-lg">{icon}</span>
              <div className={`w-1 h-1 rounded-full ${i === 0 ? 'bg-blue-400' : 'bg-transparent'}`} />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
