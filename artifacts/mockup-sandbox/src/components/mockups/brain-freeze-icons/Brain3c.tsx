// Brain3c — Same single-blob brain, left warm blue / right iced white with freeze crack
export function Brain3c() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Half-Frozen Brain</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center overflow-hidden"
             style={{
               background: "linear-gradient(145deg, rgba(8,47,73,0.85), rgba(15,23,42,0.9))",
               border: "1px solid rgba(125,211,252,0.52)",
               boxShadow: "0 0 20px rgba(103,232,249,0.28)"
             }}>
          <svg viewBox="0 0 44 40" className="w-8 h-8">
            <defs>
              <linearGradient id="bc-warm" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.9"/>
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.95"/>
              </linearGradient>
              <linearGradient id="bc-frozen" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#f0f9ff" stopOpacity="0.97"/>
                <stop offset="60%" stopColor="#bae6fd" stopOpacity="0.95"/>
                <stop offset="100%" stopColor="#7dd3fc" stopOpacity="0.9"/>
              </linearGradient>
              <clipPath id="bc-left">
                <rect x="0" y="0" width="22" height="44"/>
              </clipPath>
              <clipPath id="bc-right">
                <rect x="22" y="0" width="22" height="44"/>
              </clipPath>
            </defs>

            {/* Shared brain blob path */}
            {[
              { id: "bc-left",  fill: "url(#bc-warm)",   glow: "rgba(56,189,248,0.4)" },
              { id: "bc-right", fill: "url(#bc-frozen)", glow: "rgba(186,230,253,0.5)" },
            ].map(({ id, fill, glow }) => (
              <g key={id} clipPath={`url(#${id})`}>
                <path d="
                  M 22 5
                  C 21 4, 18 3, 14 4
                  C 10 5,  6 8,  5 12
                  C 4 16,  5 20,  6 22
                  C 4 24,  4 28,  7 30
                  C 9 32, 13 33, 17 33
                  C 19 34, 21 34, 23 34
                  C 25 34, 28 33, 31 33
                  C 35 32, 38 30, 38 27
                  C 39 24, 38 21, 37 19
                  C 39 17, 39 12, 37 9
                  C 35 6,  31 4,  27 4
                  C 25 3,  23 4,  22 5 Z"
                  fill={fill}
                  style={{ filter: `drop-shadow(0 0 4px ${glow})` }}/>
              </g>
            ))}

            {/* Left (warm) fold lines */}
            <g clipPath="url(#bc-left)">
              <path d="M 8 13 C 11 11, 14 13, 16 11" fill="none" stroke="rgba(2,132,199,0.75)" strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M 6 19 C 9 17, 13 19, 15 17"  fill="none" stroke="rgba(2,132,199,0.7)"  strokeWidth="1.1" strokeLinecap="round"/>
              <path d="M 8 25 C 11 23, 15 25, 17 23" fill="none" stroke="rgba(2,132,199,0.65)" strokeWidth="1.0" strokeLinecap="round"/>
            </g>

            {/* Right (frozen) fold lines + ice cracks */}
            <g clipPath="url(#bc-right)">
              <path d="M 27 10 C 30 9, 33 11, 36 10"  fill="none" stroke="rgba(7,89,133,0.7)"  strokeWidth="1.2" strokeLinecap="round"/>
              <path d="M 27 17 C 30 15, 33 17, 36 16" fill="none" stroke="rgba(7,89,133,0.65)" strokeWidth="1.1" strokeLinecap="round"/>
              <path d="M 26 23 C 29 22, 32 24, 35 22" fill="none" stroke="rgba(7,89,133,0.6)"  strokeWidth="1.0" strokeLinecap="round"/>
              {/* Ice cracks — jagged diagonal lines */}
              <polyline points="25,7 28,13 25,17 29,22 27,28"
                fill="none" stroke="rgba(7,89,133,0.55)" strokeWidth="0.8" strokeLinecap="round" strokeLinejoin="round"/>
              <line x1="28" y1="13" x2="33" y2="15" stroke="rgba(7,89,133,0.45)" strokeWidth="0.7"/>
              <line x1="25" y1="17" x2="30" y2="19" stroke="rgba(7,89,133,0.4)"  strokeWidth="0.6"/>
            </g>

            {/* Freeze line — glowing vertical divide */}
            <line x1="22" y1="4" x2="22" y2="34"
              stroke="rgba(125,211,252,0.95)" strokeWidth="1.8" strokeLinecap="round"
              style={{ filter: "drop-shadow(0 0 3px rgba(125,211,252,0.9))" }}/>

            {/* Top groove */}
            <path d="M 22 5 C 21 9, 23 11, 22 14"
              fill="none" stroke="rgba(255,255,255,0.5)" strokeWidth="1.2" strokeLinecap="round"/>

            {/* Small snowflake on frozen side */}
            {[0,60,120,180,240,300].map((deg,i) => {
              const r=(deg*Math.PI)/180;
              return <line key={i} x1="31" y1="26" x2={31+5*Math.cos(r)} y2={26+5*Math.sin(r)}
                stroke="rgba(7,89,133,0.65)" strokeWidth="0.9" strokeLinecap="round"/>;
            })}
            <circle cx="31" cy="26" r="1.2" fill="rgba(7,89,133,0.85)"/>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Half-frozen brain — literally mid-freeze</p>
    </div>
  );
}
