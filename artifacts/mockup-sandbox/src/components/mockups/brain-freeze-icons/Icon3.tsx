// Option 3 — Ice crystal / geometric snowflake (custom SVG, no emoji)
export function Icon3() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Option 3</p>

      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(135deg, rgba(8,47,73,0.7), rgba(12,74,110,0.6))",
               border: "1px solid rgba(125,211,252,0.4)",
               backdropFilter: "blur(8px)",
               boxShadow: "0 0 16px rgba(125,211,252,0.25), inset 0 0 8px rgba(125,211,252,0.05)"
             }}>
          {/* Geometric ice crystal */}
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            <g style={{ filter: "drop-shadow(0 0 4px rgba(125,211,252,0.9))" }}>
              {/* 6 main arms */}
              {[0,60,120,180,240,300].map((deg, i) => {
                const rad = (deg * Math.PI) / 180;
                const x2 = 16 + 12 * Math.cos(rad);
                const y2 = 16 + 12 * Math.sin(rad);
                const bx1 = 16 + 7 * Math.cos(rad) + 3 * Math.cos(rad + Math.PI/2);
                const by1 = 16 + 7 * Math.sin(rad) + 3 * Math.sin(rad + Math.PI/2);
                const bx2 = 16 + 7 * Math.cos(rad) - 3 * Math.cos(rad + Math.PI/2);
                const by2 = 16 + 7 * Math.sin(rad) - 3 * Math.sin(rad + Math.PI/2);
                return (
                  <g key={i}>
                    <line x1="16" y1="16" x2={x2} y2={y2} stroke="#bae6fd" strokeWidth="1.5" strokeLinecap="round"/>
                    <line x1={bx1} y1={by1} x2={bx2} y2={by2} stroke="#7dd3fc" strokeWidth="1" strokeLinecap="round"/>
                    <circle cx={x2} cy={y2} r="1.2" fill="#e0f2fe"/>
                  </g>
                );
              })}
              {/* Center hex */}
              <circle cx="16" cy="16" r="2.5" fill="#bae6fd"/>
            </g>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>

      <p className="text-white/30 text-[11px] text-center px-6">Ice crystal — clean, geometric, cold-native</p>
    </div>
  );
}
