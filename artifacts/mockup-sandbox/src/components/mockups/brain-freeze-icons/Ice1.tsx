// Ice 1 — Cracked Shard (angular ice piece with fracture lines)
export function Ice1() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Cracked Shard</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center relative overflow-hidden"
             style={{
               background: "linear-gradient(145deg, rgba(186,230,253,0.15) 0%, rgba(14,116,144,0.5) 50%, rgba(7,89,133,0.65) 100%)",
               border: "1px solid rgba(125,211,252,0.5)",
               boxShadow: "0 0 16px rgba(103,232,249,0.2), inset 0 1px 0 rgba(255,255,255,0.15)"
             }}>
          <svg viewBox="0 0 32 32" className="w-7 h-7">
            {/* Main shard polygon */}
            <polygon points="16,2 28,10 24,28 8,28 4,10"
                     fill="url(#shard-grad)" fillOpacity="0.85"
                     style={{ filter: "drop-shadow(0 0 4px rgba(125,211,252,0.7))" }}/>
            {/* Fracture lines */}
            <line x1="16" y1="2" x2="12" y2="16" stroke="rgba(255,255,255,0.5)" strokeWidth="0.8"/>
            <line x1="12" y1="16" x2="20" y2="22" stroke="rgba(255,255,255,0.4)" strokeWidth="0.7"/>
            <line x1="20" y1="22" x2="16" y2="28" stroke="rgba(255,255,255,0.3)" strokeWidth="0.6"/>
            <line x1="12" y1="16" x2="4" y2="18" stroke="rgba(255,255,255,0.3)" strokeWidth="0.5"/>
            {/* Highlight edge */}
            <line x1="16" y1="2" x2="28" y2="10" stroke="rgba(255,255,255,0.6)" strokeWidth="0.8" strokeLinecap="round"/>
            <defs>
              <linearGradient id="shard-grad" x1="0" y1="0" x2="1" y2="1">
                <stop offset="0%" stopColor="#e0f2fe" stopOpacity="0.9"/>
                <stop offset="60%" stopColor="#38bdf8" stopOpacity="0.7"/>
                <stop offset="100%" stopColor="#0369a1" stopOpacity="0.8"/>
              </linearGradient>
            </defs>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Angular ice shard with fracture lines</p>
    </div>
  );
}
