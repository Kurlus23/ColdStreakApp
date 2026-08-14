// Ice 2 — Hexagonal ice cell
export function Ice2() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Hex Cell</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(8,47,73,0.8), rgba(12,74,110,0.7))",
               border: "1px solid rgba(125,211,252,0.45)",
               boxShadow: "0 0 14px rgba(125,211,252,0.2), inset 0 0 10px rgba(125,211,252,0.05)"
             }}>
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            {/* Outer hex */}
            <polygon points="16,2 27,8.5 27,23.5 16,30 5,23.5 5,8.5"
                     fill="none" stroke="url(#hex-grad)" strokeWidth="1.5"
                     style={{ filter: "drop-shadow(0 0 5px rgba(125,211,252,0.8))" }}/>
            {/* Inner hex */}
            <polygon points="16,7 23,11 23,21 16,25 9,21 9,11"
                     fill="rgba(125,211,252,0.08)" stroke="rgba(125,211,252,0.4)" strokeWidth="0.8"/>
            {/* Center dot */}
            <circle cx="16" cy="16" r="2" fill="#bae6fd"
                    style={{ filter: "drop-shadow(0 0 4px rgba(186,230,253,0.9))" }}/>
            {/* Hex spokes */}
            {[[16,7],[23,11],[23,21],[16,25],[9,21],[9,11]].map(([x,y],i) => (
              <line key={i} x1="16" y1="16" x2={x} y2={y}
                    stroke="rgba(125,211,252,0.3)" strokeWidth="0.6"/>
            ))}
            <defs>
              <linearGradient id="hex-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e0f2fe"/>
                <stop offset="100%" stopColor="#38bdf8"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Hexagonal cell — molecular ice structure</p>
    </div>
  );
}
