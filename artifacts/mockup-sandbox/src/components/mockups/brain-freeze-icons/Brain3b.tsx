// Brain3b — Same single-blob brain + large snowflake radiating outward
export function Brain3b() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Blob Brain + Snowflake</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-12 h-12 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(8,47,73,0.85), rgba(15,23,42,0.9))",
               border: "1px solid rgba(125,211,252,0.52)",
               boxShadow: "0 0 22px rgba(103,232,249,0.32)"
             }}>
          <svg viewBox="0 0 44 40" className="w-8 h-8">
            <defs>
              <linearGradient id="bb-fill" x1="0.2" y1="0" x2="0.8" y2="1">
                <stop offset="0%" stopColor="#7dd3fc" stopOpacity="0.55"/>
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.65"/>
              </linearGradient>
              <linearGradient id="bb-flake" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#ffffff"/>
                <stop offset="100%" stopColor="#7dd3fc"/>
              </linearGradient>
            </defs>

            {/* Brain blob — semi-transparent so snowflake shows through */}
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
              C 25 3,  23 4,  22 5
              Z"
              fill="url(#bb-fill)"
              stroke="rgba(125,211,252,0.6)" strokeWidth="1.0"
              style={{ filter: "drop-shadow(0 0 5px rgba(56,189,248,0.4))" }}/>

            {/* Top groove */}
            <path d="M 22 5 C 21 9, 23 11, 22 14"
              fill="none" stroke="rgba(125,211,252,0.7)" strokeWidth="1.5" strokeLinecap="round"/>

            {/* Fold lines — darker than fill */}
            <path d="M 8 13 C 11 11, 14 13, 16 11" fill="none" stroke="rgba(125,211,252,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M 27 10 C 29 9, 32 11, 35 10"  fill="none" stroke="rgba(125,211,252,0.6)" strokeWidth="1.2" strokeLinecap="round"/>
            <path d="M 6 19 C 9 17, 13 19, 15 17"   fill="none" stroke="rgba(125,211,252,0.55)" strokeWidth="1.1" strokeLinecap="round"/>
            <path d="M 27 17 C 30 15, 33 17, 36 16" fill="none" stroke="rgba(125,211,252,0.55)" strokeWidth="1.1" strokeLinecap="round"/>
            <path d="M 8 25 C 11 23, 15 25, 17 23"  fill="none" stroke="rgba(125,211,252,0.5)" strokeWidth="1.0" strokeLinecap="round"/>
            <path d="M 26 23 C 29 22, 32 24, 35 22" fill="none" stroke="rgba(125,211,252,0.5)" strokeWidth="1.0" strokeLinecap="round"/>

            {/* Large snowflake radiating from brain centre */}
            {[0,60,120,180,240,300].map((deg, i) => {
              const r = (deg * Math.PI) / 180;
              const cx = 22, cy = 20, len = 10, bLen = 3.2;
              const x2 = cx + len * Math.cos(r), y2 = cy + len * Math.sin(r);
              const bx1 = cx+6*Math.cos(r)+bLen*Math.cos(r+Math.PI/2);
              const by1 = cy+6*Math.sin(r)+bLen*Math.sin(r+Math.PI/2);
              const bx2 = cx+6*Math.cos(r)-bLen*Math.cos(r+Math.PI/2);
              const by2 = cy+6*Math.sin(r)-bLen*Math.sin(r+Math.PI/2);
              return (
                <g key={i} style={{ filter: "drop-shadow(0 0 3px rgba(255,255,255,0.8))" }}>
                  <line x1={cx} y1={cy} x2={x2} y2={y2}
                    stroke="url(#bb-flake)" strokeWidth="1.8" strokeLinecap="round" strokeOpacity="0.95"/>
                  <line x1={bx1} y1={by1} x2={bx2} y2={by2}
                    stroke="white" strokeWidth="1.1" strokeLinecap="round" strokeOpacity="0.8"/>
                  <circle cx={x2} cy={y2} r="1.2" fill="white" fillOpacity="0.95"/>
                </g>
              );
            })}
            <circle cx="22" cy="20" r="2.5" fill="white"
              style={{ filter: "drop-shadow(0 0 6px rgba(255,255,255,1))" }}/>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Brain blob — snowflake bursting from center</p>
    </div>
  );
}
