// Glacial Brain v2c — Full glacial fill + oversized snowflake radiating from center
export function Brain2c() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Frozen Solid</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(14,116,144,0.52), rgba(30,58,138,0.65))",
               border: "1px solid rgba(103,232,249,0.5)",
               boxShadow: "0 0 22px rgba(103,232,249,0.32)"
             }}>
          <svg viewBox="0 0 40 38" className="w-8 h-8">
            <defs>
              <linearGradient id="b2c-fill" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.9"/>
                <stop offset="50%" stopColor="#38bdf8" stopOpacity="0.85"/>
                <stop offset="100%" stopColor="#0284c7" stopOpacity="0.9"/>
              </linearGradient>
              <linearGradient id="b2c-flake" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff"/>
                <stop offset="100%" stopColor="#bae6fd"/>
              </linearGradient>
            </defs>

            {/* Brain — glacial fill, clear outer shape */}
            <path d="M20 5 C17 3,10 3,7 7 C4 11,4 16,5 19 C3 21,3 25,5 27 C5 30,8 32,11 32 C13 32,15 31,17 30 L17 6 Z"
                  fill="url(#b2c-fill)" style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.5))" }}/>
            <path d="M20 5 C23 3,30 3,33 7 C36 11,36 16,35 19 C37 21,37 25,35 27 C35 30,32 32,29 32 C27 32,25 31,23 30 L23 6 Z"
                  fill="url(#b2c-fill)" style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.5))" }}/>

            {/* Top sheen */}
            <path d="M11 7 C14 5,17 5,20 6" fill="none" stroke="rgba(255,255,255,0.55)" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M29 7 C26 5,23 5,20 6" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="1.2" strokeLinecap="round"/>

            {/* Bold fold lines — darker than fill so they read */}
            <path d="M6 14 C8 12,11 14,13 12" fill="none" stroke="rgba(2,132,199,0.9)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M5 20 C7 18,10 20,13 18" fill="none" stroke="rgba(2,132,199,0.85)" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M6 26 C8 24,11 26,14 24" fill="none" stroke="rgba(2,132,199,0.8)" strokeWidth="1.3" strokeLinecap="round"/>
            <path d="M34 14 C32 12,29 14,27 12" fill="none" stroke="rgba(2,132,199,0.9)" strokeWidth="1.5" strokeLinecap="round"/>
            <path d="M35 20 C33 18,30 20,27 18" fill="none" stroke="rgba(2,132,199,0.85)" strokeWidth="1.4" strokeLinecap="round"/>
            <path d="M34 26 C32 24,29 26,26 24" fill="none" stroke="rgba(2,132,199,0.8)" strokeWidth="1.3" strokeLinecap="round"/>

            {/* Center groove */}
            <line x1="20" y1="5" x2="20" y2="16" stroke="rgba(2,132,199,0.9)" strokeWidth="2" strokeLinecap="round"/>

            {/* Large snowflake radiating from brain center — the "freeze" signal */}
            {[0,60,120,180,240,300].map((deg,i) => {
              const r = (deg*Math.PI)/180;
              const len = 9;
              const x2 = 20+len*Math.cos(r), y2 = 19+len*Math.sin(r);
              const bLen = 3;
              const bx1 = 20+5*Math.cos(r)+bLen*Math.cos(r+Math.PI/2);
              const by1 = 19+5*Math.sin(r)+bLen*Math.sin(r+Math.PI/2);
              const bx2 = 20+5*Math.cos(r)-bLen*Math.cos(r+Math.PI/2);
              const by2 = 19+5*Math.sin(r)-bLen*Math.sin(r+Math.PI/2);
              return (
                <g key={i} style={{ filter: "drop-shadow(0 0 2px rgba(255,255,255,0.8))" }}>
                  <line x1="20" y1="19" x2={x2} y2={y2}
                        stroke="url(#b2c-flake)" strokeWidth="1.6" strokeLinecap="round" strokeOpacity="0.9"/>
                  <line x1={bx1} y1={by1} x2={bx2} y2={by2}
                        stroke="white" strokeWidth="1.0" strokeLinecap="round" strokeOpacity="0.75"/>
                  <circle cx={x2} cy={y2} r="1.1" fill="white" fillOpacity="0.9"/>
                </g>
              );
            })}
            {/* Snowflake center gem */}
            <circle cx="20" cy="19" r="2.2" fill="white"
                    style={{ filter: "drop-shadow(0 0 5px rgba(255,255,255,0.95))" }}/>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Glacial brain + snowflake radiating from center</p>
    </div>
  );
}
