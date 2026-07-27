// Active plunge — Immersion + Challenge
// Single ring = your progress toward beating Jake's score.
// Full ring = you've beaten him.

const JAKE_SCORE = 8.4;
const MY_SCORE   = 4.2;
const WINNING    = MY_SCORE >= JAKE_SCORE;
const PROGRESS   = Math.min(1, MY_SCORE / JAKE_SCORE);

const CX = 160;
const CY = 160;
const R  = 128;
const STROKE = 10;
const CIRC = 2 * Math.PI * R;

function anglePt(r: number, pct: number) {
  const a = pct * 2 * Math.PI - Math.PI / 2;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

const BENEFIT_SEGMENTS = [
  { id: "energy",     emoji: "⚡", label: "Energy",     fill: 100, bar: "#22d3ee", dim: "#0e3d4d66" },
  { id: "mood",       emoji: "😊", label: "Mood",       fill: 68,  bar: "#fbbf24", dim: "#4a2c0066" },
  { id: "metabolism", emoji: "🔥", label: "Metabolism", fill: 0,   bar: "#f97316", dim: "#3d160066" },
  { id: "recovery",   emoji: "💪", label: "Recovery",   fill: 0,   bar: "#34d399", dim: "#02432566" },
] as const;

function ChallengeRing() {
  const dot = anglePt(R, PROGRESS);

  return (
    <svg
      viewBox="0 0 320 320"
      className="w-[320px] h-[320px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
    >
      {/* Track */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="rgba(34,211,238,0.14)"
        strokeWidth={STROKE}
      />

      {/* Progress arc */}
      <circle
        cx={CX} cy={CY} r={R}
        fill="none"
        stroke="url(#progress-grad)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        strokeDasharray={CIRC}
        strokeDashoffset={CIRC * (1 - PROGRESS)}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ filter: "drop-shadow(0 0 10px rgba(34,211,238,0.55))" }}
      />

      {/* Jake's target marker at 12 o'clock */}
      <circle cx={CX} cy={CY - R} r={5} fill="#fb7185"
        style={{ filter: "drop-shadow(0 0 6px rgba(244,63,94,0.9))" }} />
      <text
        x={CX} y={CY - R - 11}
        textAnchor="middle"
        fill="rgba(251,113,133,0.85)"
        fontSize="9"
        fontFamily="sans-serif"
        fontWeight="700"
        letterSpacing="0.06em"
      >
        JAKE {JAKE_SCORE}
      </text>

      {/* Live leading dot */}
      <circle cx={dot.x} cy={dot.y} r={6} fill="#22d3ee"
        style={{ filter: "drop-shadow(0 0 10px rgba(34,211,238,1))" }} />

      <defs>
        <linearGradient id="progress-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%"   stopColor="#0e7490" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  );
}

