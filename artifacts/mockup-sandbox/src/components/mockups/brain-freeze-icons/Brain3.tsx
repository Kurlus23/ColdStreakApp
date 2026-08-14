// Frozen Brain 3 — Brain silhouette with snowflake crystal growing from center
export function Brain3() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Crystal Brain</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(8,47,73,0.85), rgba(15,23,42,0.9))",
               border: "1px solid rgba(125,211,252,0.5)",
               boxShadow: "0 0 20px rgba(103,232,249,0.3)"
             }}>
          <svg viewBox="0 0 36 36" className="w-7 h-7">
            <defs>
              <linearGradient id="b3g" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.5"/>
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.6"/>
              </linearGradient>
              <linearGradient id="b3crystal" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e0f2fe"/>
                <stop offset="100%" stopColor="#38bdf8"/>
              </linearGradient>
            </defs>
            {/* Brain silhouette — semi-transparent fill */}
            <path d="M18 6 C18 6, 10 6, 7 11 C4 16, 5 21, 7 23 C5 25, 6 29, 10 29 C12 29, 14 28, 16 27 L16 8 Z"
                  fill="url(#b3g)" stroke="rgba(125,211,252,0.5)" strokeWidth="1.0"/>
            <path d="M18 6 C18 6, 26 6, 29 11 C32 16, 31 21, 29 23 C31 25, 30 29, 26 29 C24 29, 22 28, 20 27 L20 8 Z"
                  fill="url(#b3g)" stroke="rgba(125,211,252,0.5)" strokeWidth="1.0"/>
            {/* Center groove */}
            <line x1="18" y1="6" x2="18" y2="15" stroke="rgba(125,211,252,0.5)" strokeWidth="1.0" strokeLinecap="round"/>
            {/* Snowflake crystal growing from center of brain */}
            {[0,60,120,180,240,300].map((deg,i) => {
              const r = (deg * Math.PI) / 180;
              const x2 = 18 + 7 * Math.cos(r);
              const y2 = 18 + 7 * Math.sin(r);
              const bx1 = 18 + 4*Math.cos(r) + 1.8*Math.cos(r+Math.PI/2);
              const by1 = 18 + 4*Math.sin(r) + 1.8*Math.sin(r+Math.PI/2);
              const bx2 = 18 + 4*Math.cos(r) - 1.8*Math.cos(r+Math.PI/2);
              const by2 = 18 + 4*Math.sin(r) - 1.8*Math.sin(r+Math.PI/2);
              return (
                <g key={i} style={{ filter: "drop-shadow(0 0 2px rgba(125,211,252,0.9))" }}>
                  <line x1="18" y1="18" x2={x2} y2={y2}
                        stroke="url(#b3crystal)" strokeWidth="1.3" strokeLinecap="round"/>
                  <line x1={bx1} y1={by1} x2={bx2} y2={by2}
                        stroke="rgba(186,230,253,0.85)" strokeWidth="0.9" strokeLinecap="round"/>
                  <circle cx={x2} cy={y2} r="0.9" fill="#e0f2fe"/>
                </g>
              );
            })}
            {/* Crystal center */}
            <circle cx="18" cy="18" r="1.8" fill="#e0f2fe"
                    style={{ filter: "drop-shadow(0 0 4px rgba(186,230,253,1))" }}/>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Brain with snowflake crystallizing inside it</p>
    </div>
  );
}
