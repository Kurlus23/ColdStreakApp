// Self-contained mockup — Plunge Screen in Challenge Mode
// Shows: benefit ring + You vs Opponent score boxes + status pill

const CX = 140, CY = 140, R = 112, STROKE = 9;
const CIRC = 2 * Math.PI * R;

function anglePt(r: number, pct: number) {
  const a = pct * 2 * Math.PI - Math.PI / 2;
  return { x: CX + r * Math.cos(a), y: CY + r * Math.sin(a) };
}

function Ring({ progress, targetLabel, accentColor }: {
  progress: number; targetLabel: string | null; accentColor?: string;
}) {
  const dot = anglePt(R, Math.min(progress, 0.999));
  const arcColor = accentColor ?? "url(#progress-grad)";
  const glowColor = accentColor ? `${accentColor}88` : "rgba(34,211,238,0.55)";
  const dotColor = accentColor ?? "#22d3ee";
  const dotGlow = accentColor ? `drop-shadow(0 0 10px ${accentColor})` : "drop-shadow(0 0 10px rgba(34,211,238,1))";
  const markerFill = accentColor ?? "#fb7185";
  const markerGlow = accentColor ? `drop-shadow(0 0 6px ${accentColor}cc)` : "drop-shadow(0 0 6px rgba(244,63,94,0.9))";
  const labelFill = accentColor ? accentColor : "rgba(251,113,133,0.85)";

  return (
    <svg viewBox="0 0 280 280" style={{ width: 280, height: 280, position: "absolute", top: "50%", left: "50%", transform: "translate(-50%,-50%)" }}>
      <circle cx={CX} cy={CY} r={R} fill="none" stroke="rgba(34,211,238,0.14)" strokeWidth={STROKE} />
      <circle
        cx={CX} cy={CY} r={R} fill="none"
        stroke={arcColor} strokeWidth={STROKE} strokeLinecap="round"
        strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - Math.min(progress, 1))}
        transform={`rotate(-90 ${CX} ${CY})`}
        style={{ filter: `drop-shadow(0 0 10px ${glowColor})` }}
      />
      {targetLabel && (
        <>
          <circle cx={CX} cy={CY - R} r={5} fill={markerFill} style={{ filter: markerGlow }} />
          <text x={CX} y={CY - R - 11} textAnchor="middle" fill={labelFill} fontSize="9"
            fontFamily="sans-serif" fontWeight="700" letterSpacing="0.06em">{targetLabel}</text>
        </>
      )}
      {progress > 0.01 && (
        <circle cx={dot.x} cy={dot.y} r={6} fill={dotColor} style={{ filter: dotGlow }} />
      )}
      <defs>
        <linearGradient id="progress-grad" x1="0%" y1="0%" x2="100%" y2="0%">
          <stop offset="0%" stopColor="#0e7490" />
          <stop offset="100%" stopColor="#22d3ee" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// Simulated state — losing scenario (you: 87.4, Rachael: 99.7)
const YOU_SCORE = 87.4;
const OPPONENT_SCORE = 99.7;
const OPPONENT_NAME = "Rachael";
const WINNING = YOU_SCORE >= OPPONENT_SCORE;
const DIFF = (OPPONENT_SCORE - YOU_SCORE).toFixed(1);

