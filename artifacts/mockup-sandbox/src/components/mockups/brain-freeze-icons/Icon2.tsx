// Option 2 — Frozen lightning bolt (cold + energy)
export function Icon2() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Option 2</p>

      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center overflow-visible"
             style={{
               background: "linear-gradient(135deg, rgba(30,58,138,0.6), rgba(14,116,144,0.5))",
               border: "1px solid rgba(103,232,249,0.4)",
               backdropFilter: "blur(8px)",
               boxShadow: "0 0 14px rgba(103,232,249,0.2)"
             }}>
          {/* Custom SVG: lightning bolt with snowflake/crystal overlay */}
          <svg viewBox="0 0 28 28" className="w-6 h-6">
            {/* Lightning bolt */}
            <path d="M16 2 L8 15 L13 15 L12 26 L20 13 L15 13 Z"
                  fill="url(#bolt-grad)" style={{ filter: "drop-shadow(0 0 3px rgba(147,210,240,0.9))" }}/>
            {/* Ice crystal arms */}
            <line x1="5" y1="5" x2="23" y2="23" stroke="rgba(147,210,240,0.45)" strokeWidth="1" strokeLinecap="round"/>
            <line x1="23" y1="5" x2="5" y2="23" stroke="rgba(147,210,240,0.45)" strokeWidth="1" strokeLinecap="round"/>
            <line x1="14" y1="2" x2="14" y2="26" stroke="rgba(147,210,240,0.35)" strokeWidth="1" strokeLinecap="round"/>
            {/* Crystal dots */}
            {[[5,5],[23,5],[5,23],[23,23],[14,2],[14,26]].map(([x,y],i) => (
              <circle key={i} cx={x} cy={y} r="1.5" fill="rgba(147,210,240,0.7)" />
            ))}
            <defs>
              <linearGradient id="bolt-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#bfdbfe"/>
                <stop offset="100%" stopColor="#67e8f9"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>

      <p className="text-white/30 text-[11px] text-center px-6">Frozen lightning — cold meets mental sharpness</p>
    </div>
  );
}
