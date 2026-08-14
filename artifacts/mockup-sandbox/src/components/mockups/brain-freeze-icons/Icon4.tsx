// Option 4 — Question mark frozen in ice block
export function Icon4() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Option 4</p>

      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center overflow-hidden"
             style={{
               background: "linear-gradient(160deg, rgba(14,116,144,0.6) 0%, rgba(7,89,133,0.7) 50%, rgba(30,58,138,0.6) 100%)",
               border: "1px solid rgba(103,232,249,0.45)",
               backdropFilter: "blur(8px)",
               boxShadow: "0 0 14px rgba(103,232,249,0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
             }}>
          {/* Ice refraction lines */}
          <div className="absolute inset-0 opacity-20">
            <div className="absolute top-1 left-2 w-6 h-px bg-white/60 rotate-12" />
            <div className="absolute top-3 right-1 w-3 h-px bg-white/40 -rotate-6" />
            <div className="absolute bottom-2 left-1 w-4 h-px bg-white/30 rotate-6" />
          </div>
          {/* Frozen ? mark */}
          <span className="relative text-[22px] font-black leading-none"
                style={{
                  color: "transparent",
                  WebkitTextStroke: "1.5px rgba(186,230,253,0.9)",
                  filter: "drop-shadow(0 0 5px rgba(125,211,252,0.8))"
                }}>?</span>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>

      <p className="text-white/30 text-[11px] text-center px-6">Frozen question mark — trivia-first, ice-clear</p>
    </div>
  );
}
