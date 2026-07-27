export function OptionC() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: "linear-gradient(180deg, #0f1f3d 0%, #0a1628 100%)" }}>
      {/* Borderless HUD — numbers floating large, labels tiny above, no card outlines */}
      <div className="w-full max-w-sm rounded-2xl px-2 py-3"
           style={{ background: "rgba(6,15,35,0.70)", backdropFilter: "blur(24px)" }}>
        <div className="grid grid-cols-3">

          {/* Water Temp */}
          <div className="flex flex-col items-center px-2 py-2 relative">
            <span className="text-blue-400/60 text-[8.5px] font-semibold uppercase tracking-widest mb-1">Water</span>
            <span className="text-white text-[2.4rem] font-bold leading-none">43°</span>
            <div className="flex items-center gap-1.5 mt-1.5">
              <button className="text-white text-[10px] font-bold opacity-90">°F</button>
              <span className="text-blue-600/60 text-[10px]">/</span>
              <button className="text-blue-400/60 text-[10px] font-bold">°C</button>
            </div>
            <div className="flex items-center gap-1 mt-2">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: "0 0 6px #4ade80" }} />
              <span className="text-green-400/80 text-[8px]">Live</span>
            </div>
            {/* right divider */}
            <div className="absolute right-0 top-3 bottom-3 w-px bg-blue-800/50" />
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center px-2 py-2 relative">
            <span className="text-blue-400/60 text-[8.5px] font-semibold uppercase tracking-widest mb-1">Timer</span>
            <span className="text-slate-100 text-[2.4rem] font-mono font-bold leading-none">0:00</span>
            <div className="flex gap-1.5 mt-2.5 w-full">
              <button className="flex-1 py-1.5 rounded-xl bg-blue-500/90 text-white text-[10px] font-bold">Start</button>
              <button className="flex-1 py-1.5 rounded-xl border border-slate-600/60 text-slate-300 text-[10px] font-bold">Stop</button>
            </div>
            {/* right divider */}
            <div className="absolute right-0 top-3 bottom-3 w-px bg-blue-800/50" />
          </div>

          {/* Cold Score */}
          <div className="flex flex-col items-center px-2 py-2">
            <span className="text-blue-400/60 text-[8.5px] font-semibold uppercase tracking-widest mb-1">Score</span>
            <span className="text-cyan-300 text-[2.4rem] font-bold leading-none"
                  style={{ textShadow: "0 0 20px rgba(103,232,249,0.35)" }}>11.4</span>
            <span className="text-blue-500/50 text-[8px] mt-1.5">today</span>
            <div className="mt-2 w-full px-2">
              <div className="h-0.5 rounded-full bg-blue-900">
                <div className="h-full w-3/4 rounded-full" style={{ background: "linear-gradient(90deg, #0891b2, #67e8f9)" }} />
              </div>
            </div>
          </div>

        </div>

        {/* Bottom micro-controls strip */}
        <div className="flex items-center justify-between px-3 pt-2 mt-1 border-t border-blue-800/30">
          <div className="flex items-center gap-1">
            <button className="w-5 h-5 rounded bg-blue-800/70 text-blue-300 text-xs flex items-center justify-center font-bold">−</button>
            <span className="text-blue-400/70 text-[10px]">+0°</span>
            <button className="w-5 h-5 rounded bg-blue-800/70 text-blue-300 text-xs flex items-center justify-center font-bold">+</button>
          </div>
          <span className="text-blue-500/40 text-[8px] uppercase tracking-widest">Tap score to cycle</span>
        </div>
      </div>
    </div>
  );
}
