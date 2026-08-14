// Ice 6 — 8-point crystal star / burst
export function Ice6() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Crystal Star</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(8,47,73,0.85), rgba(15,23,42,0.9))",
               border: "1px solid rgba(125,211,252,0.4)",
               boxShadow: "0 0 20px rgba(125,211,252,0.22)"
             }}>
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            <defs>
              <linearGradient id="star-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e0f2fe"/>
                <stop offset="100%" stopColor="#38bdf8"/>
              </linearGradient>
            </defs>
            {/* 4 long cardinal arms */}
            {[0,90,180,270].map((deg, i) => {
              const r = (deg * Math.PI) / 180;
              return (
                <g key={i}>
                  <line x1="16" y1="16"
                        x2={16 + 13 * Math.cos(r)} y2={16 + 13 * Math.sin(r)}
                        stroke="url(#star-grad)" strokeWidth="1.8" strokeLinecap="round"
                        style={{ filter: "drop-shadow(0 0 3px rgba(125,211,252,0.8))" }}/>
                  {/* Tiny barbs */}
                  <line x1={16 + 8*Math.cos(r) + 2.5*Math.cos(r+Math.PI/2)}
                        y1={16 + 8*Math.sin(r) + 2.5*Math.sin(r+Math.PI/2)}
                        x2={16 + 8*Math.cos(r) - 2.5*Math.cos(r+Math.PI/2)}
                        y2={16 + 8*Math.sin(r) - 2.5*Math.sin(r+Math.PI/2)}
                        stroke="rgba(125,211,252,0.6)" strokeWidth="1" strokeLinecap="round"/>
                </g>
              );
            })}
            {/* 4 shorter diagonal arms */}
            {[45,135,225,315].map((deg, i) => {
              const r = (deg * Math.PI) / 180;
              return (
                <line key={i} x1="16" y1="16"
                      x2={16 + 9 * Math.cos(r)} y2={16 + 9 * Math.sin(r)}
                      stroke="rgba(125,211,252,0.5)" strokeWidth="1.2" strokeLinecap="round"/>
              );
            })}
            {/* Center gem */}
            <circle cx="16" cy="16" r="2.8" fill="url(#star-grad)"
                    style={{ filter: "drop-shadow(0 0 5px rgba(186,230,253,1))" }}/>
            {/* Tip dots */}
            {[0,90,180,270].map((deg,i) => {
              const r = (deg*Math.PI)/180;
              return <circle key={i} cx={16+13*Math.cos(r)} cy={16+13*Math.sin(r)} r="1.2" fill="#e0f2fe"/>;
            })}
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">8-point crystal burst — precise and cold</p>
    </div>
  );
}
