// Frozen Brain 4 — Brain with icicle drips hanging from bottom
export function Brain4() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Icicle Drips</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        {/* Taller container to show icicles */}
        <div className="w-11 h-12 rounded-xl flex items-start justify-center pt-1 relative"
             style={{
               background: "linear-gradient(145deg, rgba(14,116,144,0.52), rgba(30,58,138,0.62))",
               border: "1px solid rgba(103,232,249,0.45)",
               boxShadow: "0 0 18px rgba(103,232,249,0.25)"
             }}>
          <svg viewBox="0 0 36 42" className="w-7 h-8">
            <defs>
              <linearGradient id="b4brain" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.9"/>
                <stop offset="55%" stopColor="#38bdf8" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.85"/>
              </linearGradient>
              <linearGradient id="b4ice" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.9"/>
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.6"/>
              </linearGradient>
            </defs>
            {/* Brain body */}
            <path d="M18 5 C18 5, 10 5, 7 10 C4 15, 5 20, 7 22 C5 24, 6 28, 10 28 C12 28, 14 27, 16 26 L16 7 Z"
                  fill="url(#b4brain)"
                  style={{ filter: "drop-shadow(0 0 3px rgba(56,189,248,0.5))" }}/>
            <path d="M18 5 C18 5, 26 5, 29 10 C32 15, 31 20, 29 22 C31 24, 30 28, 26 28 C24 28, 22 27, 20 26 L20 7 Z"
                  fill="url(#b4brain)"
                  style={{ filter: "drop-shadow(0 0 3px rgba(56,189,248,0.5))" }}/>
            {/* Outline */}
            <path d="M18 5 C18 5, 10 5, 7 10 C4 15, 5 20, 7 22 C5 24, 6 28, 10 28 C12 28, 14 27, 16 26"
                  fill="none" stroke="rgba(186,230,253,0.65)" strokeWidth="0.9"/>
            <path d="M18 5 C18 5, 26 5, 29 10 C32 15, 31 20, 29 22 C31 24, 30 28, 26 28 C24 28, 22 27, 20 26"
                  fill="none" stroke="rgba(186,230,253,0.65)" strokeWidth="0.9"/>
            {/* Center groove */}
            <line x1="18" y1="5" x2="18" y2="14" stroke="rgba(255,255,255,0.45)" strokeWidth="1.1" strokeLinecap="round"/>
            {/* Fold lines */}
            <path d="M9 13 C10 12, 12 13, 13 12" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M8 18 C9 17, 11 18, 13 17" fill="none" stroke="rgba(255,255,255,0.33)" strokeWidth="0.8" strokeLinecap="round"/>
            <path d="M27 13 C26 12, 24 13, 23 12" fill="none" stroke="rgba(255,255,255,0.38)" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M28 18 C27 17, 25 18, 23 17" fill="none" stroke="rgba(255,255,255,0.33)" strokeWidth="0.8" strokeLinecap="round"/>
            {/* Icicle drips from bottom of brain — 5 icicles */}
            {[
              { x: 11, h: 7, w: 2.2 },
              { x: 14, h: 5, w: 1.8 },
              { x: 17.5, h: 9, w: 2.5 },
              { x: 21, h: 6, w: 2.0 },
              { x: 24, h: 4, w: 1.6 },
            ].map(({ x, h, w }, i) => (
              <g key={i} style={{ filter: "drop-shadow(0 0 2px rgba(125,211,252,0.7))" }}>
                <path d={`M${x - w/2} 27 L${x + w/2} 27 L${x} ${27 + h} Z`}
                      fill="url(#b4ice)"/>
                <rect x={x - w/2} y="26" width={w} height="1.5" rx="0.5" fill="rgba(186,230,253,0.8)"/>
              </g>
            ))}
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Brain with icicle drips — literally freezing</p>
    </div>
  );
}
