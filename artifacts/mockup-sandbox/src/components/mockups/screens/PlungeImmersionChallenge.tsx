// Active plunge — Immersion variant with challenge ring
// Concept: the circular ring IS the challenge bar.
// Two concentric arcs — outer = Jake (challenger), inner = You.
// Fill is based on cold score vs personal best, so both arcs
// represent real progress on the same scale. Who's ahead is instant.

const PERSONAL_BEST = 21.1;
const JAKE_SCORE    = 8.4;   // challenger's current score
const MY_SCORE      = 4.2;   // your current score

const JAKE_PCT = Math.min(1, JAKE_SCORE / PERSONAL_BEST);
const MY_PCT   = Math.min(1, MY_SCORE   / PERSONAL_BEST);
const WINNING  = MY_SCORE >= JAKE_SCORE;

// SVG geometry
const CX = 160;
const CY = 160;
const R_JAKE = 136; // outer arc — challenger
const R_ME   = 118; // inner arc — you
const STROKE = 9;

const BENEFIT_SEGMENTS = [
  { id: "energy",     emoji: "⚡", label: "Energy",     fill: 100, bar: "#22d3ee", dim: "#0e3d4d55" },
  { id: "mood",       emoji: "😊", label: "Mood",       fill: 68,  bar: "#fbbf24", dim: "#4a2c0055" },
  { id: "metabolism", emoji: "🔥", label: "Metabolism", fill: 0,   bar: "#f97316", dim: "#3d160055" },
  { id: "recovery",   emoji: "💪", label: "Recovery",   fill: 0,   bar: "#34d399", dim: "#023d2555" },
] as const;

function arcDash(r: number, pct: number) {
  const circ = 2 * Math.PI * r;
  return { strokeDasharray: circ, strokeDashoffset: circ * (1 - pct) };
}

function leadingDot(r: number, pct: number) {
  const angle = pct * 2 * Math.PI - Math.PI / 2;
  return { cx: CX + r * Math.cos(angle), cy: CY + r * Math.sin(angle) };
}

