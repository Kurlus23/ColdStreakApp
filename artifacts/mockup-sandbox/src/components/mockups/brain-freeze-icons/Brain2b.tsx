// Glacial Brain v2b — Half-frozen split: left normal blue, right iced over with cracks
export function Brain2b() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Half-Frozen Split</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
             style={{
               background: "linear-gradient(145deg, rgba(8,47,73,0.8), rgba(15,23,42,0.85))",
               border: "1px solid rgba(125,211,252,0.5)",
               boxShadow: "0 0 20px rgba(103,232,249,0.28)"
             }}>
          <svg viewBox="0 0 40 38" className="w-8 h-8">
            <defs>
              <linearGradient id="b2b-warm" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.85"/>
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.9"/>
              </linearGradient>
              <linearGradient id="b2b-frozen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f0f9ff" stopOpacity="0.97"/>
                <stop offset="50%" stopColor="#bae6fd" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.9"/>
              </linearGradient>
              <clipPath id="b2b-left-clip">
                <rect x="0" y="0" width="20" height="40"/>
              </clipPath>
              <clipPath id="b2b-right-clip">
                <rect x="20" y="0" width="20" height="40"/>
              </clipPath>
            </defs>

            {/* Left lobe — deeper blue ("normal") */}
            <g clipPath="url(#b2b-left-clip)">
              <path d="M20 5 C17 3,10 3,7 7 C4 11,4 16,5 19 C3 21,3 25,5 27 C5 30,8 32,11 32 C13 32,15 31,17 30 L17 6 Z"
                    fill="url(#b2b-warm)"/>
              <path d="M6 14 C8 12,11 14,13 12" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M5 20 C7 18,10 20,13 18" fill="none" stroke="rgba(255,255,255,0.4)" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M6 26 C8 24,11 26,14 24" fill="none" stroke="rgba(255,255,255,0.35)" strokeWidth="1.1" strokeLinecap="round"/>
            </g>

            {/* Right lobe — ice white ("frozen") */}
            <g clipPath="url(#b2b-right-clip)">
              <path d="M20 5 C23 3,30 3,33 7 C36 11,36 16,35 19 C37 21,37 25,35 27 C35 30,32 32,29 32 C27 32,25 31,23 30 L23 6 Z"
                    fill="url(#b2b-frozen)"
                    style={{ filter: "drop-shadow(0 0 5px rgba(186,230,253,0.6))" }}/>
              {/* Ice crack lines */}
              <line x1="24" y1="8" x2="27" y2="14" stroke="rgba(14,116,144,0.6)" strokeWidth="0.8" strokeLinecap="round"/>
              <line x1="27" y1="14" x2="24" y2="18" stroke="rgba(14,116,144,0.5)" strokeWidth="0.7" strokeLinecap="round"/>
              <line x1="27" y1="14" x2="32" y2="17" stroke="rgba(14,116,144,0.45)" strokeWidth="0.6" strokeLinecap="round"/>
              <line x1="29" y1="21" x2="25" y2="26" stroke="rgba(14,116,144,0.5)" strokeWidth="0.7" strokeLinecap="round"/>
              <line x1="25" y1="26" x2="28" y2="30" stroke="rgba(14,116,144,0.4)" strokeWidth="0.6" strokeLinecap="round"/>
              {/* Frost fold lines */}
              <path d="M34 14 C32 12,29 14,27 12" fill="none" stroke="rgba(14,116,144,0.55)" strokeWidth="1.3" strokeLinecap="round"/>
              <path d="M35 20 C33 18,30 20,27 18" fill="none" stroke="rgba(14,116,144,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M34 26 C32 24,29 26,26 24" fill="none" stroke="rgba(14,116,144,0.45)" strokeWidth="1.1" strokeLinecap="round"/>
            </g>

            {/* Center division — the freeze line */}
            <line x1="20" y1="4" x2="20" y2="33" stroke="rgba(125,211,252,0.9)" strokeWidth="1.8" strokeLinecap="round"
                  style={{ filter: "drop-shadow(0 0 3px rgba(125,211,252,0.9))" }}/>
            {/* Top groove */}
            <line x1="20" y1="5" x2="20" y2="14" stroke="rgba(255,255,255,0.5)" strokeWidth="1.0" strokeLinecap="round"/>

            {/* Snowflake on frozen side */}
            {[0,60,120,180,240,300].map((deg,i) => {
              const r = (deg*Math.PI)/180;
              return (
                <line key={i}
                      x1={29} y1={20}
                      x2={29+5*Math.cos(r)} y2={20+5*Math.sin(r)}
                      stroke="rgba(14,116,144,0.65)" strokeWidth="0.9" strokeLinecap="round"/>
              );
            })}
            <circle cx="29" cy="20" r="1.2" fill="rgba(8,47,73,0.8)"/>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Left half blue, right half frozen — "brain freeze"</p>
    </div>
  );
}