export function ChallengeMode() {
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

      {/* Ring + timer hero */}
      <div style={{ position: "relative", flex: 1, display: "flex", alignItems: "center", justifyContent: "center", width: "100%", zIndex: 10, minHeight: 300 }}>
        {/* Benefit ring — Focus segment, ~60% progress, accent purple */}
        <Ring progress={0.62} targetLabel="🧠 2:24" accentColor="#a855f7" />

        {/* Center content */}
        <div style={{ position: "relative", zIndex: 10, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
          {/* Timer */}
          <div style={{
            fontFamily: "monospace", fontWeight: 700, color: "white",
            fontSize: "4.5rem", lineHeight: 1, letterSpacing: "-0.04em",
            filter: "drop-shadow(0 0 18px rgba(34,211,238,0.5))",
          }}>4:32</div>

          {/* Status pill — losing */}
          <div style={{
            marginTop: 8, padding: "3px 12px", borderRadius: 999,
            fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
            background: "rgba(251,113,133,0.15)",
            border: "1px solid rgba(251,113,133,0.4)",
            color: "#fda4af",
          }}>
            {DIFF} pts to beat {OPPONENT_NAME}
          </div>

          {/* Dismiss */}
          <button style={{
            marginTop: 4, background: "none", border: "none",
            color: "#475569", fontSize: 10, cursor: "pointer", lineHeight: 1,
          }}>✕ dismiss</button>
        </div>

        {/* Score boxes */}
        <div style={{
          position: "absolute", bottom: 16, left: 0, right: 0,
          display: "flex", alignItems: "flex-end", justifyContent: "space-between",
          padding: "0 32px", pointerEvents: "none",
        }}>
          {/* You */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            borderRadius: 16, padding: "8px 16px", minWidth: 72,
            background: "rgba(7,26,50,0.75)",
            border: "1px solid rgba(30,58,95,0.7)",
            backdropFilter: "blur(6px)",
          }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, color: "#60a5fa", marginBottom: 2 }}>You</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#e2e8f0", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {YOU_SCORE.toFixed(1)}
            </span>
          </div>

          <span style={{ color: "rgba(29,78,216,0.5)", fontSize: 12, fontWeight: 700, paddingBottom: 4 }}>vs</span>

          {/* Opponent — leading */}
          <div style={{
            display: "flex", flexDirection: "column", alignItems: "center",
            borderRadius: 16, padding: "8px 16px", minWidth: 72,
            background: "rgba(251,113,133,0.10)",
            border: "1px solid rgba(251,113,133,0.35)",
            backdropFilter: "blur(6px)",
            boxShadow: "0 0 16px rgba(251,113,133,0.12)",
          }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.15em", fontWeight: 600, color: "#60a5fa", marginBottom: 2, maxWidth: 64, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{OPPONENT_NAME}</span>
            <span style={{ fontSize: 20, fontWeight: 700, color: "#fda4af", fontVariantNumeric: "tabular-nums", lineHeight: 1 }}>
              {OPPONENT_SCORE.toFixed(1)}
            </span>
          </div>
        </div>
      </div>

      {/* Cold Take placeholder */}
      <div style={{ width: "100%", padding: "0 20px 12px", zIndex: 10 }}>
        <div style={{
          borderRadius: 14, padding: "10px 14px",
          background: "rgba(6,182,212,0.06)", border: "1px solid rgba(34,211,238,0.10)",
          backdropFilter: "blur(8px)", textAlign: "center",
        }}>
          <div style={{ fontSize: 9, fontWeight: 700, textTransform: "uppercase", letterSpacing: "0.22em", color: "rgba(103,232,249,0.7)", marginBottom: 6 }}>⚔ Challenge Take</div>
          <div style={{ color: "rgba(226,232,240,0.85)", fontSize: 11, fontStyle: "italic", lineHeight: 1.5 }}>
            "Every second in here is a second Rachael has to think about what she started."
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
          {/* Temp */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, color: "#22c55e", marginBottom: 2 }}>Live Temp</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "white", letterSpacing: "-0.02em" }}>38°F</span>
          </div>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, transparent, #475569, transparent)" }} />
          {/* Score */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, color: "#22d3ee", marginBottom: 2 }}>Cold Score</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#67e8f9", letterSpacing: "-0.02em" }}>{YOU_SCORE.toFixed(1)}</span>
          </div>
          <div style={{ width: 1, height: 40, background: "linear-gradient(to bottom, transparent, #475569, transparent)" }} />
          {/* PB */}
          <div style={{ display: "flex", flexDirection: "column", alignItems: "center" }}>
            <span style={{ fontSize: 9, textTransform: "uppercase", letterSpacing: "0.12em", fontWeight: 600, color: "#fbbf24", marginBottom: 2 }}>Personal Best</span>
            <span style={{ fontSize: 22, fontWeight: 700, color: "#fcd34d", letterSpacing: "-0.02em" }}>112.5</span>
          </div>
        </div>

        {/* Benefit bar */}
        {(() => {
          // Segments in real order with real colors
          const segs = [
            { label: "⚡ Energy",     color: "#22d3ee", dimColor: "#164e63", pct: 1.00 },
            { label: "😊 Mood",       color: "#fbbf24", dimColor: "#78350f", pct: 0.85 },
            { label: "🔥 Metabolism", color: "#f97316", dimColor: "#7c2d12", pct: 0.52 },
            { label: "💪 Recovery",   color: "#34d399", dimColor: "#064e3b", pct: 0.00 },
          ];
          // Currently working toward Metabolism (index 2), 52% through that segment
          const activeIdx = 2;
          const activeColor = segs[activeIdx].color;
          return (
            <div style={{
              borderRadius: 12, padding: "8px 14px",
              background: "rgba(6,182,212,0.05)", border: "1px solid rgba(34,211,238,0.08)",
              backdropFilter: "blur(8px)",
            }}>
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
                        transition: "width 0.3s ease",
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
          );
        })()}

        {/* STOP button */}
        <button style={{
          width: "100%", position: "relative",
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
