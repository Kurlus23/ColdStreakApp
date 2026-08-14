// Frozen Brain 1 — Icy outline with frost glow
export function Brain1() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Icy Outline</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(8,47,73,0.8), rgba(12,74,110,0.7))",
               border: "1px solid rgba(125,211,252,0.5)",
               boxShadow: "0 0 18px rgba(125,211,252,0.28), inset 0 0 8px rgba(125,211,252,0.06)"
             }}>
          <svg viewBox="0 0 36 36" className="w-7 h-7">
            <defs>
              <linearGradient id="b1g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e0f2fe"/>
                <stop offset="100%" stopColor="#38bdf8"/>
              </linearGradient>
            </defs>
            {/* Left hemisphere */}
            <path d="M18 6 C18 6, 10 6, 7 11 C4 16, 5 21, 7 23 C5 25, 6 29, 10 29 C12 29, 14 28, 16 27 L16 8 Z"
                  fill="none" stroke="url(#b1g)" strokeWidth="1.4" strokeLinejoin="round"
                  style={{ filter: "drop-shadow(0 0 3px rgba(125,211,252,0.8))" }}/>
            {/* Right hemisphere */}
            <path d="M18 6 C18 6, 26 6, 29 11 C32 16, 31 21, 29 23 C31 25, 30 29, 26 29 C24 29, 22 28, 20 27 L20 8 Z"
                  fill="none" stroke="url(#b1g)" strokeWidth="1.4" strokeLinejoin="round"
                  style={{ filter: "drop-shadow(0 0 3px rgba(125,211,252,0.8))" }}/>
            {/* Center groove */}
            <line x1="18" y1="6" x2="18" y2="15" stroke="rgba(125,211,252,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
            {/* Left fold lines */}
            <path d="M9 14 C10 13, 12 14, 13 13" fill="none" stroke="rgba(147,210,240,0.55)" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M8 19 C9 18, 11 19, 13 18" fill="none" stroke="rgba(147,210,240,0.5)" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M9 24 C10 23, 12 24, 14 23" fill="none" stroke="rgba(147,210,240,0.45)" strokeWidth="0.8" strokeLinecap="round"/>
            {/* Right fold lines */}
            <path d="M27 14 C26 13, 24 14, 23 13" fill="none" stroke="rgba(147,210,240,0.55)" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M28 19 C27 18, 25 19, 23 18" fill="none" stroke="rgba(147,210,240,0.5)" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M27 24 C26 23, 24 24, 22 23" fill="none" stroke="rgba(147,210,240,0.45)" strokeWidth="0.8" strokeLinecap="round"/>
            {/* Frost sparkles */}
            {[[6,8],[30,8],[5,26],[31,26]].map(([x,y],i) => (
              <g key={i}>
                <line x1={x} y1={y-2} x2={x} y2={y+2} stroke="rgba(186,230,253,0.7)" strokeWidth="0.8"/>
                <line x1={x-2} y1={y} x2={x+2} y2={y} stroke="rgba(186,230,253,0.7)" strokeWidth="0.8"/>
              </g>
            ))}
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Brain outline frozen in ice blue glow</p>
    </div>
  );
}
