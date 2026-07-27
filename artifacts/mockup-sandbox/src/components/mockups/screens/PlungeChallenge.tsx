// Active plunge overlay — challenge mode with race progress bar

const BENEFIT_SEGMENTS = [
  { id: "energy",     emoji: "⚡", label: "Energy",     fill: 100, bar: "#22d3ee", dim: "#164e6344" },
  { id: "mood",       emoji: "😊", label: "Mood",       fill: 68,  bar: "#fbbf24", dim: "#78350f44" },
  { id: "metabolism", emoji: "🔥", label: "Metabolism", fill: 0,   bar: "#f97316", dim: "#7c2d1244" },
  { id: "recovery",   emoji: "💪", label: "Recovery",   fill: 0,   bar: "#34d39944", dim: "#064e3b44" },
] as const;

const PERSONAL_BEST = 21.1;
const JAKE_SCORE = 8.4;
const MY_SCORE = 4.2;

function BenefitBar() {
  return (
    <div className="space-y-1 w-full">
      <p className="text-center text-[11px] font-semibold tracking-wide" style={{ color: "#fbbf24", minHeight: "1rem" }}>
        😊 Mood filling…
      </p>
      <div className="flex gap-1.5 w-full">
        {BENEFIT_SEGMENTS.map((seg) => {
          const done = seg.fill >= 100;
          const active = seg.fill > 0 && seg.fill < 100;
          return (
            <div key={seg.id} className="flex-1 min-w-0 space-y-1">
              <div className="relative h-2 rounded-full overflow-hidden" style={{ backgroundColor: seg.dim }}>
                <div className="absolute inset-y-0 left-0 rounded-full" style={{
                  width: `${seg.fill}%`, backgroundColor: seg.bar,
                  opacity: done ? 1 : active ? 0.9 : 0,
                  boxShadow: active ? `0 0 6px 1px ${seg.bar}66` : "none",
                }} />
              </div>
              <p className="text-center text-[9px] font-semibold leading-none truncate"
                style={{ color: done || active ? seg.bar : "#1e3a5f" }}>
                {seg.emoji} {seg.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ChallengeBar() {
  const jakePercent = Math.min(100, (JAKE_SCORE / PERSONAL_BEST) * 100);
  const myPercent   = Math.min(100, (MY_SCORE   / PERSONAL_BEST) * 100);
  const winning = MY_SCORE >= JAKE_SCORE;

  return (
    <div className="w-full rounded-2xl px-4 py-2.5 space-y-2"
      style={{ background: "rgba(15,23,42,0.65)", backdropFilter: "blur(8px)", border: "1px solid rgba(251,113,133,0.2)" }}>
      <p className="text-center text-[10px] uppercase tracking-[0.2em] font-bold" style={{ color: "rgba(251,113,133,0.9)" }}>
        ⚡ Challenge
      </p>

      {/* Jake's bar */}
      <div className="flex items-center gap-2">
        <span className="text-rose-300 text-[10px] font-bold w-8 shrink-0 text-right">Jake</span>
        <div className="flex-1 relative h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(251,113,133,0.15)" }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{ width: `${jakePercent}%`, background: "linear-gradient(to right, #fb7185, #f43f5e)", boxShadow: "0 0 8px rgba(244,63,94,0.6)" }} />
        </div>
        <span className="text-rose-300 text-[11px] font-bold w-7 shrink-0">{JAKE_SCORE}</span>
      </div>

      {/* My bar (live) */}
      <div className="flex items-center gap-2">
        <span className="text-cyan-300 text-[10px] font-bold w-8 shrink-0 text-right">You</span>
        <div className="flex-1 relative h-2.5 rounded-full overflow-hidden" style={{ backgroundColor: "rgba(34,211,238,0.15)" }}>
          <div className="absolute inset-y-0 left-0 rounded-full transition-all"
            style={{ width: `${myPercent}%`, background: "linear-gradient(to right, #22d3ee, #06b6d4)", boxShadow: "0 0 8px rgba(34,211,238,0.6)" }} />
          {/* Live pulse dot */}
          <div className="absolute top-1/2 -translate-y-1/2 -translate-x-1/2 w-2.5 h-2.5 rounded-full bg-cyan-300"
            style={{ left: `${myPercent}%`, boxShadow: "0 0 6px rgba(34,211,238,0.9)" }}>
            <div className="absolute inset-0 rounded-full bg-cyan-400 animate-ping opacity-75" />
          </div>
        </div>
        <span className="text-cyan-300 text-[11px] font-bold w-7 shrink-0">{MY_SCORE}</span>
      </div>

      {/* Status line */}
      <p className="text-center text-[10px] font-semibold"
        style={{ color: winning ? "rgba(34,211,238,0.8)" : "rgba(251,113,133,0.8)" }}>
        {winning ? "You're ahead! Keep going ❄️" : `${(JAKE_SCORE - MY_SCORE).toFixed(1)} pts behind — push through`}
      </p>
    </div>
  );
}

export function PlungeChallenge() {
  return (
    <div className="w-[390px] h-[844px] relative overflow-hidden font-sans select-none flex flex-col items-center justify-between bg-[#0c1a2e]">
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_0%,rgba(6,182,212,0.22),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_50%_100%,rgba(14,165,233,0.15),transparent_60%)] pointer-events-none" />
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_100%_50%,rgba(251,113,133,0.07),transparent_55%)] pointer-events-none" />

      {/* Top */}
      <div className="w-full flex flex-col items-center pt-14 pb-3 z-10">
        <span className="text-2xl font-black tracking-[0.2em] mb-3"
          style={{ background: "linear-gradient(to bottom,#fff 0%,#a5f3fc 60%,#0891b2 100%)", WebkitBackgroundClip:"text", WebkitTextFillColor:"transparent", backgroundClip:"text", filter:"drop-shadow(0 2px 12px rgba(8,145,178,0.6))" }}>
          COLDSTREAK
        </span>
        <div className="px-4 py-1.5 rounded-full border border-cyan-500/30 text-cyan-300 text-[10px] font-bold uppercase tracking-[0.15em]"
          style={{ background: "rgba(6,182,212,0.1)", boxShadow: "0 0 15px rgba(6,182,212,0.2)" }}>
          Stopwatch
        </div>
      </div>

      {/* Center */}
      <div className="flex-1 flex flex-col items-center justify-center w-full z-10 gap-3 px-6">
        <div className="font-mono font-bold text-white leading-none tracking-tighter"
          style={{ fontSize: "108px", filter: "drop-shadow(0 0 20px rgba(6,182,212,0.4))" }}>
          2:14
        </div>

        {/* Cold Take */}
        <div className="w-full px-5 py-2.5 rounded-2xl text-center"
          style={{ background: "rgba(15,23,42,0.7)", backdropFilter: "blur(8px)", border: "1px solid rgba(34,211,238,0.2)" }}>
          <p className="text-[10px] uppercase tracking-[0.25em] mb-1 font-semibold" style={{ color: "rgba(103,232,249,0.8)" }}>❄ Cold Take</p>
          <p className="text-white text-sm italic font-light leading-snug">"The pain is temporary. The pride is permanent."</p>
        </div>

        {/* Challenge race bar */}
        <ChallengeBar />

        {/* Benefit bar */}
        <BenefitBar />
      </div>

      {/* Bottom */}
      <div className="w-full flex flex-col items-center gap-4 pb-10 z-10 px-6">
        {/* Stats row — 3 cols (no challenger column here anymore) */}
        <div className="flex items-center justify-between w-full px-1">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-1">
              <span className="relative flex h-2 w-2">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2 w-2 bg-cyan-300" />
              </span>
              <span className="text-slate-400 text-[10px] uppercase tracking-widest font-semibold">Live Temp</span>
            </div>
            <span className="text-white text-3xl font-bold tracking-tight">44°F</span>
          </div>
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-cyan-400 text-[10px] uppercase tracking-widest mb-1 font-semibold">Cold Score</span>
            <span className="text-cyan-300 text-3xl font-bold tracking-tight">4.2</span>
          </div>
          <div className="w-px h-12 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-amber-400 text-[10px] uppercase tracking-widest mb-1 font-semibold">Personal Best</span>
            <span className="text-amber-400 text-3xl font-bold tracking-tight" style={{ textShadow: "0 0 15px rgba(251,191,36,0.3)" }}>21.1</span>
          </div>
        </div>

        {/* Music */}
        <div className="flex items-center gap-2 bg-blue-900/60 border border-blue-700/40 rounded-2xl px-3 py-2 w-full">
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-[10px] shrink-0">♫</div>
          <span className="text-blue-200 text-xs font-medium flex-1 truncate">Road Rage</span>
          <div className="flex items-center gap-0.5">
            <button className="w-7 h-7 flex items-center justify-center text-blue-300 text-xs">⏮</button>
            <button className="w-7 h-7 flex items-center justify-center text-blue-300 text-xs">⏸</button>
            <button className="w-7 h-7 flex items-center justify-center text-blue-300 text-xs">⏭</button>
          </div>
        </div>

        {/* Stop */}
        <div className="w-full relative">
          <div className="absolute inset-0 bg-red-600 rounded-2xl blur-lg opacity-50" />
          <button className="relative w-full bg-gradient-to-b from-red-500 to-red-700 border border-red-400/50 text-white font-bold py-4 rounded-2xl text-xl tracking-wider"
            style={{ boxShadow: "inset 0 2px 10px rgba(255,255,255,0.3)" }}>
            STOP
          </button>
        </div>
      </div>
    </div>
  );
}
