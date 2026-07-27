export function OptionA() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: "linear-gradient(180deg, #0f1f3d 0%, #0a1628 100%)" }}>
      {/* Single unified panel — 3 equal columns, vertical dividers */}
      <div className="w-full max-w-sm rounded-2xl border border-blue-700/40 overflow-hidden"
           style={{ background: "rgba(15,31,61,0.82)", backdropFilter: "blur(16px)" }}>
        <div className="grid grid-cols-3 divide-x divide-blue-700/30">

          {/* Water Temp */}
          <div className="flex flex-col px-3.5 pt-2.5 pb-3">
            <span className="text-blue-400/70 text-[9px] font-semibold uppercase tracking-widest mb-1.5">Water Temp</span>
            <span className="text-white text-[2rem] font-bold leading-none">43°F</span>
            {/* °F/°C pill */}
            <div className="flex mt-2.5 rounded-lg overflow-hidden border border-blue-700/40 text-[11px] font-bold">
              <span className="flex-1 py-1 text-center bg-white text-blue-900">°F</span>
              <span className="flex-1 py-1 text-center text-blue-400">°C</span>
            </div>
            {/* +/- offset */}
            <div className="flex items-center justify-between mt-2 gap-1">
              <button className="w-6 h-6 rounded-md bg-blue-800/70 text-blue-200 text-sm font-bold flex items-center justify-center">−</button>
              <span className="text-blue-300 text-[11px] font-bold">+0°</span>
              <button className="w-6 h-6 rounded-md bg-blue-800/70 text-blue-200 text-sm font-bold flex items-center justify-center">+</button>
            </div>
            <div className="flex items-center gap-1 mt-2.5">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400" style={{ boxShadow: "0 0 4px #4ade80" }} />
              <span className="text-green-400 text-[9px] font-semibold">Live</span>
            </div>
          </div>

          {/* Timer */}
          <div className="flex flex-col items-center px-3.5 pt-2.5 pb-3">
            <span className="text-blue-400/70 text-[9px] font-semibold uppercase tracking-widest mb-1.5">Stopwatch</span>
            <span className="text-slate-100 text-[2rem] font-mono font-bold leading-none">0:00</span>
            <div className="flex gap-1.5 mt-auto w-full pt-3">
              <button className="flex-1 py-1.5 rounded-xl bg-blue-500 text-white text-xs font-bold">Start</button>
              <button className="flex-1 py-1.5 rounded-xl bg-slate-600/80 text-white text-xs font-bold border border-slate-500/50">Stop</button>
            </div>
          </div>

          {/* Cold Score */}
          <div className="flex flex-col px-3.5 pt-2.5 pb-3">
            <span className="text-blue-400/70 text-[9px] font-semibold uppercase tracking-widest mb-1.5">Cold Score</span>
            <span className="text-cyan-300 text-[2rem] font-bold leading-none">11.4</span>
            <span className="text-blue-400/60 text-[9px] mt-1.5">today</span>
            <div className="mt-auto pt-3">
              <div className="h-0.5 rounded-full bg-blue-800/60">
                <div className="h-full w-3/4 rounded-full bg-gradient-to-r from-cyan-600 to-cyan-400" />
              </div>
              <div className="flex justify-between mt-1">
                <span className="text-blue-500/60 text-[8px]">0</span>
                <span className="text-blue-500/60 text-[8px]">PB 15.2</span>
              </div>
            </div>
          </div>

        </div>
      </div>
    </div>
  );
}
