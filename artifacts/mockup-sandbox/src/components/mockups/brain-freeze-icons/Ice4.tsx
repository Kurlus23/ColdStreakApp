// Ice 4 — Diamond / rotated square with refraction
export function Ice4() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Diamond</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(15,23,42,0.8), rgba(8,47,73,0.75))",
               border: "1px solid rgba(148,163,184,0.3)",
               boxShadow: "0 0 18px rgba(125,211,252,0.18), inset 0 1px 0 rgba(255,255,255,0.08)"
             }}>
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            <defs>
              <linearGradient id="diamond-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f0f9ff" stopOpacity="0.95"/>
                <stop offset="35%" stopColor="#7dd3fc" stopOpacity="0.85"/>
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9"/>
              </linearGradient>
            </defs>
            {/* Outer diamond */}
            <polygon points="16,2 30,16 16,30 2,16"
                     fill="url(#diamond-grad)"
                     style={{ filter: "drop-shadow(0 0 6px rgba(125,211,252,0.55))" }}/>
            {/* Facet lines */}
            <line x1="16" y1="2" x2="16" y2="30" stroke="rgba(255,255,255,0.25)" strokeWidth="0.7"/>
            <line x1="2" y1="16" x2="30" y2="16" stroke="rgba(255,255,255,0.25)" strokeWidth="0.7"/>
            <line x1="16" y1="2" x2="30" y2="16" stroke="rgba(255,255,255,0.4)" strokeWidth="0.8"/>
            <line x1="2" y1="16" x2="16" y2="2" stroke="rgba(255,255,255,0.18)" strokeWidth="0.6"/>
            {/* Top-left bright facet */}
            <polygon points="16,2 2,16 16,10" fill="rgba(255,255,255,0.25)"/>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Ice diamond — clarity &amp; precision</p>
    </div>
  );
}