function ChallengeRing() {
  const jakeDash = arcDash(R_JAKE, JAKE_PCT);
  const meDash   = arcDash(R_ME,   MY_PCT);
  const jakeDot  = leadingDot(R_JAKE, JAKE_PCT);
  const meDot    = leadingDot(R_ME,   MY_PCT);

  return (
    <svg
      viewBox="0 0 320 320"
      className="w-[320px] h-[320px] absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2"
    >
      {/* Track rings */}
      <circle cx={CX} cy={CY} r={R_JAKE} fill="none" stroke="rgba(251,113,133,0.1)" strokeWidth={STROKE} />
      <circle cx={CX} cy={CY} r={R_ME}   fill="none" stroke="rgba(34,211,238,0.1)"  strokeWidth={STROKE} />

      {/* Jake's arc (outer, rose) */}
      <circle
        cx={CX} cy={CY} r={R_JAKE}
        fill="none"
        stroke="url(#jake-grad)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        {...jakeDash}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ filter: "drop-shadow(0 0 6px rgba(244,63,94,0.5))" }}
      />
      {/* Jake's leading dot */}
      <circle
        cx={jakeDot.cx} cy={jakeDot.cy} r={5}
        fill="#fb7185"
        style={{ filter: "drop-shadow(0 0 5px rgba(244,63,94,0.8))" }}
      />

      {/* Your arc (inner, cyan) */}
      <circle
        cx={CX} cy={CY} r={R_ME}
        fill="none"
        stroke="url(#me-grad)"
        strokeWidth={STROKE}
        strokeLinecap="round"
        {...meDash}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ filter: "drop-shadow(0 0 8px rgba(34,211,238,0.55))" }}
      />
      {/* My leading dot with pulse */}
      <circle
        cx={meDot.cx} cy={meDot.cy} r={5}
        fill="#22d3ee"
        style={{ filter: "drop-shadow(0 0 6px rgba(34,211,238,0.9))" }}
      />

      {/* Legend labels on ring at 3 o'clock */}
      <text x={CX + R_JAKE + 14} y={CY - 4}  textAnchor="start" fill="rgba(251,113,133,0.7)" fontSize="9" fontFamily="sans-serif" fontWeight="700">JAKE</text>
      <text x={CX + R_ME  + 14} y={CY + 10} textAnchor="start" fill="rgba(34,211,238,0.7)"  fontSize="9" fontFamily="sans-serif" fontWeight="700">YOU</text>

      <defs>
        <linearGradient id="jake-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#fb7185" />
          <stop offset="100%" stopColor="#f43f5e" />
        </linearGradient>
        <linearGradient id="me-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0e7490" />
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
                style={{ color: done || active ? seg.bar : "#1a3050" }}>
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
    <div className="w-[390px] h-[844px] relative overflow-hidden font-sans select-none flex flex-col bg-[#030c14]">

      {/* Ambient glow — dual colour to hint at the rivalry */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-[8%] left-[35%] -translate-x-1/2 w-[280px] h-[280px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.1) 0%, transparent 70%)" }} />
        <div className="absolute top-[8%] left-[65%] -translate-x-1/2 w-[280px] h-[280px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(244,63,94,0.07) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[15%] left-1/2 -translate-x-1/2 w-[240px] h-[240px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(14,116,144,0.07) 0%, transparent 70%)" }} />
      </div>

      {/* Wordmark */}
      <div className="w-full flex justify-center pt-14 z-10 shrink-0">
        <span
          className="text-lg font-black tracking-[0.22em] select-none"
          style={{
            background: "linear-gradient(to bottom, #e0f2fe 0%, #67e8f9 55%, #0e7490 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 1px 8px rgba(6,182,212,0.4))",
          }}
        >
          COLDSTREAK
        </span>
      </div>

      {/* Challenge ring + timer hero */}
      <div className="relative flex-1 flex items-center justify-center z-10 shrink-0" style={{ minHeight: 0 }}>
        <ChallengeRing />

        {/* Timer + status inside ring */}
        <div className="relative z-10 flex flex-col items-center gap-0.5">
          <div
            className="font-mono font-bold text-white leading-none tracking-tighter"
            style={{ fontSize: "5rem", filter: "drop-shadow(0 0 14px rgba(34,211,238,0.4))" }}
          >
            2:14
          </div>
          <div className="text-[9px] uppercase tracking-[0.18em] font-semibold mt-0.5"
            style={{ color: "rgba(103,232,249,0.55)" }}>
            Stopwatch
          </div>
          {/* Race status */}
          <div
            className="mt-2 px-3 py-0.5 rounded-full text-[10px] font-bold tracking-wide"
            style={{
              background: WINNING ? "rgba(34,211,238,0.1)" : "rgba(251,113,133,0.1)",
              border: WINNING ? "1px solid rgba(34,211,238,0.25)" : "1px solid rgba(251,113,133,0.25)",
              color: WINNING ? "rgba(103,232,249,0.9)" : "rgba(251,113,133,0.9)",
            }}
          >
            {WINNING
              ? "You're ahead ❄️"
              : `${(JAKE_SCORE - MY_SCORE).toFixed(1)} pts behind`}
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div
        className="w-full z-10 shrink-0 px-4 pt-4 pb-8 flex flex-col gap-3"
        style={{
          background: "rgba(5,16,27,0.88)",
          backdropFilter: "blur(20px)",
          borderTop: "1px solid rgba(34,211,238,0.08)",
        }}
      >
        {/* Stats row */}
        <div className="flex items-center justify-between px-1">
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1 mb-0.5">
              <span className="relative flex h-1.5 w-1.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-cyan-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-cyan-300" />
              </span>
              <span className="text-slate-500 text-[9px] uppercase tracking-widest font-semibold">Live Temp</span>
            </div>
            <span className="text-white text-2xl font-bold tracking-tight">44°F</span>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-cyan-500 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Cold Score</span>
            <span className="text-cyan-300 text-2xl font-bold tracking-tight">4.2</span>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-700 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-amber-500 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Personal Best</span>
            <span className="text-amber-400 text-2xl font-bold tracking-tight"
              style={{ textShadow: "0 0 12px rgba(251,191,36,0.3)" }}>21.1</span>
          </div>
        </div>

        {/* Benefit bar */}
        <BenefitBar />

        {/* Music transport */}
        <div
          className="flex items-center gap-2 px-3 py-2 rounded-2xl w-full"
          style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.07)" }}
        >
          <div className="w-6 h-6 rounded-lg bg-gradient-to-br from-pink-500 to-rose-600 flex items-center justify-center text-white text-[10px] shrink-0">♫</div>
          <span className="text-slate-300 text-xs font-medium flex-1 truncate">Road Rage</span>
          <div className="flex items-center gap-0.5">
            <button className="w-7 h-7 flex items-center justify-center text-slate-400 text-xs">⏮</button>
            <button className="w-7 h-7 flex items-center justify-center text-slate-300 text-xs">⏸</button>
            <button className="w-7 h-7 flex items-center justify-center text-slate-400 text-xs">⏭</button>
          </div>
        </div>

        {/* Stop button */}
        <div className="w-full relative mt-1">
          <div className="absolute inset-0 bg-red-700 rounded-2xl blur-xl opacity-40" />
          <button
            className="relative w-full bg-gradient-to-b from-red-500 to-red-700 border border-red-400/40 text-white font-bold py-5 rounded-2xl text-xl tracking-wider"
            style={{ boxShadow: "inset 0 2px 10px rgba(255,255,255,0.25)" }}
          >
            STOP
          </button>
        </div>
      </div>
    </div>
  );
}
