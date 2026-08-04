// Self-contained mockup — Plunge Screen in Solo / Normal Mode
// No ring. Timer floats freely. Benefit bar carries the countdown.

export function NormalMode() {
  const segs = [
    { label: "⚡ Energy",     color: "#22d3ee", dimColor: "#164e63", pct: 1.00 },
    { label: "😊 Mood",       color: "#fbbf24", dimColor: "#78350f", pct: 0.85 },
    { label: "🔥 Metabolism", color: "#f97316", dimColor: "#7c2d12", pct: 0.52 },
    { label: "💪 Recovery",   color: "#34d399", dimColor: "#064e3b", pct: 0.00 },
  ];
  const activeIdx = 2;
  const activeColor = segs[activeIdx].color;

  return (
    <div
      style={{
        width: "100%", height: "100vh",
        background: "linear-gradient(to bottom, #0c2a42 0%, #071a2e 60%, #040f1e 100%)",
        display: "flex", flexDirection: "column", alignItems: "center",
        justifyContent: "space-between", overflow: "hidden", position: "relative",
        fontFamily: "'Inter', system-ui, sans-serif",
      }}
    >
      {/* Ambient glows */}
      <div style={{ position: "absolute", inset: 0, pointerEvents: "none" }}>
        <div style={{
          position: "absolute", top: 0, left: "50%", transform: "translateX(-50%)",
          width: 420, height: 420, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.22) 0%, transparent 65%)",
        }} />
        <div style={{
          position: "absolute", top: "20%", left: "15%",
          width: 200, height: 200, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(14,116,144,0.14) 0%, transparent 70%)",
        }} />
        <div style={{
          position: "absolute", bottom: "20%", right: "10%",
          width: 180, height: 180, borderRadius: "50%",
          background: "radial-gradient(circle, rgba(6,182,212,0.09) 0%, transparent 70%)",
        }} />
      </div>

      {/* Wordmark */}
      <div style={{ width: "100%", display: "flex", flexDirection: "column", alignItems: "center", paddingTop: 56, paddingBottom: 8, zIndex: 10 }}>
        <span style={{
          fontSize: 20, fontWeight: 900, letterSpacing: "0.2em",
          background: "linear-gradient(to bottom, #ffffff 0%, #a5f3fc 60%, #0891b2 100%)",
          WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent",
          filter: "drop-shadow(0 2px 12px rgba(8,145,178,0.6))",
        }}>COLDSTREAK</span>
      </div>

      {/* Timer hero — no ring, just the number floating */}
      <div style={{
        position: "relative", flex: 1, display: "flex",
        alignItems: "center", justifyContent: "center",
        width: "100%", zIndex: 10, minHeight: 300,
      }}>
        <div style={{ display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          <div style={{
            fontFamily: "monospace", fontWeight: 700, color: "white",
            fontSize: "4.5rem", lineHeight: 1, letterSpacing: "-0.04em",
            filter: "drop-shadow(0 0 18px rgba(34,211,238,0.5))",
          }}>4:32</div>
        </div>
      </div>

      {/* Cold Take */}
      <div style={{ width: "100%", padding: "0 20px 12px", zIndex: 10 }}>
        <div style={{
          borderRadius: 14, padding: "10px 14px",
          background: "rgba(6,182,212,0.06)", border: "1px solid rgba(34,211,238,0.10)",
          backdropFilter: "blur(8px)", textAlign: "center",
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(103,232,249,0.7)", marginBottom: 6 }}>❄ Cold Take</div>
          <div style={{ color: "rgba(226,232,240,0.85)", fontSize: 11, fontStyle: "italic", lineHeight: 1.5 }}>
            "The cold doesn't get easier — you just get tougher."
          </div>
        </div>
      </div>

      {/* Bottom HUD */}
      <div style={{ width: "100%", zIndex: 10, padding: "0 24px 40px", display: "flex", flexDirection: "column", gap: 12 }}>

        {/* Stats row */}
        <div style={{
          display: "flex", alignItems: "center", justifyContent: "space-between",
          padding: "12px 20px", borderRadius: 16,
          background: "rgba(6,182,212,0.07)", border: "1px solid rgba(34,211,238,0.12)",
          backdropFilter: "blur(8px)",
        }}>
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, color: "#22c55e", marginBottom: 2 }}>Live Temp</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>38°F</span>
          </div>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, transparent, #475569, transparent)" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, color: "#22d3ee", marginBottom: 2 }}>Cold Score</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#67e8f9", letterSpacing: "-0.02em" }}>87.4</span>
          </div>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, transparent, #475569, transparent)" }} />
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, color: "#fbbf24", marginBottom: 2 }}>Personal Best</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#fcd34d", letterSpacing: "-0.02em" }}>112.5</span>
          </div>
        </div>

        {/* Benefit bar with countdown header */}
        <div style={{
          borderRadius: 12, padding: "8px 14px",
          background: "rgba(6,182,212,0.05)", border: "1px solid rgba(34,211,238,0.08)",
          backdropFilter: "blur(8px)",
        }}>
          {/* Countdown header */}
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 6 }}>
            <span style={{ fontSize: 9, color: activeColor, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.1em" }}>
              🔥 Metabolism — 2:24 remaining
            </span>
            <span style={{ fontSize: 9, color: "#64748b", fontWeight: 600 }}>Goal: Recovery</span>
          </div>
          {/* Segmented track */}
          <div style={{ display: "flex", gap: 3 }}>
            {segs.map((seg, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              const fill = done ? 1 : active ? seg.pct : 0;
              return (
                <div key={i} style={{ flex: 1, height: 6, borderRadius: 999, background: seg.dimColor, overflow: "hidden" }}>
                  <div style={{
                    height: "100%", width: `${fill * 100}%`, borderRadius: 999,
                    background: seg.color,
                    boxShadow: fill > 0 ? `0 0 6px ${seg.color}88` : "none",
                  }} />
                </div>
              );
            })}
          </div>
          {/* Labels */}
          <div style={{ display: "flex", gap: 3, marginTop: 5 }}>
            {segs.map((seg, i) => {
              const done = i < activeIdx;
              const active = i === activeIdx;
              return (
                <div key={i} style={{
                  flex: 1, textAlign: "center", fontSize: 8, fontWeight: 600,
                  color: done ? seg.color : active ? seg.color : "#334155",
                  opacity: done ? 1 : active ? 1 : 0.4,
                  padding: "2px 0",
                }}>{seg.label}</div>
              );
            })}
          </div>
        </div>

        {/* STOP button */}
        <button style={{
          width: "100%",
          background: "linear-gradient(to bottom, #ef4444, #b91c1c)",
          border: "1px solid rgba(248,113,113,0.5)", color: "white",
          fontWeight: 700, padding: "20px 0", borderRadius: 16,
          fontSize: 20, letterSpacing: "0.12em",
          boxShadow: "0 0 24px rgba(220,38,38,0.4), inset 0 2px 10px rgba(255,255,255,0.25)",
          cursor: "pointer",
        }}>STOP</button>
      </div>
    </div>
  );
}
