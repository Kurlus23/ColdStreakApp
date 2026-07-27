// Option A — Benefit bar sits ABOVE the three tiles (between cold take and tiles)

const SEGMENTS = [
  { emoji: "⚡", label: "Energy",     fill: 100, bar: "#22d3ee", dim: "#164e6388" },
  { emoji: "😊", label: "Mood",       fill: 72,  bar: "#fbbf24", dim: "#78350f88" },
  { emoji: "🔥", label: "Metabolism", fill: 0,   bar: "#f97316", dim: "#7c2d1288" },
  { emoji: "💪", label: "Recovery",   fill: 0,   bar: "#34d399", dim: "#064e3b88" },
];

function BenefitBar() {
  return (
    <div className="space-y-1 mb-2.5">
      <p className="text-center text-[11px] font-semibold tracking-wide" style={{ color: "#fbbf24", minHeight: "1rem" }}>
        😊 Mood filling…
      </p>
      <div className="flex gap-1.5">
        {SEGMENTS.map((seg) => {
          const done = seg.fill >= 100;
          const active = seg.fill > 0 && seg.fill < 100;
          return (
            <div key={seg.label} className="flex-1 min-w-0 space-y-1">
              <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: seg.dim }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${seg.fill}%`,
                    backgroundColor: seg.bar,
                    opacity: done ? 1 : active ? 0.9 : 0,
                    boxShadow: active ? `0 0 6px 2px ${seg.bar}55` : "none",
                  }}
                />
              </div>
              <p className="text-center text-[9px] font-semibold leading-none truncate"
                style={{ color: done || active ? seg.bar : "#334155" }}>
                {seg.emoji} {seg.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function OptionA() {
  return (
    <div className="w-[390px] h-[844px] relative overflow-hidden font-sans select-none"
      style={{ background: "radial-gradient(ellipse at 50% -10%, rgba(14,165,233,0.25) 0%, #0f172a 55%)", backgroundColor: "#0f172a" }}>

      {/* Icy background texture */}
      <div className="absolute inset-0 opacity-20"
        style={{ background: "radial-gradient(circle at 30% 40%, #38bdf8 0%, transparent 50%), radial-gradient(circle at 70% 60%, #0ea5e9 0%, transparent 45%)" }} />

      {/* Nav bar placeholder */}
      <div className="absolute bottom-0 left-0 right-0 h-20 bg-blue-950/95 border-t border-blue-800/60 flex items-center justify-around px-2">
        {["⏱", "📋", "🧭", "⚙️"].map((icon, i) => (
          <button key={i} className={`flex flex-col items-center gap-1 py-2 px-3 rounded-xl ${i === 0 ? "bg-blue-800/60" : ""}`}>
            <span className="text-lg">{icon}</span>
            <span className="text-[10px] text-blue-400">{["Timer","History","Explore","Settings"][i]}</span>
          </button>
        ))}
      </div>

      {/* Music bar */}
      <div className="absolute top-14 left-3 right-3">
        <div className="bg-blue-900/75 backdrop-blur-md rounded-2xl border border-blue-700/40 px-3 py-2 flex items-center gap-2">
          <div className="w-7 h-7 rounded-full bg-green-500/20 flex items-center justify-center shrink-0">
            <span className="text-green-400 text-xs font-bold">♫</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-white text-xs font-semibold truncate">Ice Bath Mix</p>
            <p className="text-blue-300 text-[10px] truncate">Spotify</p>
          </div>
          <div className="flex items-center gap-1">
            <button className="w-7 h-7 flex items-center justify-center text-blue-300 hover:text-white">⏮</button>
            <button className="w-7 h-7 flex items-center justify-center text-blue-300 hover:text-white">⏸</button>
            <button className="w-7 h-7 flex items-center justify-center text-blue-300 hover:text-white">⏭</button>
          </div>
        </div>
      </div>

      {/* Cold Take overlay */}
      <div className="absolute top-1/2 left-4 right-4 -translate-y-1/2">
        <div className="mx-auto px-5 py-3 rounded-2xl text-center"
          style={{ background: "rgba(15,23,42,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(34,211,238,0.2)" }}>
          <p className="text-[10px] uppercase tracking-[0.25em] mb-1.5 font-semibold" style={{ color: "rgba(103,232,249,0.8)" }}>❄ Cold Take</p>
          <p className="text-white text-sm italic font-light leading-snug">"Your nemesis: that little voice saying 'just get out.'"</p>
        </div>
      </div>

      {/* Bottom content */}
      <div className="absolute bottom-20 left-0 right-0 px-3 pb-2">

        {/* ── OPTION A: Benefit bar ABOVE the tiles ── */}
        <BenefitBar />

        {/* 3-column tile row */}
        <div className="grid grid-cols-3 gap-2.5 mb-2.5">
          {/* Water Temp */}
          <div className="bg-blue-900/75 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col">
            <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest mb-1">Water Temp</p>
            <div className="flex-1 flex items-center">
              <span className="text-white text-3xl font-bold leading-none">42°F</span>
            </div>
            <div className="flex bg-blue-800/70 rounded-lg p-0.5 gap-0.5 mt-2">
              <button className="flex-1 text-[11px] py-1 rounded-md font-bold bg-white text-blue-900">°F</button>
              <button className="flex-1 text-[11px] py-1 rounded-md font-bold text-blue-300">°C</button>
            </div>
          </div>

          {/* Timer */}
          <div className="bg-blue-900/75 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col items-center">
            <p className="text-blue-300 text-[9px] uppercase tracking-widest mb-1">Stopwatch</p>
            <div className="flex-1 flex items-center justify-center">
              <span className="text-white text-[2rem] leading-none font-mono font-bold">1:45</span>
            </div>
            <div className="flex gap-1 w-full mt-2">
              <button className="flex-1 bg-blue-500 text-white rounded-xl py-1.5 text-xs font-bold opacity-40">Start</button>
              <button className="flex-1 bg-slate-600/80 text-white rounded-xl py-1.5 text-xs font-bold border border-slate-500/50">Stop</button>
            </div>
          </div>

          {/* Cold Score */}
          <div className="bg-blue-900/75 backdrop-blur-md rounded-2xl p-3.5 border border-blue-700/40 flex flex-col items-center">
            <p className="text-blue-300 text-[10px] font-semibold uppercase tracking-widest text-center leading-tight mb-1">Cold<br/>Score</p>
            <div className="flex-1 flex flex-col items-center justify-center gap-1">
              <span className="text-cyan-300 font-bold text-2xl leading-none">4.4</span>
              <span className="text-cyan-400 text-lg">❄</span>
            </div>
            <p className="text-blue-400 text-[10px]">live</p>
          </div>
        </div>

        {/* Weekly goal */}
        <p className="text-center text-white/90 text-sm font-semibold tracking-wide"
          style={{ textShadow: "0 1px 6px rgba(0,0,0,0.8)" }}>
          Weekly: 14.2 / 30 min · Best: 12.6
        </p>
      </div>
    </div>
  );
}
