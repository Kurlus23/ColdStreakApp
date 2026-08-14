export function Interlude() {
  // Hardcoded state for mockup:
  // Goal = Metabolism (cumulative 300 s = 5:00 total)
  // Elapsed = 1:42 = 102 s  →  progress = 102/300 = 34%
  const GOAL_SECS = 300;
  const ELAPSED   = 102;
  const progress  = ELAPSED / GOAL_SECS; // 0.34

  const CX = 140, CY = 140, R = 126, STROKE = 9;
  const CIRC = 2 * Math.PI * R; // ≈ 791.7
  const dashOffset = CIRC * (1 - progress);

  // Live dot position along the arc (angle from top, clockwise)
  const angleRad = (progress * 2 * Math.PI) - Math.PI / 2;
  const dotX = CX + R * Math.cos(angleRad);
  const dotY = CY + R * Math.sin(angleRad);

  return (
    <div
      className="relative w-[390px] h-[844px] overflow-hidden flex flex-col items-center justify-between"
      style={{ background: "linear-gradient(to bottom, #0c2a42 0%, #071a2e 60%, #040f1e 100%)" }}
    >
      {/* Ambient glows */}
      <div className="absolute inset-0 pointer-events-none">
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-[420px] h-[420px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 65%)" }} />
        <div className="absolute top-[20%] left-[15%] w-[200px] h-[200px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(14,116,144,0.14) 0%, transparent 70%)" }} />
        <div className="absolute bottom-[20%] right-[10%] w-[180px] h-[180px] rounded-full"
          style={{ background: "radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)" }} />
      </div>

      {/* Wordmark */}
      <div className="w-full flex flex-col items-center pt-14 pb-2 z-10 shrink-0">
        <span
          className="text-xl font-black pointer-events-none select-none tracking-[0.2em]"
          style={{
            background: "linear-gradient(to bottom, #ffffff 0%, #a5f3fc 60%, #0891b2 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
            filter: "drop-shadow(0 2px 12px rgba(8,145,178,0.6))",
          }}
        >
          COLDSTREAK
        </span>
        <span className="text-[10px] font-medium uppercase tracking-[0.3em] text-cyan-400 mt-1 opacity-80">
          Brain Freeze Mode
        </span>
      </div>

      {/* Ring + timer hero */}
      <div className="relative flex-1 flex items-center justify-center w-full z-10 shrink-0" style={{ minHeight: 300 }}>
        {/* SVG Ring — shows progress toward Metabolism goal */}
        <svg
          viewBox="0 0 280 280"
          className="absolute"
          style={{ width: 280, height: 280 }}
        >
          <defs>
            <filter id="glow" x="-40%" y="-40%" width="180%" height="180%">
              <feGaussianBlur stdDeviation="4" result="blur" />
              <feMerge><feMergeNode in="blur" /><feMergeNode in="SourceGraphic" /></feMerge>
            </filter>
          </defs>

          {/* Track */}
          <circle cx={CX} cy={CY} r={R} fill="none"
            stroke="rgba(34,211,238,0.14)" strokeWidth={STROKE} />

          {/* Progress arc — goal-based (Metabolism = orange) */}
          <circle
            cx={CX} cy={CY} r={R} fill="none"
            stroke="#f97316"
            strokeWidth={STROKE}
            strokeLinecap="round"
            strokeDasharray={`${CIRC} ${CIRC}`}
            strokeDashoffset={dashOffset}
            transform={`rotate(-90 ${CX} ${CY})`}
            style={{ filter: "drop-shadow(0 0 10px rgba(249,115,22,0.7))" }}
          />

          {/* Target marker at 12 o'clock (top) — goal label */}
          <circle cx={CX} cy={CY - R} r={5} fill="#fb7185"
            style={{ filter: "drop-shadow(0 0 6px rgba(244,63,94,0.9))" }} />
          <text
            x={CX} y={CY - R - 11}
            textAnchor="middle"
            fill="rgba(251,113,133,0.9)"
            fontSize="9" fontFamily="sans-serif" fontWeight="700" letterSpacing="0.06em"
          >
            🔥 1:58
          </text>

          {/* Live dot */}
          <circle cx={dotX} cy={dotY} r={6} fill="#fb923c"
            style={{ filter: "drop-shadow(0 0 10px rgba(249,115,22,1))" }} />
        </svg>

        {/* Timer inside ring */}
        <div className="relative z-10 flex flex-col items-center gap-0.5">
          <div
            className="font-mono font-bold text-white leading-none tracking-tighter"
            style={{ fontSize: "4.5rem", filter: "drop-shadow(0 0 18px rgba(34,211,238,0.5))" }}
          >
            01:42
          </div>
        </div>
      </div>

      {/* Cold Take — with centered Brain Freeze countdown pill */}
      <div className="w-full px-5 pb-3 z-10 shrink-0">
        <div
          className="w-full rounded-xl px-4 pt-3 pb-7 backdrop-blur-sm relative"
          style={{
            background: "rgba(6,182,212,0.06)",
            border: "1px solid rgba(34,211,238,0.18)",
          }}
        >
          <div className="text-[9px] font-bold uppercase tracking-[0.25em] text-cyan-300 mb-1">
            ❄ Cold Take
          </div>
          <p className="text-white text-[13px] italic font-light leading-snug">
            "Your nemesis: that little voice saying 'just get out.'"
          </p>

          {/* Brain Freeze countdown — centered bottom of card */}
          <div
            style={{
              position: "absolute",
              bottom: 8,
              left: "50%",
              transform: "translateX(-50%)",
              background: "rgba(6,182,212,0.15)",
              border: "1px solid rgba(34,211,238,0.45)",
              borderRadius: 999,
              padding: "3px 14px",
              display: "flex",
              alignItems: "center",
              gap: 6,
              whiteSpace: "nowrap",
              fontSize: 11,
              color: "#94a3b8",
            }}
          >
            🧠 Brain Freeze in{" "}
            <strong style={{ fontSize: 13, fontWeight: 700, color: "#22d3ee" }}>3</strong>
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div className="w-full z-10 shrink-0 px-6 pb-10 flex flex-col gap-4">

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
            <span className="text-slate-500 text-[9px] uppercase tracking-widest font-semibold mb-0.5">Live Temp</span>
            <span className="text-slate-500 text-2xl font-bold tracking-tight">39°F</span>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-cyan-400 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Cold Score</span>
            <span className="text-cyan-300 text-2xl font-bold tracking-tight">4.2</span>
          </div>
          <div className="w-px h-10 bg-gradient-to-b from-transparent via-slate-600 to-transparent" />
          <div className="flex flex-col items-center">
            <span className="text-amber-400 text-[9px] uppercase tracking-widest mb-0.5 font-semibold">Personal Best</span>
            <span className="text-amber-300 text-2xl font-bold tracking-tight">6.1</span>
          </div>
        </div>

        {/* Benefit bar — correct segment colors */}
        <div>
          <div className="flex gap-1.5 h-2">
            {/* Energy — fully earned, cyan */}
            <div className="flex-1 rounded-full relative overflow-hidden"
              style={{ background: "#164e6318", border: "1px solid #22d3eecc", boxShadow: "0 0 0 1px #22d3eecc" }}>
              <div className="absolute inset-0 rounded-full"
                style={{ background: "#22d3ee", boxShadow: "0 0 6px 1px #22d3ee66" }} />
            </div>
            {/* Mood — 70% filled, amber */}
            <div className="flex-1 rounded-full relative overflow-hidden"
              style={{ background: "#78350f44" }}>
              <div className="absolute inset-y-0 left-0 rounded-full"
                style={{ width: "70%", background: "#fbbf24", boxShadow: "0 0 6px 1px #fbbf2466" }} />
            </div>
            {/* Metabolism — empty, orange-dim */}
            <div className="flex-1 rounded-full"
              style={{ background: "#7c2d1244" }} />
            {/* Recovery — empty, green-dim */}
            <div className="flex-1 rounded-full"
              style={{ background: "#064e3b44" }} />
          </div>
          <div className="mt-1 flex justify-between text-[9px] text-slate-500">
            <span style={{ color: "#22d3ee" }}>⚡ Energy</span>
            <span style={{ color: "#fbbf24bb" }}>😊 Mood</span>
            <span style={{ color: "#1e3a5f" }}>🔥 Metabolism</span>
            <span style={{ color: "#1e3a5f" }}>💪 Recovery</span>
          </div>
        </div>

        {/* STOP button */}
        <button type="button" className="w-full relative">
          <div className="absolute inset-0 bg-red-600 rounded-2xl blur-lg opacity-50" />
          <div className="relative font-bold py-5 rounded-2xl text-xl tracking-wider text-white"
            style={{
              background: "linear-gradient(to bottom, #ef4444, #b91c1c)",
              border: "1px solid rgba(248,113,113,0.4)",
              boxShadow: "inset 0 2px 10px rgba(255,255,255,0.15)",
            }}>
            STOP
          </div>
        </button>
      </div>
    </div>
  );
}
