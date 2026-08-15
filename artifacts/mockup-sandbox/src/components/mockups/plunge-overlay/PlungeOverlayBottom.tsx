import { useState } from "react";

export default function PlungeOverlayBottom() {
  const [brainFreezeEnabled, setBrainFreezeEnabled] = useState(true);

  return (
    <div
      className="w-full h-screen flex flex-col justify-end"
      style={{
        background: "linear-gradient(180deg, #000d1f 0%, #001233 60%, #00082e 100%)",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Faint timer at top to give context */}
      <div className="flex-1 flex flex-col items-center justify-center gap-2 pb-6">
        <div className="text-blue-500/30 text-xs tracking-widest uppercase font-semibold">Active Plunge</div>
        <div className="text-white/20 text-6xl font-black tabular-nums tracking-tighter">02:34</div>
        <div className="text-cyan-500/25 text-sm font-semibold">Score 4.7</div>
      </div>

      {/* Bottom HUD */}
      <div className="w-full px-6 pb-10 flex flex-col gap-3">

        {/* Stats row */}
        <div
          className="flex items-center justify-between px-5 py-3 rounded-2xl"
          style={{
            background: "rgba(6,182,212,0.07)",
            border: "1px solid rgba(34,211,238,0.12)",
            backdropFilter: "blur(8px)",
          }}
        >
          <div className="flex flex-col items-center">
            <span className="text-slate-600 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Live Temp</span>
            <span className="text-slate-600 text-2xl font-bold tracking-tight">—</span>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-cyan-400 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Cold Score</span>
            <span className="text-cyan-300 text-2xl font-bold tracking-tight">4.7</span>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-amber-400 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Personal Best</span>
            <span className="text-amber-300 text-2xl font-bold tracking-tight">6.2</span>
          </div>
        </div>

        {/* Benefit bar placeholder */}
        <div
          className="w-full rounded-2xl px-4 py-3 flex items-center gap-3"
          style={{
            background: "rgba(6,182,212,0.05)",
            border: "1px solid rgba(34,211,238,0.1)",
          }}
        >
          <span className="text-[11px] text-blue-400/50 font-semibold">💪 Recovery</span>
          <div className="flex-1 h-1.5 rounded-full bg-blue-950 overflow-hidden">
            <div className="h-full rounded-full bg-cyan-500" style={{ width: "55%" }} />
          </div>
          <span className="text-[11px] text-blue-400/50 tabular-nums">1:12 left</span>
        </div>

        {/* Brain Freeze toggle — the new element */}
        <button
          onClick={() => setBrainFreezeEnabled(e => !e)}
          className="w-full flex items-center justify-between px-4 py-2.5 rounded-2xl transition-all active:scale-[0.98]"
          style={{
            background: brainFreezeEnabled ? "rgba(34,211,238,0.08)" : "rgba(6,18,52,0.55)",
            border: `1px solid ${brainFreezeEnabled ? "rgba(34,211,238,0.22)" : "rgba(59,130,246,0.12)"}`,
            backdropFilter: "blur(6px)",
          }}
        >
          <div className="flex items-center gap-2.5">
            {/* Brain freeze icon placeholder */}
            <div
              className="w-6 h-6 rounded-lg shrink-0 flex items-center justify-center text-xs"
              style={{
                background: brainFreezeEnabled ? "rgba(34,211,238,0.2)" : "rgba(30,58,95,0.4)",
                opacity: brainFreezeEnabled ? 1 : 0.5,
              }}
            >
              🧠
            </div>
            <span className="text-xs font-semibold" style={{ color: brainFreezeEnabled ? "#67e8f9" : "#475569" }}>
              Brain Freeze Trivia
            </span>
          </div>
          {/* Toggle pill */}
          <div
            className={`relative w-10 h-5 rounded-full transition-colors duration-200 ${brainFreezeEnabled ? "bg-cyan-500" : "bg-slate-700"}`}
          >
            <span
              className={`absolute top-0.5 left-0.5 w-4 h-4 bg-white rounded-full shadow transition-transform duration-200 ${brainFreezeEnabled ? "translate-x-5" : "translate-x-0"}`}
            />
          </div>
        </button>

        {/* Stop button */}
        <button className="w-full relative group">
          <div className="absolute inset-0 bg-red-600 rounded-2xl blur-lg opacity-50" />
          <div
            className="relative text-white font-bold py-5 rounded-2xl text-xl tracking-wider"
            style={{
              background: "linear-gradient(to bottom, #ef4444, #b91c1c)",
              border: "1px solid rgba(248,113,113,0.5)",
              boxShadow: "inset 0 2px 10px rgba(255,255,255,0.3)",
            }}
          >
            STOP
          </div>
        </button>

      </div>
    </div>
  );
}
