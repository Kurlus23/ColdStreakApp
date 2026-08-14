// Frozen Brain 2 — Glacial fill with deep blue gradient + ice sheen
export function Brain2() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Glacial Fill</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(14,116,144,0.5), rgba(30,58,138,0.65))",
               border: "1px solid rgba(103,232,249,0.45)",
               boxShadow: "0 0 20px rgba(103,232,249,0.24)"
             }}>
          <svg viewBox="0 0 36 36" className="w-7 h-7">
            <defs>
              <linearGradient id="b2fill" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.95"/>
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.85"/>
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9"/>
              </linearGradient>
              <linearGradient id="b2stroke" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#e0f2fe"/>
                <stop offset="100%" stopColor="#7dd3fc"/>
              </linearGradient>
            </defs>
            {/* Left hemisphere filled */}
            <path d="M18 6 C18 6, 10 6, 7 11 C4 16, 5 21, 7 23 C5 25, 6 29, 10 29 C12 29, 14 28, 16 27 L16 8 Z"
                  fill="url(#b2fill)"
                  style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.5))" }}/>
            {/* Right hemisphere filled */}
            <path d="M18 6 C18 6, 26 6, 29 11 C32 16, 31 21, 29 23 C31 25, 30 29, 26 29 C24 29, 22 28, 20 27 L20 8 Z"
                  fill="url(#b2fill)"
                  style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.5))" }}/>
            {/* Ice sheen highlight */}
            <path d="M11 8 C13 7, 16 7, 18 8"
                  fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M20 8 C22 7, 25 7, 27 9"
                  fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
            {/* Center groove */}
            <line x1="18" y1="6" x2="18" y2="15" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
            {/* Fold lines over fill */}
            <path d="M9 14 C10 13, 12 14, 13 13" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
            <path d="M8 19 C9 18, 11 19, 13 18" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M9 24 C10 23, 12 24, 14 23" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" strokeLinecap="round"/>
            <path d="M27 14 C26 13, 24 14, 23 13" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1" strokeLinecap="round"/>
            <path d="M28 19 C27 18, 25 19, 23 18" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="0.9" strokeLinecap="round"/>
            <path d="M27 24 C26 23, 24 24, 22 23" fill="none" stroke="rgba(255,255,255,0.3)" strokeWidth="0.8" strokeLinecap="round"/>
            {/* Outline on top */}
            <path d="M18 6 C18 6, 10 6, 7 11 C4 16, 5 21, 7 23 C5 25, 6 29, 10 29 C12 29, 14 28, 16 27"
                  fill="none" stroke="rgba(186,230,253,0.7)" strokeWidth="1.0"/>
            <path d="M18 6 C18 6, 26 6, 29 11 C32 16, 31 21, 29 23 C31 25, 30 29, 26 29 C24 29, 22 28, 20 27"
                  fill="none" stroke="rgba(186,230,253,0.7)" strokeWidth="1.0"/>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Filled glacial brain — deep blue with ice sheen</p>
    </div>
  );
}
