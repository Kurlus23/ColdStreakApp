// Brain3a — Single-blob brain silhouette + icicle drips. One connected outline, no bilateral split.
export function Brain3a() {
  // Brain as ONE outer path: wider-than-tall organic blob, top groove is just a line not a full split.
  // Folds are wavy lines at different heights/angles — not symmetric rows.
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Blob Brain + Icicles</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(14,116,144,0.52), rgba(30,58,138,0.65))",
               border: "1px solid rgba(103,232,249,0.5)",
               boxShadow: "0 0 20px rgba(103,232,249,0.3)"
             }}>
          <svg viewBox="0 0 44 46" className="w-8 h-8">
            <defs>
              <linearGradient id="ba-fill" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.95"/>
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.88"/>
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.92"/>
              </linearGradient>
              <linearGradient id="ba-ice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#38bdf8" stopOpacity="0.4"/>
              </linearGradient>
            </defs>

            {/* ── ONE connected brain blob ──
                Shape: wide rounded mass, top-center notch for the longitudinal fissure,
                slightly lumpy edges for organic feel. NOT two separate halves. */}
            <path d="
              M 22 5
              C 21 4, 18 3, 14 4
              C 10 5,  6 8,  5 12
              C 4 16,  5 20,  6 22
              C 4 24,  4 28,  7 30
              C 9 32, 13 33, 17 33
              C 19 34, 21 34, 23 34
              C 25 34, 28 33, 31 33
              C 35 32, 38 30, 38 27
              C 39 24, 38 21, 37 19
              C 39 17, 39 12, 37 9
              C 35 6,  31 4,  27 4
              C 25 3,  23 4,  22 5
              Z"
              fill="url(#ba-fill)"
              style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.5))" }}/>

            {/* Top centre groove — the one thing that says "brain not lungs" */}
            <path d="M 22 5 C 21 9, 23 11, 22 14"
              fill="none" stroke="rgba(2,132,199,0.9)" strokeWidth="1.6" strokeLinecap="round"/>

            {/* Top-left sheen highlight */}
            <path d="M 10 8 C 13 6, 17 5, 21 5"
              fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round"/>

            {/* ── GYRI / FOLD LINES — different heights + angles, NOT symmetric rows ── */}
            {/* Upper-left arc */}
            <path d="M 8 13 C 11 11, 14 13, 16 11"
              fill="none" stroke="rgba(2,132,199,0.85)" strokeWidth="1.3" strokeLinecap="round"/>
            {/* Upper-right arc, slightly higher */}
            <path d="M 27 10 C 29 9, 32 11, 35 10"
              fill="none" stroke="rgba(2,132,199,0.85)" strokeWidth="1.3" strokeLinecap="round"/>
            {/* Mid-left diagonal */}
            <path d="M 6 19 C 9 17, 13 19, 15 17"
              fill="none" stroke="rgba(2,132,199,0.8)" strokeWidth="1.2" strokeLinecap="round"/>
            {/* Mid-right, lower than mid-left */}
            <path d="M 27 17 C 30 15, 33 17, 36 16"
              fill="none" stroke="rgba(2,132,199,0.8)" strokeWidth="1.2" strokeLinecap="round"/>
            {/* Lower-left, curves inward */}
            <path d="M 8 25 C 11 23, 15 25, 17 23"
              fill="none" stroke="rgba(2,132,199,0.75)" strokeWidth="1.1" strokeLinecap="round"/>
            {/* Lower-right */}
            <path d="M 26 23 C 29 22, 32 24, 35 22"
              fill="none" stroke="rgba(2,132,199,0.75)" strokeWidth="1.1" strokeLinecap="round"/>
            {/* Bottom centre fold */}
            <path d="M 16 29 C 19 27, 23 29, 26 28"
              fill="none" stroke="rgba(2,132,199,0.7)" strokeWidth="1.0" strokeLinecap="round"/>

            {/* ── ICICLES hanging from bottom ── */}
            {[
              { x: 14, h: 7,  w: 2.6 },
              { x: 18, h: 5,  w: 2.0 },
              { x: 22, h: 9,  w: 3.0 },
              { x: 26, h: 6,  w: 2.2 },
              { x: 30, h: 5,  w: 2.0 },
            ].map(({ x, h, w }, i) => (
              <g key={i} style={{ filter: "drop-shadow(0 0 2px rgba(125,211,252,0.8))" }}>
                <rect x={x - w/2} y="33" width={w} height="1.8" rx="0.5" fill="rgba(186,230,253,0.9)"/>
                <path d={`M${x-w/2} 34.8 L${x+w/2} 34.8 L${x} ${34.8+h} Z`}
                      fill="url(#ba-ice)"/>
              </g>
            ))}
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">One-piece brain blob — folds + icicle drips</p>
    </div>
  );
}
