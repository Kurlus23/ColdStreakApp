export function OptionB() {
  return (
    <div className="min-h-screen flex items-center justify-center p-4"
         style={{ background: "linear-gradient(180deg, #0f1f3d 0%, #0a1628 100%)" }}>
      {/* Compact pill cards — coloured top accent, number dominant, label badge bottom */}
      <div className="w-full max-w-sm grid grid-cols-3 gap-2">

        {/* Water Temp — icy blue accent */}
        <div className="rounded-2xl border border-blue-700/40 flex flex-col overflow-hidden"
             style={{ background: "rgba(15,31,61,0.82)", backdropFilter: "blur(16px)" }}>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #38bdf8, #7dd3fc)" }} />
          <div className="px-3 pt-2.5 pb-3 flex flex-col flex-1">
            <span className="text-white text-[2.1rem] font-bold leading-none">43°</span>
            <div className="flex gap-1 mt-1.5">
              <span className="px-1.5 py-0.5 rounded bg-white text-blue-900 text-[10px] font-bold">F</span>
              <span className="px-1.5 py-0.5 rounded text-blue-400 text-[10px] font-bold">C</span>
            </div>
            <div className="mt-auto pt-2.5 flex items-center gap-1">
              <span className="w-1.5 h-1.5 rounded-full bg-green-400 shrink-0" style={{ boxShadow: "0 0 4px #4ade80" }} />
              <span className="text-blue-400/70 text-[9px] font-semibold uppercase tracking-wider">Water Temp</span>
            </div>
          </div>
        </div>

        {/* Timer — white/neutral accent */}
        <div className="rounded-2xl border border-blue-700/40 flex flex-col overflow-hidden"
             style={{ background: "rgba(15,31,61,0.82)", backdropFilter: "blur(16px)" }}>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #94a3b8, #cbd5e1)" }} />
          <div className="px-3 pt-2.5 pb-3 flex flex-col flex-1">
            <span className="text-slate-100 text-[2.1rem] font-mono font-bold leading-none">0:00</span>
            <div className="flex gap-1 mt-1.5">
              <button className="flex-1 py-1 rounded-lg bg-blue-500 text-white text-[10px] font-bold">Start</button>
              <button className="flex-1 py--1 rounded-lg bg-slate-600/80 text-white text-[10px] font-bold border border-slate-500/40">Stop</button>
            </div>
            <div className="mt-auto pt-2.5">
              <span className="text-blue-400/70 text-[9px] font-semibold uppercase tracking-wider">Stopwatch</span>
            </div>
          </div>
        </div>

        {/* Cold Score — cyan accent */}
        <div className="rounded-2xl border border-cyan-600/30 flex flex-col overflow-hidden"
             style={{ background: "rgba(15,31,61,0.82)", backdropFilter: "blur(16px)" }}>
          <div className="h-1 w-full" style={{ background: "linear-gradient(90deg, #06b6d4, #67e8f9)" }} />
          <div className="px-3 pt-2.5 pb-3 flex flex-col flex-1">
            <span className="text-cyan-300 text-[2.1rem] font-bold leading-none">11.4</span>
            <span className="text-blue-400/60 text-[9px] mt-1.5">today</span>
            <div className="mt-auto pt-2.5">
              <span className="text-blue-400/70 text-[9px] font-semibold uppercase tracking-wider">Cold Score</span>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
