// Grok2 — Compact: ? outline only (stroke), brain fills the dot, optimised to read at 28px
export function Grok2() {
  const Icon = ({ size = 44 }: { size?: number }) => (
    <svg viewBox="0 0 40 50" width={size} height={size * 50/40} style={{ filter: "drop-shadow(0 0 5px rgba(103,232,249,0.55))" }}>
      <defs>
        <linearGradient id="g2-stroke" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e0f2fe"/>
          <stop offset="100%" stopColor="#38bdf8"/>
        </linearGradient>
        <linearGradient id="g2-brain" x1="0.2" y1="0" x2="0.8" y2="1">
          <stop offset="0%" stopColor="#bae6fd" stopOpacity="0.95"/>
          <stop offset="100%" stopColor="#0ea5e9" stopOpacity="0.9"/>
        </linearGradient>
      </defs>

      {/* ? arc — thick stroke only, no fill, so it's bold at any size */}
      <path d="M 10 13 C 10 6, 16 2, 20 2 C 24 2, 30 5, 30 12 C 30 18, 25 21, 22 24 C 20 26, 20 28, 20 30"
        fill="none" stroke="url(#g2-stroke)" strokeWidth="4.5" strokeLinecap="round"
        style={{ filter: "drop-shadow(0 0 4px rgba(125,211,252,0.7))" }}/>

      {/* ── Brain sits where the dot would be ── */}
      {/* Brain blob: single organic shape */}
      <path d="
        M 20 36
        C 19.5 35, 17 35, 15.5 36.5
        C 14 38, 14.5 40, 15.5 41
        C 14 42, 14.5 44, 16.5 44
        C 17.5 44, 19 43.5, 20 43
        C 21 43.5, 22.5 44, 23.5 44
        C 25.5 44, 26 42, 24.5 41
        C 25.5 40, 26 38, 24.5 36.5
        C 23 35, 20.5 35, 20 36
        Z"
        fill="url(#g2-brain)"
        style={{ filter: "drop-shadow(0 0 4px rgba(56,189,248,0.6))" }}/>
      {/* Center groove */}
      <line x1="20" y1="36" x2="20" y2="39.5" stroke="rgba(2,132,199,0.85)" strokeWidth="1.1" strokeLinecap="round"/>
      {/* Folds — readable even at 28px */}
      <path d="M 16 38.5 C 17 37.5, 18.5 38.5, 19 37.5" fill="none" stroke="rgba(2,132,199,0.8)" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M 21 37.5 C 21.5 38.5, 23 37.5, 24 38.5" fill="none" stroke="rgba(2,132,199,0.8)" strokeWidth="0.9" strokeLinecap="round"/>
      <path d="M 15.5 41 C 17 40, 18.5 41, 19.5 40" fill="none" stroke="rgba(2,132,199,0.7)" strokeWidth="0.8" strokeLinecap="round"/>
      <path d="M 20.5 40 C 21.5 41, 23 40, 24.5 41" fill="none" stroke="rgba(2,132,199,0.7)" strokeWidth="0.8" strokeLinecap="round"/>
    </svg>
  );

  return (
    <div className="min-h-screen flex flex-col items-center justify-center gap-8"
         style={{ background: "linear-gradient(135deg, #050d1a 0%, #091425 100%)" }}>
      <p className="text-white/40 text-[10px] uppercase tracking-widest">? + Brain (Compact)</p>

      <div className="p-6 rounded-2xl" style={{ background: "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Icon size={100}/>
      </div>

      <div className="flex flex-col items-center gap-1">
        <p className="text-white/30 text-[9px] uppercase tracking-wider mb-1">Actual size in header</p>
        <div className="w-11 h-11 rounded-xl flex items-center justify-center"
             style={{
               background: "linear-gradient(145deg, rgba(14,116,144,0.52), rgba(30,58,138,0.65))",
               border: "1px solid rgba(103,232,249,0.5)",
               boxShadow: "0 0 18px rgba(103,232,249,0.28)"
             }}>
          <Icon size={26}/>
        </div>
        <span className="text-white text-[9px] font-medium tracking-wide mt-1">Play</span>
      </div>

      <p className="text-white/30 text-[11px] text-center px-6">Stroke-only ? — bold at any size, brain replaces the dot</p>
    </div>
  );
}
