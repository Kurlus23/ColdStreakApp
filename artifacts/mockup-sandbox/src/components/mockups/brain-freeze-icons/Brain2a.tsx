// Glacial Brain v2a — Bold walnut shape + heavy icicle drips, unmistakably brain + freeze
export function Brain2a() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Bold Folds + Icicles</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(14,116,144,0.5), rgba(30,58,138,0.65))",
               border: "1px solid rgba(103,232,249,0.5)",
               boxShadow: "0 0 20px rgba(103,232,249,0.3)"
             }}>
          <svg viewBox="0 0 40 44" className="w-8 h-8">
            <defs>
              <linearGradient id="b2a-fill" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.95"/>
                <stop offset="45%" stopColor="#38bdf8" stopOpacity="0.9"/>
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.95"/>
              </linearGradient>
              <linearGradient id="b2a-ice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.5"/>
              </linearGradient>
            </defs>

            {/* ── BRAIN SHAPE: classic walnut/two-lobe silhouette ── */}
            {/* Left lobe */}
            <path d="
              M20 5
              C17 3, 10 3, 7 7
              C4 11, 4 16, 5 19
              C3 21, 3 25, 5 27
              C5 30, 8 32, 11 32
              C13 32, 15 31, 17 30
              L17 6
              Z"
              fill="url(#b2a-fill)"
              style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.55))" }}/>
            {/* Right lobe */}
            <path d="
              M20 5
              C23 3, 30 3, 33 7
              C36 11, 36 16, 35 19
              C37 21, 37 25, 35 27
              C35 30, 32 32, 29 32
              C27 32, 25 31, 23 30
              L23 6
              Z"
              fill="url(#b2a-fill)"
              style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.55))" }}/>

            {/* Top highlight sheen */}
            <path d="M11 7 C13 5, 17 5, 20 6" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M29 7 C27 5, 23 5, 20 6" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>

            {/* Center groove — the hallmark of a brain */}
            <line x1="20" y1="5" x2="20" y2="17" stroke="rgba(255,255,255,0.6)" strokeWidth="2" strokeLinecap="round"/>

            {/* Left fold lines — bold and wavy */}
            <path d="M6 14 C8 12, 11 14, 13 12" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M5 20 C7 18, 10 20, 13 18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M6 26 C8 24, 11 26, 14 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>

            {/* Right fold lines */}
            <path d="M34 14 C32 12, 29 14, 27 12" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M35 20 C33 18, 30 20, 27 18" fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M34 26 C32 24, 29 26, 26 24" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>

            {/* ── ICICLES hanging from bottom ── */}
            {[
              { x: 11, h: 8, w: 2.8 },
              { x: 15, h: 5.5, w: 2.2 },
              { x: 20, h: 10, w: 3.2 },
              { x: 25, h: 6, w: 2.4 },
              { x: 29, h: 7, w: 2.6 },
            ].map(({ x, h, w }, i) => (
              <g key={i} style={{ filter: "drop-shadow(0 0 2px rgba(125,211,252,0.8))" }}>
                <rect x={x - w/2} y="31" width={w} height="2" rx="0.6" fill="rgba(186,230,253,0.9)"/>
                <path d={`M${x - w/2} 33 L${x + w/2} 33 L${x} ${33 + h} Z`}
                      fill="url(#b2a-ice)"/>
              </g>
            ))}
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Walnut brain — bold folds, icicle drips</p>
    </div>
  );
}
