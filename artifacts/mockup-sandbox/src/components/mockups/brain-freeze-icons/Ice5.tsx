// Ice 5 — Frosted ? mark (cleaner, more opaque ice block version)
export function Ice5() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Frozen ?</p>
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="w-11 h-11 rounded-xl flex items-center justify-center relative overflow-hidden"
             style={{
               background: "linear-gradient(145deg, rgba(186,230,253,0.18) 0%, rgba(14,116,144,0.55) 50%, rgba(7,89,133,0.72) 100%)",
               border: "1px solid rgba(125,211,252,0.55)",
               boxShadow: "0 0 18px rgba(103,232,249,0.25), inset 0 1px 0 rgba(255,255,255,0.2)"
             }}>
          {/* Bubble refraction shapes */}
          <div className="absolute top-1 left-1.5 w-4 h-2 rounded-full opacity-20"
               style={{ background: "linear-gradient(135deg, white, transparent)" }}/>
          <div className="absolute bottom-1.5 right-2 w-2 h-1 rounded-full opacity-10 bg-white"/>
          {/* ? mark */}
          <svg viewBox="0 0 32 32" className="w-6 h-6 relative z-10">
            <text x="16" y="23" textAnchor="middle" fontFamily="Georgia, serif"
                  fontSize="22" fontWeight="900"
                  fill="none" stroke="rgba(224,242,254,0.95)" strokeWidth="1.5"
                  style={{ filter: "drop-shadow(0 0 5px rgba(186,230,253,0.9))" }}>?</text>
          </svg>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>
      <p className="text-white/30 text-[11px] text-center px-6">Crisp frosted question mark — trivia-forward</p>
    </div>
  );
}
