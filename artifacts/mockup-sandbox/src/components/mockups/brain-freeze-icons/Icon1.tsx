// Option 1 — Snowflake ❄️
export function Icon1() {
  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-6"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">Option 1</p>

      {/* Button as it would appear in the header */}
      <button className="flex flex-col items-center gap-1 active:scale-95 transition-transform">
        <div className="relative w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(135deg, rgba(14,116,144,0.55), rgba(30,58,138,0.55))",
               border: "1px solid rgba(103,232,249,0.35)",
               backdropFilter: "blur(8px)",
               boxShadow: "0 0 12px rgba(103,232,249,0.15)"
             }}>
          <span className="text-[26px] leading-none" style={{ filter: "drop-shadow(0 0 6px rgba(147,210,240,0.8))" }}>❄️</span>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide">Play</span>
      </button>

      <p className="text-white/30 text-[11px] text-center px-6">Classic snowflake — instantly reads as "cold"</p>
    </div>
  );
}
