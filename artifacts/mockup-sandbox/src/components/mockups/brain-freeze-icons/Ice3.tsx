// Ice 3 — Ice drop / teardrop with inner sparkle
export function Ice3() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Ice Drop</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(14,116,144,0.55), rgba(30,58,138,0.6))",
               border: "1px solid rgba(103,232,249,0.4)",
               boxShadow: "0 0 16px rgba(103,232,249,0.22)"
             }}>
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            <defs>
              <linearGradient id="drop-grad" x1="0" y1="0" x2="0.4" y2="1">
                <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.95"/>
                <stop offset="50%" stopColor="#7dd3fc" stopOpacity="0.8"/>
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.9"/>
              </linearGradient>
            </defs>
            {/* Teardrop path */}
            <path d="M16 3 C16 3, 26 14, 26 20 C26 25.5 21.5 30 16 30 C10.5 30 6 25.5 6 20 C6 14 16 3 16 3 Z"
                  fill="url(#drop-grad)"
                  style={{ filter: "drop-shadow(0 0 5px rgba(125,211,252,0.6))" }}/>
            {/* Inner highlight */}
            <path d="M14 8 C14 8, 20 15, 20 19 C20 21.2 18.2 23 16 23"
                  fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>
            {/* Sparkle star center */}
            <path d="M16 17 L16.5 15 L17 17 L19 17 L17.5 18.2 L18 20 L16 19 L14 20 L14.5 18.2 L13 17 Z"
                  fill="rgba(255,255,255,0.85)" style={{ filter: "drop-shadow(0 0 3px white)" }}/>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Ice drop — water frozen mid-fall</p>
    </div>
  );
}