function BenefitBar() {
  return (
    <div className="space-y-1.5 w-full">
      <p className="text-center text-[10px] font-semibold tracking-wide" style={{ color: "#fbbf24" }}>
        😊 Mood filling…
      </p>
      <div className="flex gap-1.5 w-full">
        {BENEFIT_SEGMENTS.map((seg) => {
          const done   = seg.fill >= 100;
          const active = seg.fill > 0 && seg.fill < 100;
          return (
            <div key={seg.id} className="flex-1 min-w-0 space-y-1">
              <div className="relative h-1.5 rounded-full overflow-hidden" style={{ backgroundColor: seg.dim }}>
                <div
                  className="absolute inset-y-0 left-0 rounded-full"
                  style={{
                    width: `${seg.fill}%`,
                    backgroundColor: seg.bar,
                    opacity: done ? 1 : active ? 0.9 : 0,
                    boxShadow: active ? `0 0 5px 1px ${seg.bar}55` : "none",
                  }}
                />
              </div>
              <p className="text-center text-[9px] font-semibold leading-none truncate"
                style={{ color: done || active ? seg.bar : "#2a4a6a" }}>
                {seg.emoji} {seg.label}
              </p>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export function PlungeImmersionChallenge() {
  return (
    <div className="w-[390px] h-[844px] relative overflow-hidden font-sans select-none flex flex-col"
      style={{ background: "linear-gradient(to bottom, #0c2a42 0%, #071a2e 60%, #040f1e 100%)" }}>

      {/* Ambient glows — much brighter */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 65%)" }} />
        <div className="absolute top-[20%] left-[20%] w-[200px] h-[200px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(14,116,144,0.15) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[20%] right-[10%] w-[180px] h-[180px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)" }} />
      </div>

      {/* Wordmark */}
      <div className="w-full flex justify-center pt-14 z-10 shrink-0">
        <span
          className="text-lg font-black tracking-[0.22em] select-none"
          style={{
            background: "linear-gradient(to bottom, #ffffff 0%, #a5f3fc 55%, #0891b2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 2px 12px rgba(6,182,212,0.6))",
          }}
        >
          COLDSTREAK
        </span>
      </div>

      {/* Ring + timer hero */}
      <div className="relative flex-1 flex items-center justify-center z-10 shrink-0" style={{ minHeight: 0 }}>
        <ChallengeRing />

        <div className="relative z-10 flex flex-col items-center gap-0.5">
          <div
            className="font-mono font-bold text-white leading-none tracking-tighter"
            style={{ fontSize: "5rem", filter: "drop-shadow(0 0 18px rgba(34,211,238,0.5))" }}
          >
            2:14
          </div>
          <div className="text-[9px] uppercase tracking-[0.18em] font-semibold mt-0.5"
            style={{ color: "rgba(147,210,230,0.7)" }}>
            Stopwatch
          </div>
          {/* Race status pill */}
          <div
            className="mt-2 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
            style={{
              background: WINNING ? "rgba(34,211,238,0.15)" : "rgba(251,113,133,0.15)",
              border: WINNING ? "1px solid rgba(34,211,238,0.4)" : "1px solid rgba(251,113,133,0.4)",
              color: WINNING ? "#67e8f9" : "#fda4af",
            }}
          >
            {WINNING ? "You beat Jake! ❄️" : `${(JAKE_SCORE - MY_SCORE).toFixed(1)} pts to beat Jake`}
          </div>
        </div>
      </div>

      {/* Cold Take — floats between ring and HUD */}
      <div className="w-full px-5 pb-3 z-10 shrink-0">
        <div
          className="w-full px-5 py-3 rounded-2xl text-center"
          style={{
            background: "rgba(12,42,66,0.6)",
            backdropFilter: "blur(12px)",
            border: "1px solid rgba(34,211,238,0.18)",
          }}
        >
          <p className="text-[10px] uppercase tracking-[0.25em] mb-1 font-semibold"
            style={{ color: "rgba(103,232,249,0.7)" }}>❄ Cold Take</p>
          <p className="text-slate-200 text-sm italic font-light leading-snug">
            "The pain is temporary. The pride is permanent."
          </p>
        </div>
      </div>

      {/* Bottom HUD */}
      <div
        className="w-full z-10 shrink-0 px-4 pt-4 pb-8 flex flex-col gap-3"
        style={{
          background: "rgba(4,15,30,0.75)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(34,211,238,0.12)",
        }}
      >
        {/* Stats */}
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-300" />
              </span>
              <span className="text-slate-400 text-[9px] uppercase tracking-widest font-semibold">Live Temp</span>
            </div>
            <span className="text-white text-2xl font-bold tracking-tight">44°F</span>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-cyan-400 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Cold Score</span>
            <span className="text-cyan-300 text-2xl font-bold tracking-tight">{MY_SCORE}</span>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-amber-400 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Personal Best</span>
            <span className="text-amber-300 text-2xl font-bold tracking-tight"
              style={{ textShadow: "0 0 12px rgba(251,191,36,0.35)" }}>21.1</span>
          </div>
        </div>

        {/* Benefit bar */}
        <BenefitBar />

        {/* Music */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-2xl w-full"
          style={{ background: "rgba(255,255,255,0.06)", border: "1px solid rgba(255,255,255,0.1)" }}
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-[10px] shrink-0">♫</div>
          <span className="text-slate-200 text-xs font-medium flex-1 truncate">Road Rage</span>
          <div className="flex items-center gap-0.5">
            <button className="w-7 h-7 flex items-center justify-center text-slate-400 text-xs">⏮</button>
            <button className="w-7 h-7 flex items-center justify-center text-slate-200 text-xs">⏸</button>
            <button className="w-7 h-7 flex items-center justify-center text-slate-400 text-xs">⏭</button>
          </div>
        </div>

        {/* Stop */}
        <div className="w-full relative mt-1">
          <div className="absolute inset-0 bg-red-600 rounded-2xl blur-xl opacity-50" />
          <button
            className="relative w-full bg-gradient-to-b from-red-500 to-red-700 border border-red-400/50 text-white font-bold py-5 rounded-2xl text-xl tracking-wider"
            style={{ boxShadow: "inset 0 2px 10px rgba(255,255,255,0.3)" }}
          >
            STOP
          </button>
        </div>
      </div>
    </div>
  );
}
